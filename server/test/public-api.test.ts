import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { addDays, todayKey } from '../../src/shared/dates';
import { estimate } from '../../src/shared/pricing';
import { referencePattern } from '../../src/shared/reference';
import { capacityError } from '../../src/shared/capacity';
import type { AvailabilityResponse, InquiryCreated } from '../../src/shared/types';
import { createHash } from 'node:crypto';
import { GUEST_CONFIRMATIONS_PER_HOUR } from '../routes/public';
import { createHarness, formToken, freshIp, HOME_INLINE_SCRIPT, inquiryBody, ORIGIN, submitInquiry, type Harness } from './helpers';

const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);

describe('public API', () => {
  let h: Harness;
  before(async () => {
    h = await createHarness();
  });
  after(() => h.close());

  const today = () => todayKey(new Date(h.clock.now));

  test('GET /api/health', async () => {
    const res = await h.request('/api/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  describe('availability', () => {
    test('returns every day in the range, with blocks applied', async () => {
      const from = today();
      const to = addDays(from, 13);
      const blocked = addDays(from, 3);
      h.ctx.repo.insertBlock({ date: blocked, space: 'indoor', kind: 'held', label: 'Hold', inquiryId: null, createdBy: null }, new Date(h.clock.now).toISOString());
      const res = await h.request(`/api/availability?from=${from}&to=${to}`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const body = (await res.json()) as AvailabilityResponse;
      assert.equal(body.from, from);
      assert.equal(body.to, to);
      assert.equal(body.days.length, 14);
      const day = body.days.find((d) => d.date === blocked)!;
      assert.equal(day.status, 'partial');
      assert.deepEqual(day.spaces, { indoor: 'taken', outdoor: 'free' });
      assert.equal(body.days[0].status, 'open');
    });

    test('past days are marked past', async () => {
      const from = addDays(today(), -2);
      const body = (await (await h.request(`/api/availability?from=${from}&to=${today()}`)).json()) as AvailabilityResponse;
      assert.equal(body.days[0].status, 'past');
      assert.equal(body.days[2].status, 'open');
    });

    test('rejects bad dates, reversed ranges, and ranges over 400 days', async () => {
      assert.equal((await h.request('/api/availability?from=2026-13-01&to=2026-12-01')).status, 400);
      assert.equal((await h.request(`/api/availability?from=${addDays(today(), 5)}&to=${today()}`)).status, 400);
      const res = await h.request(`/api/availability?from=${today()}&to=${addDays(today(), 401)}`);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).ok, false);
      assert.equal((await h.request(`/api/availability?from=${today()}&to=${addDays(today(), 400)}`)).status, 200);
    });
  });

  describe('inquiries', () => {
    test('happy path: stores the inquiry, prices it on the server, and writes both emails to the outbox', async () => {
      const token = await formToken(h);
      h.clock.advance(3_500);
      const body = { ...inquiryBody(h, token), estimate: { total: 1 }, status: 'booked' };
      const res = await h.request('/api/inquiries', { body, ip: freshIp() });
      assert.equal(res.status, 201);
      const created = (await res.json()) as InquiryCreated;
      assert.equal(created.ok, true);
      assert.match(created.reference, referencePattern);
      const expected = estimate({ date: body.date, space: body.space, hours: body.hours, eventType: body.eventType }, undefined, today());
      assert.deepEqual(created.estimate, JSON.parse(JSON.stringify(expected)));
      assert.ok(created.estimate.total > 1);

      const row = h.db.prepare('SELECT * FROM inquiries WHERE reference = ?').get(created.reference) as Record<string, unknown>;
      assert.equal(row.status, 'new');
      assert.equal(row.name, 'Jordan Rivers');
      assert.equal(row.wants_visit, 1);
      assert.equal(row.estimate_total, expected.total);
      assert.equal(typeof row.ip_hash, 'string');
      assert.notEqual(row.ip_hash, '');

      await h.whenIdle();
      const files = fs.readdirSync(h.config.outboxDir).filter((f) => f.includes(created.reference));
      assert.equal(files.filter((f) => f.endsWith('.eml')).length, 2);
      assert.equal(files.filter((f) => f.endsWith('.html')).length, 2);
      const venueEml = fs.readFileSync(path.join(h.config.outboxDir, files.find((f) => f.includes('-venue-') && f.endsWith('.eml'))!), 'utf8');
      assert.match(venueEml, /Reply-To: Jordan Rivers <jordan@example.com>/);
      assert.match(venueEml, new RegExp(`To: ${h.config.notifyTo}`));
      const guestEml = fs.readFileSync(path.join(h.config.outboxDir, files.find((f) => f.includes('-guest-') && f.endsWith('.eml'))!), 'utf8');
      assert.match(guestEml, /To: jordan@example.com/);
      const guestHtml = fs.readFileSync(path.join(h.config.outboxDir, files.find((f) => f.includes('-guest-') && f.endsWith('.html'))!), 'utf8');
      assert.ok(guestHtml.includes(created.reference));
      assert.ok(guestHtml.includes('(948) 205-2934'));
      assert.ok(!guestHtml.includes(EM_DASH) && !guestHtml.includes(EN_DASH), 'no em or en dashes in email copy');

      const log = h.db.prepare('SELECT kind, status FROM email_log WHERE inquiry_id = ? ORDER BY id').all(row.id) as { kind: string; status: string }[];
      assert.deepEqual(log, [
        { kind: 'venue_notification', status: 'outbox' },
        { kind: 'guest_confirmation', status: 'outbox' },
      ]);
    });

    test('accepts form-encoded bodies and reads "false" as false', async () => {
      const token = await formToken(h);
      h.clock.advance(4_000);
      const b = inquiryBody(h, token);
      const form = new URLSearchParams({
        ...Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)])),
        wantsVisit: 'false',
        servingAlcohol: 'on',
        altDate: '',
        website: '',
      });
      const res = await h.request('/api/inquiries', {
        method: 'POST',
        body: form.toString(),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        ip: freshIp(),
      });
      assert.equal(res.status, 201, await res.clone().text());
      const { reference } = (await res.json()) as InquiryCreated;
      const row = h.db.prepare('SELECT wants_visit, serving_alcohol, alt_date FROM inquiries WHERE reference = ?').get(reference) as Record<string, unknown>;
      assert.deepEqual(row, { wants_visit: 0, serving_alcohol: 1, alt_date: null });
    });

    test('honeypot: a filled "website" field is rejected and nothing is stored', async () => {
      const before = (h.db.prepare('SELECT COUNT(*) AS n FROM inquiries').get() as { n: number }).n;
      const res = await submitInquiry(h, { website: 'https://spam.example' });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).ok, false);
      const afterCount = (h.db.prepare('SELECT COUNT(*) AS n FROM inquiries').get() as { n: number }).n;
      assert.equal(afterCount, before);
    });

    test('form token: too fast, expired, tampered, and missing are all rejected', async () => {
      const ip = freshIp();
      const token = await formToken(h);
      h.clock.advance(1_000);
      const fast = await h.request('/api/inquiries', { body: inquiryBody(h, token), ip });
      assert.equal(fast.status, 400);
      assert.match((await fast.json()).error, /Wait a few seconds/);

      h.clock.advance(24 * 60 * 60 * 1000);
      const expired = await h.request('/api/inquiries', { body: inquiryBody(h, token), ip });
      assert.equal(expired.status, 400);
      assert.match((await expired.json()).error, /expired/);

      const fresh = await formToken(h);
      h.clock.advance(5_000);
      const tampered = fresh.replace(/[.][^.]+$/, '.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      const bad = await h.request('/api/inquiries', { body: inquiryBody(h, tampered), ip });
      assert.equal(bad.status, 400);
      // Every token failure names the formToken field, so the page fetches a new token and retries.
      assert.ok((await bad.json()).fields.formToken);
      const missing = await h.request('/api/inquiries', { body: inquiryBody(h, ''), ip });
      assert.equal(missing.status, 400);
      assert.ok((await missing.json()).fields.formToken);
      assert.equal((await h.request('/api/inquiries', { body: inquiryBody(h, fresh), ip })).status, 201);
    });

    test('too fast and expired tokens also name the formToken field', async () => {
      const ip = freshIp();
      const token = await formToken(h);
      const fast = await (await h.request('/api/inquiries', { body: inquiryBody(h, token), ip })).json();
      assert.equal(fast.fields.formToken, fast.error);
      h.clock.advance(25 * 60 * 60 * 1000);
      const expired = await (await h.request('/api/inquiries', { body: inquiryBody(h, token), ip })).json();
      assert.equal(expired.fields.formToken, 'This form has expired. Refresh the page and send your request again.');
    });

    test('a retry with the same token and details returns the first reference instead of a duplicate', async () => {
      const ip = freshIp();
      const token = await formToken(h);
      h.clock.advance(4_000);
      const body = inquiryBody(h, token, { name: 'Riley Retry', email: 'riley@example.com' });
      const first = await h.request('/api/inquiries', { body, ip });
      assert.equal(first.status, 201);
      const a = (await first.json()) as InquiryCreated;
      h.clock.advance(2_000);
      const again = await h.request('/api/inquiries', { body, ip });
      assert.equal(again.status, 200);
      const b = (await again.json()) as InquiryCreated;
      assert.equal(b.reference, a.reference);
      assert.deepEqual(b.estimate, a.estimate);
      const count = (h.db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE email = 'riley@example.com'").get() as { n: number }).n;
      assert.equal(count, 1);
      // Changed details with the same token are a new request.
      const edited = await h.request('/api/inquiries', { body: { ...body, guests: 60 }, ip });
      assert.equal(edited.status, 201);
      assert.notEqual(((await edited.json()) as InquiryCreated).reference, a.reference);
    });

    test('a retry of the fifth request in an hour still gets its reference, not a 429', async () => {
      const ip = freshIp();
      for (let i = 0; i < 4; i++) assert.equal((await submitInquiry(h, {}, ip)).status, 201);
      const token = await formToken(h);
      h.clock.advance(4_000);
      const body = inquiryBody(h, token, { name: 'Fifth Request' });
      const fifth = (await (await h.request('/api/inquiries', { body, ip })).json()) as InquiryCreated;
      const retry = await h.request('/api/inquiries', { body, ip });
      assert.equal(retry.status, 200);
      assert.equal(((await retry.json()) as InquiryCreated).reference, fifth.reference);
      assert.equal((await submitInquiry(h, {}, ip)).status, 429, 'a new request is still limited');
    });

    test('the event type must be one of ours; phone numbers need an area code; one-line fields refuse line breaks', async () => {
      const unknown = await submitInquiry(h, { eventType: 'rave-party' });
      assert.equal(unknown.status, 400);
      assert.equal((await unknown.json()).fields.eventType, 'Choose the kind of event.');
      const shortPhone = await submitInquiry(h, { contactPreference: 'text', phone: '1' });
      assert.equal(shortPhone.status, 400);
      assert.equal((await shortPhone.json()).fields.phone, 'Enter your phone number with the area code.');
      const crlf = await submitInquiry(h, { name: 'Eve' + String.fromCharCode(13, 10) + 'Bcc: x@example.net' });
      assert.equal(crlf.status, 400);
      assert.equal((await crlf.json()).fields.name, 'Remove line breaks and special characters.');
      assert.equal((await submitInquiry(h, { eventType: 'other', eventTypeOther: 'Retirement party' })).status, 201);
    });

    test('the guest email says what is due to reserve, and never repeats the typed name', async () => {
      const res = await submitInquiry(h, { name: 'https://evil.example/login Customer', email: 'victim@example.com' });
      assert.equal(res.status, 201);
      const { reference, estimate: est } = (await res.json()) as InquiryCreated;
      await h.whenIdle();
      const files = fs.readdirSync(h.config.outboxDir).filter((f) => f.includes(reference));
      const guestHtml = fs.readFileSync(path.join(h.config.outboxDir, files.find((f) => f.includes('-guest-') && f.endsWith('.html'))!), 'utf8');
      assert.ok(!guestHtml.includes('evil.example'));
      assert.ok(guestHtml.includes('Thank you for your request.'));
      assert.ok(guestHtml.includes('Due to reserve the date'));
      assert.ok(guestHtml.includes(`$${est.bookingDeposit.toLocaleString('en-US')}`));
    });

    test(`after ${GUEST_CONFIRMATIONS_PER_HOUR} guest confirmations in an hour, the next guest gets none but the venue is still told`, async () => {
      const stamp = new Date(h.clock.now).toISOString();
      const insert = h.db.prepare(
        "INSERT INTO email_log (inquiry_id, kind, to_address, subject, status, transport, created_at) VALUES (NULL, 'guest_confirmation', 'x@example.com', 's', 'outbox', 'outbox', ?)",
      );
      for (let i = 0; i < GUEST_CONFIRMATIONS_PER_HOUR; i++) insert.run(stamp);
      const res = await submitInquiry(h, { email: 'capped@example.com' });
      assert.equal(res.status, 201);
      const { reference } = (await res.json()) as InquiryCreated;
      await h.whenIdle();
      const files = fs.readdirSync(h.config.outboxDir).filter((f) => f.includes(reference));
      assert.equal(files.filter((f) => f.includes('-venue-')).length, 2);
      assert.equal(files.filter((f) => f.includes('-guest-')).length, 0);
      const events = h.db
        .prepare('SELECT e.detail FROM inquiry_events e JOIN inquiries i ON i.id = e.inquiry_id WHERE i.reference = ?')
        .all(reference) as { detail: string }[];
      assert.ok(events.some((e) => e.detail.startsWith('Confirmation email not sent')));
      h.clock.advance(61 * 60 * 1000);
    });

    test('rate limit: 5 per hour per IP, then 429; other IPs are unaffected', async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) assert.equal((await submitInquiry(h, {}, ip)).status, 201, `request ${i + 1}`);
      const limited = await submitInquiry(h, {}, ip);
      assert.equal(limited.status, 429);
      assert.ok(limited.headers.get('retry-after'));
      assert.equal((await submitInquiry(h, {}, freshIp())).status, 201);
      h.clock.advance(61 * 60 * 1000);
      assert.equal((await submitInquiry(h, {}, ip)).status, 201, 'allowed again after an hour');
    });

    test('rate limit: 20 per day per IP', async () => {
      const ip = freshIp();
      for (let i = 0; i < 20; i++) {
        if (i > 0 && i % 5 === 0) h.clock.advance(61 * 60 * 1000);
        assert.equal((await submitInquiry(h, {}, ip)).status, 201, `request ${i + 1}`);
      }
      h.clock.advance(61 * 60 * 1000);
      assert.equal((await submitInquiry(h, {}, ip)).status, 429);
    });

    test('validation errors come back per field', async () => {
      const res = await submitInquiry(h, { name: '', email: 'not-an-email', startTime: '25:00' });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.ok(body.fields.name);
      assert.ok(body.fields.email);
      assert.ok(body.fields.startTime);
    });

    test('dates must be today or later and within two years', async () => {
      const past = await submitInquiry(h, { date: addDays(today(), -1) });
      assert.equal(past.status, 400);
      assert.ok((await past.json()).fields.date);
      const far = await submitInquiry(h, { date: addDays(today(), 800) });
      assert.equal(far.status, 400);
      assert.ok((await far.json()).fields.date);
      assert.equal((await submitInquiry(h, { date: today() })).status, 201);
    });

    test('capacity: too many guests for the space is a field error on guests', async () => {
      const res = await submitInquiry(h, { space: 'indoor', guests: 120 });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.fields.guests, capacityError('indoor', 120));
      assert.equal((await submitInquiry(h, { space: 'outdoor', guests: 150 })).status, 201);
      assert.equal((await submitInquiry(h, { space: 'both', guests: 151 })).status, 400);
    });

    test('a request for a taken space is still accepted, with a conflict event', async () => {
      const date = addDays(today(), 45);
      h.ctx.repo.insertBlock({ date, space: 'both', kind: 'booked', label: 'Smith wedding', inquiryId: null, createdBy: null }, new Date(h.clock.now).toISOString());
      const res = await submitInquiry(h, { date, space: 'outdoor', guests: 50 });
      assert.equal(res.status, 201);
      const { reference } = (await res.json()) as InquiryCreated;
      const events = h.db
        .prepare('SELECT e.kind, e.detail FROM inquiry_events e JOIN inquiries i ON i.id = e.inquiry_id WHERE i.reference = ?')
        .all(reference) as { kind: string; detail: string }[];
      assert.ok(events.some((e) => e.kind === 'block' && e.detail.includes('Smith wedding')));
    });
  });

  describe('origin check', () => {
    test('writes without an Origin or from another site are refused', async () => {
      const token = await formToken(h);
      h.clock.advance(4_000);
      const none = await h.request('/api/inquiries', { body: inquiryBody(h, token), origin: null, ip: freshIp() });
      assert.equal(none.status, 403);
      const evil = await h.request('/api/inquiries', { body: inquiryBody(h, token), origin: 'https://evil.example', ip: freshIp() });
      assert.equal(evil.status, 403);
      assert.equal((await evil.json()).ok, false);
    });

    test('a Referer from the public origin is accepted when Origin is missing', async () => {
      const token = await formToken(h);
      h.clock.advance(4_000);
      const res = await h.request('/api/inquiries', {
        body: inquiryBody(h, token),
        origin: null,
        headers: { referer: `${ORIGIN}/book/` },
        ip: freshIp(),
      });
      assert.equal(res.status, 201);
    });

    test('the request host is accepted (the dev proxy case: localhost:4321)', async () => {
      const token = await formToken(h);
      h.clock.advance(4_000);
      const res = await h.request('/api/inquiries', {
        body: inquiryBody(h, token),
        origin: 'http://localhost:4321',
        headers: { host: 'localhost:4321' },
        ip: freshIp(),
      });
      assert.equal(res.status, 201);
    });
  });
});

describe('errors and headers', () => {
  test('unknown API routes are JSON 404s with security headers', async () => {
    const h = await createHarness();
    try {
      const res = await h.request('/api/nope');
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { ok: false, error: 'Not found.' });
      assert.ok(res.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    } finally {
      await h.close();
    }
  });

  test('server errors are JSON 500s with security headers', async () => {
    const h = await createHarness();
    try {
      h.db.close();
      const res = await h.request(`/api/availability?from=${todayKey(new Date(h.clock.now))}&to=${todayKey(new Date(h.clock.now))}`);
      assert.equal(res.status, 500);
      assert.equal((await res.json()).ok, false);
      assert.ok(res.headers.get('content-security-policy'));
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    } finally {
      await h.close();
    }
  });

  test('security headers on every response, HSTS only for an https origin', async () => {
    const h = await createHarness();
    const plain = await createHarness({ PUBLIC_ORIGIN: 'http://127.0.0.1:8791' });
    try {
      const policy = (scripts: string) =>
        `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'${scripts}; connect-src 'self'; frame-src https://www.google.com; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'`;
      const homeScript = `'sha256-${createHash('sha256').update(HOME_INLINE_SCRIPT).digest('base64')}'`;
      for (const [p, scripts] of [
        ['/api/health', ''],
        ['/', ` ${homeScript}`],
        ['/missing/', ''],
        ['/book/', ''],
      ] as const) {
        const res = await h.request(p);
        assert.equal(res.headers.get('content-security-policy'), policy(scripts), p);
        assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
        assert.equal(res.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
        assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=31536000/);
      }
      const res = await plain.request('/api/health');
      assert.equal(res.headers.get('strict-transport-security'), null);
      assert.ok(res.headers.get('content-security-policy'));
    } finally {
      await h.close();
      await plain.close();
    }
  });
});
