import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { addDays, todayKey } from '../../src/shared/dates';
import { estimate } from '../../src/shared/pricing';
import { referencePattern } from '../../src/shared/reference';
import { capacityError } from '../../src/shared/capacity';
import type { AvailabilityResponse, InquiryCreated } from '../../src/shared/types';
import { createHarness, formToken, freshIp, inquiryBody, ORIGIN, submitInquiry, type Harness } from './helpers';

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
      assert.equal((await h.request('/api/inquiries', { body: inquiryBody(h, tampered), ip })).status, 400);
      assert.equal((await h.request('/api/inquiries', { body: inquiryBody(h, ''), ip })).status, 400);
      assert.equal((await h.request('/api/inquiries', { body: inquiryBody(h, fresh), ip })).status, 201);
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
      for (const p of ['/api/health', '/', '/missing/']) {
        const res = await h.request(p);
        assert.equal(
          res.headers.get('content-security-policy'),
          "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src https://www.google.com; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
        );
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
