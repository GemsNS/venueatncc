import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../config';
import { ipBucket } from '../context';
import { MIGRATIONS, openDatabase } from '../db';
import { pruneOutbox } from '../email/mailer';
import { dialable, guestConfirmationEmail, venueNotificationEmail } from '../email/templates';
import { buildCsp, originAllowed } from '../middleware';
import { bookingText, planBooking } from '../routes/admin';
import { inquiryText, latestBookableDate, normalizeInquiryBody, requestFingerprint } from '../routes/public';
import { Repo, spacesOverlap } from '../repo';
import { ensureFirstAdmin } from '../bootstrap';
import {
  BusyError,
  checkFormToken,
  createGate,
  hashPassword,
  issueFormToken,
  needsRehash,
  RateLimiter,
  SCRYPT_DEFAULTS,
  useFastPasswordHashingForTests,
  verifyPassword,
} from '../security';
import { inlineScriptHashes } from '../static';
import { timelineText } from '../../src/lib/api/demo-seed';
import { CSV_BOM, CSV_COLUMNS, formatReceived, inquiriesToCsv } from '../../src/shared/csv';
import { estimate } from '../../src/shared/pricing';
import { inquiryInputSchema, isSingleLine } from '../../src/shared/schemas';
import { SPACE_NAMES, type CalendarBlock, type Inquiry } from '../../src/shared/types';
import { silentLog } from './helpers';

describe('passwords', () => {
  test('new hashes use OWASP scrypt parameters (N=2^17, r=8, p=1) and verify', async () => {
    const a = await hashPassword('correct horse battery staple');
    assert.match(a, /^scrypt[$]131072[$]8[$]1[$]/);
    assert.equal(Buffer.from(a.split('$')[5], 'base64').length, 64);
    assert.equal(await verifyPassword('correct horse battery staple', a), true);
    assert.equal(needsRehash(a), false);
  });

  test('per-user salt, wrong passwords fail, and older weaker hashes are flagged for a rehash', async () => {
    useFastPasswordHashingForTests(1024);
    try {
      const a = await hashPassword('correct horse battery staple');
      const b = await hashPassword('correct horse battery staple');
      assert.notEqual(a, b);
      assert.equal(await verifyPassword('Correct horse battery staple', a), false);
      assert.equal(await verifyPassword('x', 'garbage'), false);
      assert.equal(needsRehash(a), false);
      assert.equal(needsRehash(a.replace('scrypt$1024$', 'scrypt$512$')), true);
      assert.equal(needsRehash('garbage'), true);
    } finally {
      useFastPasswordHashingForTests(SCRYPT_DEFAULTS.N);
    }
  });
});

describe('concurrency gate', () => {
  test('runs at most N at once, queues a few more, and refuses the rest with BusyError', async () => {
    const gate = createGate(2, 1);
    let running = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const task = () =>
      gate(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise<void>((resolve) => releases.push(resolve));
        running--;
        return 'done';
      });
    const a = task();
    const b = task();
    const queued = task();
    await assert.rejects(task(), BusyError, 'queue of 1 is full');
    await new Promise((r) => setImmediate(r));
    assert.equal(running, 2);
    releases.shift()!();
    assert.equal(await a, 'done');
    await new Promise((r) => setImmediate(r));
    assert.equal(running, 2, 'the queued task took the free slot');
    while (releases.length) releases.shift()!();
    await new Promise((r) => setImmediate(r));
    while (releases.length) releases.shift()!();
    assert.deepEqual(await Promise.all([b, queued]), ['done', 'done']);
    assert.equal(peak, 2);
    assert.equal(await gate(async () => 'free again'), 'free again');
  });
});

describe('form tokens', () => {
  const secret = 'k'.repeat(40);
  test('valid between 3 seconds and 24 hours old', () => {
    const t0 = 1_800_000_000_000;
    const token = issueFormToken(secret, t0);
    const nonce = token.split('.')[2];
    assert.deepEqual(checkFormToken(secret, token, t0 + 2_999), { ok: false, reason: 'too-fast' });
    assert.deepEqual(checkFormToken(secret, token, t0 + 3_000), { ok: true, issuedAt: t0, nonce });
    assert.deepEqual(checkFormToken(secret, token, t0 + 24 * 3600 * 1000 - 1), { ok: true, issuedAt: t0, nonce });
    assert.deepEqual(checkFormToken(secret, token, t0 + 24 * 3600 * 1000), { ok: false, reason: 'expired' });
    assert.deepEqual(checkFormToken(secret, token, t0 - 1), { ok: false, reason: 'invalid' });
    assert.deepEqual(checkFormToken('other'.repeat(10), token, t0 + 5_000), { ok: false, reason: 'invalid' });
    const [v, , , sig] = token.split('.');
    assert.deepEqual(checkFormToken(secret, [v, String(t0 - 60_000), nonce, sig].join('.'), t0 + 5_000), { ok: false, reason: 'invalid' });
    assert.deepEqual(checkFormToken(secret, 'nonsense', t0), { ok: false, reason: 'invalid' });
  });
});

describe('rate limiter', () => {
  test('sliding window', () => {
    const rl = new RateLimiter(2, 1000);
    assert.equal(rl.blocked('k', 0), false);
    rl.hit('k', 0);
    rl.hit('k', 100);
    assert.equal(rl.blocked('k', 500), true);
    assert.equal(rl.retryAfterMs('k', 500), 500);
    assert.equal(rl.blocked('k', 1001), false);
    rl.reset('k');
    assert.equal(rl.blocked('k', 1001), false);
  });

  test('consume checks and counts in one step', () => {
    const rl = new RateLimiter(3, 1000);
    // Synchronous: every call sees the ones before it, so a burst cannot all pass.
    const results = Array.from({ length: 5 }, () => rl.consume('k', 0));
    assert.deepEqual(results, [true, true, true, false, false]);
    assert.equal(rl.blocked('k', 999), true);
    assert.equal(rl.consume('k', 1001), true, 'allowed again once the window passes');
  });

  test('holds at most maxKeys keys, dropping the least recently used', () => {
    const rl = new RateLimiter(5, 60_000, 3);
    for (const k of ['a', 'b', 'c']) rl.hit(k, 0);
    rl.hit('a', 1);
    rl.hit('d', 2);
    assert.equal(rl.size, 3);
    assert.equal(rl.blocked('b', 3), false, 'b was the least recently used and was dropped');
    rl.hit('a', 3);
    rl.hit('a', 3);
    rl.hit('a', 3);
    assert.equal(rl.blocked('a', 4), true, 'a kept its count');
  });
});

describe('client address buckets', () => {
  test('IPv4 as is, IPv4-mapped IPv6 as IPv4, IPv6 cut to its /64', () => {
    assert.equal(ipBucket('192.0.2.7'), '192.0.2.7');
    assert.equal(ipBucket('::ffff:192.0.2.7'), '192.0.2.7');
    assert.equal(ipBucket('::FFFF:C000:0207'), '192.0.2.7');
    assert.equal(ipBucket('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
    assert.equal(ipBucket('2001:db8:1:2::1'), '2001:db8:1:2::/64');
    assert.equal(ipBucket('2001:0db8:0001:0002:0000:0000:0000:0009'), '2001:db8:1:2::/64');
    assert.equal(ipBucket('2001:db8::1'), '2001:db8:0:0::/64');
    assert.equal(ipBucket('fe80::1%eth0'), 'fe80:0:0:0::/64');
    assert.equal(ipBucket('[2001:db8:1:2::5]'), '2001:db8:1:2::/64');
    assert.equal(ipBucket('::1'), '0:0:0:0::/64');
    assert.equal(ipBucket('64:ff9b::192.0.2.7'), '64:ff9b:0:0::/64');
    assert.equal(ipBucket('unknown'), 'unknown');
    assert.equal(ipBucket('not:an:address:::'), 'not:an:address:::');
    // Two addresses in one /64 share a bucket; the next /64 does not.
    assert.equal(ipBucket('2001:db8:1:2::a'), ipBucket('2001:db8:1:2:ffff::b'));
    assert.notEqual(ipBucket('2001:db8:1:2::a'), ipBucket('2001:db8:1:3::a'));
  });
});

describe('request helpers', () => {
  test('normalizeInquiryBody turns form strings into booleans and drops empty optionals', () => {
    const out = normalizeInquiryBody({ wantsVisit: 'false', altDate: '', phone: '  ', message: 'hi', estimate: { total: 1 } });
    assert.deepEqual(out, { wantsVisit: false, message: 'hi' });
    assert.deepEqual(normalizeInquiryBody({ wantsVisit: 'on' }), { wantsVisit: true });
  });

  test('latest bookable date is two years out', () => {
    assert.equal(latestBookableDate('2026-10-01'), '2028-10-01');
  });

  test('space overlap', () => {
    assert.equal(spacesOverlap('indoor', 'indoor'), true);
    assert.equal(spacesOverlap('indoor', 'outdoor'), false);
    assert.equal(spacesOverlap('both', 'outdoor'), true);
    assert.equal(spacesOverlap('indoor', 'both'), true);
  });

  test('origin check: public origin or the request host', () => {
    assert.equal(originAllowed('https://venueatncc.org', 'app:8787', 'https://venueatncc.org'), true);
    assert.equal(originAllowed('http://localhost:4321', 'localhost:4321', 'https://venueatncc.org'), true);
    assert.equal(originAllowed('https://evil.example', 'venueatncc.org', 'https://venueatncc.org'), false);
    assert.equal(originAllowed('null', 'venueatncc.org', 'https://venueatncc.org'), false);
  });
});

describe('config', () => {
  test('production requires secrets', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }, silentLog), /SESSION_SECRET/);
    assert.throws(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short', FORM_TOKEN_SECRET: 'x'.repeat(40) }, silentLog), /at least 32/);
    const c = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(40), FORM_TOKEN_SECRET: 'b'.repeat(40) }, silentLog);
    assert.equal(c.secureCookies, true);
    assert.equal(c.port, 8787);
    assert.equal(c.publicOrigin, 'https://venueatncc.org');
    assert.equal(c.notifyTo, 'faith@venueatncc.org');
    assert.equal(c.smtp, null);
  });

  test('development generates ephemeral secrets and an http origin turns off Secure and HSTS', () => {
    const c = loadConfig({ PUBLIC_ORIGIN: 'http://localhost:4321/' }, silentLog);
    assert.ok(c.sessionSecret.length >= 32);
    assert.equal(c.publicOrigin, 'http://localhost:4321');
    assert.equal(c.secureCookies, false);
    assert.equal(c.hsts, false);
  });

  test('SMTP settings', () => {
    const c = loadConfig({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_SECURE: 'true', SMTP_PORT: '465' }, silentLog);
    assert.deepEqual(c.smtp, { host: 'smtp.example.com', port: 465, secure: true, user: 'u', pass: 'p' });
  });
});

describe('database', () => {
  test('migrations set user_version, WAL, and foreign keys', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-db-test-'));
    try {
      const db = openDatabase(path.join(dir, 'nested', 'venue.db'));
      assert.equal(db.pragma('user_version', { simple: true }), MIGRATIONS.length);
      assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
      assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
      const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
      assert.deepEqual(tables, ['admins', 'blocks', 'email_log', 'form_token_uses', 'inquiries', 'inquiry_events', 'inquiry_notes', 'sessions']);
      db.close();
      const again = openDatabase(path.join(dir, 'nested', 'venue.db'));
      assert.equal(again.pragma('user_version', { simple: true }), MIGRATIONS.length);
      again.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('first admin from the environment', () => {
  test('created only when there is no admin, and only with a long enough password', async () => {
    useFastPasswordHashingForTests();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-admin-test-'));
    const db = openDatabase(path.join(dir, 'venue.db'));
    try {
      const repo = new Repo(db);
      await ensureFirstAdmin({ admin: { email: 'a@example.com', password: 'short', name: 'A' } }, repo, silentLog);
      assert.equal(repo.countAdmins(), 0);
      await ensureFirstAdmin({ admin: { email: 'a@example.com', password: 'long enough passphrase', name: 'A' } }, repo, silentLog);
      assert.equal(repo.countAdmins(), 1);
      const admin = repo.findAdminByEmail('A@example.com')!;
      assert.equal(await verifyPassword('long enough passphrase', admin.passwordHash), true);
      const warnings: string[] = [];
      await ensureFirstAdmin({ admin: { email: 'b@example.com', password: 'another long passphrase', name: 'B' } }, repo, {
        ...silentLog,
        warn: (...args: unknown[]) => warnings.push(args.join(' ')),
      });
      assert.equal(repo.countAdmins(), 1);
      assert.ok(warnings.some((w) => w.includes('ADMIN_PASSWORD is still set')), 'a leftover ADMIN_PASSWORD is a warning');
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
      useFastPasswordHashingForTests(SCRYPT_DEFAULTS.N);
    }
  });
});

describe('email outbox retention', () => {
  test('pruneOutbox deletes only .eml and .html files older than the retention period', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-outbox-test-'));
    try {
      const now = Date.parse('2026-10-01T12:00:00Z');
      const day = 24 * 3600 * 1000;
      const files: [string, number][] = [
        ['old-guest.eml', now - 40 * day],
        ['old-guest.html', now - 40 * day],
        ['recent-guest.eml', now - 5 * day],
        ['old-notes.txt', now - 40 * day],
      ];
      for (const [name, mtime] of files) {
        const file = path.join(dir, name);
        fs.writeFileSync(file, 'x');
        fs.utimesSync(file, new Date(mtime), new Date(mtime));
      }
      assert.equal(await pruneOutbox(dir, 30, now), 2);
      assert.deepEqual(fs.readdirSync(dir).sort(), ['old-notes.txt', 'recent-guest.eml']);
      assert.equal(await pruneOutbox(dir, 0, now), 0, 'zero means keep everything');
      assert.equal(await pruneOutbox(path.join(dir, 'missing'), 30, now), 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('OUTBOX_RETENTION_DAYS is off unless set', () => {
    assert.equal(loadConfig({}, silentLog).outboxRetentionDays, null);
    assert.equal(loadConfig({ OUTBOX_RETENTION_DAYS: '90' }, silentLog).outboxRetentionDays, 90);
  });
});

describe('email templates', () => {
  const inquiry: Inquiry = {
    id: 7,
    reference: 'NCC-7K3QX',
    status: 'new',
    eventType: 'other',
    eventTypeOther: '<script>alert(1)</script>',
    date: '2026-11-14',
    startTime: '18:00',
    hours: 4,
    space: 'both',
    guests: 120,
    name: 'Sam "The Host" Lee',
    email: 'sam@example.com',
    contactPreference: 'text',
    phone: '757-555-0101',
    message: 'Line one' + String.fromCharCode(10) + 'Line <two>',
    wantsVisit: true,
    estimateTotal: 0,
    createdAt: '2026-10-01T15:00:00.000Z',
    updatedAt: '2026-10-01T15:00:00.000Z',
  };
  const est = estimate({ date: inquiry.date, space: inquiry.space, hours: inquiry.hours }, undefined, '2026-10-01');

  test('escape user input, include the key facts, and use no em or en dashes', () => {
    const venue = venueNotificationEmail(inquiry, est, { origin: 'https://venueatncc.org', conflict: 'Date is taken.' });
    const guest = guestConfirmationEmail(inquiry, est, { origin: 'https://venueatncc.org' });
    for (const mail of [venue, guest]) {
      for (const part of [mail.subject, mail.html, mail.text]) {
        assert.ok(!part.includes(String.fromCharCode(8212)), 'no em dash');
        assert.ok(!part.includes(String.fromCharCode(8211)), 'no en dash');
      }
      assert.ok(!mail.html.includes('<script>'));
      assert.ok(mail.html.includes('#2A6F97') && mail.html.includes('#01497C'), 'Steel rule and Deep Blue links');
      assert.ok(mail.html.includes('color:#012A4A'), 'Navy text');
      for (const retired of ['#4F2A75', '#7C4DB0', '#FEFAE0', '#FAEDCD', '#D4A373', '#8A5A2B', '#2F2A1F', '#5C5443']) {
        assert.ok(!mail.html.toUpperCase().includes(retired), `no retired color ${retired}`);
      }
      assert.ok(!mail.html.includes('New Community Church'), 'no church');
      assert.ok(mail.html.includes('<img src="https://venueatncc.org/brand/email-lockup.png" width="256" height="48" alt="The Venue at NCC"'), 'lockup header');
      assert.ok(mail.html.includes('Georgia'), 'serif headings');
      assert.ok(!mail.html.includes('uppercase'), 'no all-caps labels');
      assert.ok(mail.html.includes(SPACE_NAMES.both) && mail.text.includes(`Space: ${SPACE_NAMES.both}`), 'spaces by their public names');
      assert.ok(mail.html.includes(inquiry.reference));
      assert.ok(mail.text.includes(inquiry.reference));
    }
    assert.ok(
      venue.html.includes('background:#01497C;') && venue.html.includes('color:#FFFFFF;text-decoration:none;border-radius:999px'),
      'Deep Blue button with a white label',
    );
    assert.ok(venue.html.includes('Line one<br>Line &lt;two&gt;'));
    assert.ok(venue.text.includes('Date is taken.'));
    assert.ok(guest.text.includes('text message'));
    assert.ok(guest.html.includes('5112 Godwin Blvd'));
    assert.ok(guest.html.includes('faith@venueatncc.org'));
    assert.ok(guest.text.includes('(948) 205-2934'));
    assert.match(guest.subject, /NCC-7K3QX/);
  });

  test('the footer is the one contact block: address, phone, and email once each, and no operator line', () => {
    const count = (s: string, part: string) => s.split(part).length - 1;
    const venue = venueNotificationEmail(inquiry, est, { origin: 'https://venueatncc.org' });
    const guest = guestConfirmationEmail(inquiry, est, { origin: 'https://venueatncc.org' });
    for (const mail of [venue, guest]) {
      for (const part of [mail.html, mail.text]) {
        assert.equal(count(part, '5112 Godwin Blvd'), 1, 'address once');
        assert.equal(count(part, '(948) 205-2934'), 1, 'phone once');
        assert.equal(count(part, 'faith@venueatncc.org'), part === mail.html ? 2 : 1, 'email once (the HTML link has it in href and text)');
        assert.ok(!/operated by/i.test(part), 'no operator line');
      }
    }
    assert.ok(guest.html.includes('Reply to this email, or call us at the number below.'));
    assert.ok(guest.text.includes('Reply to this email, or call us at the number below.'));
  });

  const NL = String.fromCharCode(10);
  const CRLF = String.fromCharCode(13, 10);

  test('more than 30 days out: the deposit is due to reserve, with the balance and the notes in both emails', () => {
    assert.ok(est.bookingDeposit < est.total);
    const venue = venueNotificationEmail(inquiry, est, { origin: 'https://venueatncc.org' });
    const guest = guestConfirmationEmail(inquiry, est, { origin: 'https://venueatncc.org' });
    const deposit = `$${est.bookingDeposit.toLocaleString('en-US')}`;
    const balance = `$${(est.total - est.bookingDeposit).toLocaleString('en-US')}`;
    for (const mail of [venue, guest]) {
      assert.ok(mail.text.includes(`Due to reserve the date: ${deposit}`), mail.text);
      assert.ok(mail.text.includes(`Balance: ${balance}`));
      assert.ok(mail.text.includes('Refundable damage deposit, returned if there is no damage: $250'));
      assert.ok(!mail.text.includes('returned after the event'));
      for (const note of est.notes) assert.ok(mail.text.includes(`* ${note}`), `note in text: ${note}`);
      assert.ok(mail.html.includes('Due to reserve the date'));
      assert.ok(mail.html.includes('Balance'));
    }
    assert.ok(guest.text.includes(`We confirm availability, then your booking deposit of ${deposit} reserves the date.`));
  });

  test('within 30 days: the full amount is due to reserve and there is no balance', () => {
    const soon = estimate({ date: '2026-10-10', space: 'indoor', hours: 6, eventType: 'weddings' }, undefined, '2026-09-28');
    assert.equal(soon.bookingDeposit, soon.total);
    const soonInquiry = { ...inquiry, date: '2026-10-10', space: 'indoor' as const, guests: 80 };
    const guest = guestConfirmationEmail(soonInquiry, soon, { origin: 'https://venueatncc.org' });
    const venue = venueNotificationEmail(soonInquiry, soon, { origin: 'https://venueatncc.org' });
    const total = `$${soon.total.toLocaleString('en-US')}`;
    for (const mail of [guest, venue]) {
      assert.ok(mail.text.includes(`Due to reserve the date: ${total}`));
      assert.ok(!mail.text.includes('Balance:'));
      assert.ok(mail.text.includes('the full amount is due when you reserve'));
    }
    assert.ok(guest.text.includes(`We confirm availability, then your payment of ${total}, the full amount, reserves the date.`));
    assert.ok(!guest.text.includes('booking deposit of'));
  });

  test('the guest email repeats nothing the sender typed: no name, and only listed event names', () => {
    const phishy: Inquiry = {
      ...inquiry,
      name: 'https://evil.example/login Customer',
      eventType: 'other',
      eventTypeOther: 'PAY NOW AT https://evil.example/pay',
    };
    const guest = guestConfirmationEmail(phishy, est, { origin: 'https://venueatncc.org' });
    for (const part of [guest.subject, guest.html, guest.text]) assert.ok(!part.includes('evil.example'), part);
    assert.ok(guest.text.startsWith('Thank you for your request.'));
    assert.ok(guest.text.includes('Event: Other event'));
    const venue = venueNotificationEmail(phishy, est, { origin: 'https://venueatncc.org' });
    assert.ok(venue.text.includes('Event: Other: PAY NOW AT https://evil.example/pay'), 'the venue still sees what was typed');
  });

  test('typed line breaks cannot forge label lines in the plain-text venue email', () => {
    const forged: Inquiry = {
      ...inquiry,
      name: 'Eve' + CRLF + 'Email: forged@example.net',
      visitNotes: 'Any Saturday' + NL + 'CONTACT' + NL + 'Email: forged@example.net',
      message: 'Hello' + CRLF + 'Estimated total: $1',
    };
    const venue = venueNotificationEmail(forged, est, { origin: 'https://venueatncc.org' });
    const lines = venue.text.split(NL);
    assert.ok(!lines.some((l) => l.startsWith('Email: forged')), 'no forged Email line at column 0');
    assert.ok(!lines.some((l) => l.startsWith('Estimated total: $1')), 'no forged total at column 0');
    assert.equal(lines.filter((l) => l === 'CONTACT').length, 1, 'only the real CONTACT heading starts a line');
    assert.ok(venue.text.includes('Visit notes: Any Saturday' + NL + '    CONTACT' + NL + '    Email: forged@example.net'));
    assert.ok(venue.text.includes('Eve Email: forged@example.net sent a request'), 'the intro line keeps one line');
    assert.ok(venue.text.includes('MESSAGE' + NL + '    Hello' + NL + '    Estimated total: $1'));
    assert.ok(!venue.subject.includes(NL));
  });

  test('the venue email links the guest phone with its country code', () => {
    const venue = venueNotificationEmail(inquiry, est, { origin: 'https://venueatncc.org' });
    assert.ok(venue.html.includes('href="tel:+17575550101"'));
    assert.equal(dialable('(757) 555-0101'), '+17575550101');
    assert.equal(dialable('1-757-555-0101'), '+17575550101');
    assert.equal(dialable('+44 20 7946 0958'), '+442079460958');
  });
});

describe('CSV export', () => {
  const CRLF = String.fromCharCode(13, 10);
  const row: Inquiry = {
    id: 1,
    reference: 'NCC-2D98M',
    status: 'booked',
    eventType: 'weddings',
    date: '2026-10-03',
    startTime: '15:00',
    hours: 6,
    space: 'both',
    guests: 140,
    name: 'Zoë Ångström',
    email: 'zoe@example.com',
    phone: '757-555-0142',
    contactPreference: 'text',
    wantsVisit: true,
    estimateTotal: 1100,
    // 01:40 UTC on the 28th is still the 27th in Suffolk.
    createdAt: '2026-09-28T01:40:00.000Z',
    updatedAt: '2026-09-28T01:40:00.000Z',
  };

  test('readable labels, the received time in Eastern time, and a UTF-8 byte order mark', () => {
    const csv = inquiriesToCsv([row, { ...row, id: 2, reference: 'NCC-OTHER', eventType: 'other', eventTypeOther: 'Quinceañera', status: 'visit', space: 'indoor', contactPreference: 'email' }]);
    assert.ok(csv.startsWith(CSV_BOM));
    assert.equal(Buffer.from(csv, 'utf8').subarray(0, 3).toString('hex'), 'efbbbf');
    const [header, first, second] = csv.slice(1).split(CRLF);
    assert.equal(header, CSV_COLUMNS.map((c) => c.label).join(','));
    assert.ok(header.includes('Received (Eastern)'));
    const cells = first.split(',');
    const col = (label: string) => cells[CSV_COLUMNS.findIndex((c) => c.label === label)];
    assert.equal(col('Status'), 'Booked');
    assert.equal(col('Received (Eastern)'), '2026-09-27 21:40');
    assert.equal(col('Space'), SPACE_NAMES.both);
    assert.equal(col('Event type'), 'Weddings & receptions');
    assert.equal(col('Contact preference'), 'Text message');
    assert.equal(col('Name'), 'Zoë Ångström');
    assert.ok(second.includes('Visit scheduled') && second.includes(SPACE_NAMES.indoor) && second.includes('Other event,Quinceañera') && second.includes(',Email,'));
  });

  test('midnight reads 00:00, not 24:00', () => {
    assert.equal(formatReceived('2026-06-01T04:00:00.000Z'), '2026-06-01 00:00');
    assert.equal(formatReceived('not a date'), 'not a date');
  });
});

describe('inquiry schema', () => {
  const base = {
    eventType: 'weddings',
    date: '2026-11-14',
    startTime: '17:00',
    hours: 5,
    space: 'indoor',
    guests: 80,
    name: 'Jordan Rivers',
    email: 'jordan@example.com',
    contactPreference: 'email',
    formToken: 'x'.repeat(20),
  };
  const errorsFor = (overrides: Record<string, unknown>) => {
    const r = inquiryInputSchema.safeParse({ ...base, ...overrides });
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
  };

  test('event type must be a listed slug or "other"', () => {
    assert.deepEqual(errorsFor({}), {});
    assert.deepEqual(errorsFor({ eventType: 'other', eventTypeOther: 'Retirement party' }), {});
    assert.equal(errorsFor({ eventType: 'rave-party' }).eventType, 'Choose the kind of event.');
    assert.equal(errorsFor({ eventType: '' }).eventType, 'Choose the kind of event.');
    assert.equal(errorsFor({ eventType: 'PAY DEPOSIT NOW: https://evil.example/pay' }).eventType, 'Choose the kind of event.');
  });

  test('a phone number needs at least 10 digits', () => {
    assert.equal(errorsFor({ contactPreference: 'text', phone: '1' }).phone, 'Enter your phone number with the area code.');
    assert.equal(errorsFor({ phone: '555-0100' }).phone, 'Enter your phone number with the area code.');
    assert.deepEqual(errorsFor({ contactPreference: 'text', phone: '(757) 555-0100' }), {});
    assert.deepEqual(errorsFor({ phone: '+44 20 7946 0958' }), {});
    assert.equal(errorsFor({ contactPreference: 'phone' }).phone, 'Add a phone number so we can reach you that way.');
  });

  test('one-line fields refuse line breaks and other control or direction characters', () => {
    const LF = String.fromCharCode(10);
    assert.equal(errorsFor({ name: 'Eve' + LF + 'Bcc: x@example.net' }).name, 'Remove line breaks and special characters.');
    assert.equal(errorsFor({ eventType: 'other', eventTypeOther: 'Party' + String.fromCharCode(13) + 'X-Injected: yes' }).eventTypeOther, 'Remove line breaks and special characters.');
    assert.equal(errorsFor({ phone: '757 555 0100' + String.fromCharCode(0x202e) }).phone, 'Remove line breaks and special characters.');
    assert.equal(errorsFor({ name: 'Tab' + String.fromCharCode(9) + 'Name' }).name, 'Remove line breaks and special characters.');
    // Accents, apostrophes, and hyphens are fine; so are line breaks where a paragraph is expected.
    assert.deepEqual(errorsFor({ name: "Zoë O'Brien-Ångström" }), {});
    assert.deepEqual(errorsFor({ message: 'Line one' + LF + 'Line two', wantsVisit: true, visitNotes: 'Sat' + LF + 'Sun' }), {});
    assert.equal(isSingleLine('plain'), true);
    assert.equal(isSingleLine('a' + String.fromCharCode(0x2028) + 'b'), false);
    assert.equal(isSingleLine('a' + String.fromCharCode(0x85) + 'b'), false);
  });

  test('the request fingerprint ignores the form token and key order', () => {
    const a = requestFingerprint({ ...base, formToken: 'one' });
    const b = requestFingerprint({ formToken: 'two', ...Object.fromEntries(Object.entries(base).reverse()) });
    assert.equal(a, b);
    assert.notEqual(a, requestFingerprint({ ...base, guests: 81 }));
  });
});

describe('content security policy', () => {
  test('hashes inline scripts that run, and skips external and data scripts', () => {
    const html =
      '<script>console.log(1)</script>' +
      '<script type="module">import("/x.js")</script>' +
      '<script type="application/ld+json">{"@type":"Place"}</script>' +
      '<script src="/_astro/a.js"></script>' +
      '<SCRIPT TYPE="text/javascript">1</SCRIPT>' +
      '<script>console.log(1)</script>';
    const hashes = inlineScriptHashes(html);
    const sha = (s: string) => `sha256-${createHash('sha256').update(s).digest('base64')}`;
    assert.deepEqual(hashes, [sha('console.log(1)'), sha('import("/x.js")'), sha('1')].sort());
    const csp = buildCsp(hashes);
    assert.ok(csp.includes(`script-src 'self' '${sha('console.log(1)')}'`));
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'no unsafe-inline for scripts');
    assert.ok(csp.includes("img-src 'self' data:;"));
  });
});

describe('marking a request booked: calendar plan', () => {
  const block = (id: number, space: CalendarBlock['space'], kind: CalendarBlock['kind'], inquiryId: number | null, date = '2027-01-09'): CalendarBlock => ({
    id,
    date,
    space,
    kind,
    label: `Block ${id}`,
    inquiryId,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  const request = { date: '2027-01-09', space: 'both' as const };

  test('nothing on the date: add a booked block for the whole request', () => {
    assert.deepEqual(planBooking(request, [], []), { ok: true, upgrade: [], add: 'both' });
  });

  test('another block covers part of it: a clash, nothing changes', () => {
    const other = block(1, 'indoor', 'held', null);
    assert.deepEqual(planBooking(request, [], [other]), { ok: false, clash: other });
    assert.deepEqual(planBooking({ ...request, space: 'outdoor' }, [], [other]), { ok: true, upgrade: [], add: 'outdoor' });
  });

  test('a linked hold covers part of it: upgrade the hold and add the rest', () => {
    const hold = block(2, 'indoor', 'held', 7);
    assert.deepEqual(planBooking(request, [hold], [hold]), { ok: true, upgrade: [hold], add: 'outdoor' });
    const other = block(3, 'outdoor', 'closed', null);
    assert.deepEqual(planBooking(request, [hold], [hold, other]), { ok: false, clash: other });
  });

  test('already booked in full: nothing to do; a linked closed block does not count as covering', () => {
    const booked = block(4, 'both', 'booked', 7);
    assert.deepEqual(planBooking(request, [booked], [booked]), { ok: true, upgrade: [], add: null });
    const closed = block(5, 'outdoor', 'closed', 7);
    assert.deepEqual(planBooking({ ...request, space: 'outdoor' }, [closed], [closed]), { ok: false, clash: closed });
    const elsewhere = block(6, 'both', 'booked', 7, '2027-01-10');
    assert.deepEqual(planBooking(request, [elsewhere], [elsewhere]), { ok: true, upgrade: [], add: 'both' });
  });
});

describe('demo backend wording matches the server', () => {
  const b = { kind: 'held' as const, label: 'Smith family hold', space: 'indoor' as const };
  test('timeline text', () => {
    assert.equal(timelineText.created, inquiryText.created);
    for (const blk of [b, { ...b, label: '' }, { ...b, space: 'both' as const, kind: 'closed' as const }]) {
      assert.equal(timelineText.conflict('2027-01-09', blk), inquiryText.conflict('2027-01-09', blk));
      assert.equal(timelineText.booked.clash('2027-01-09', blk), bookingText.clash('2027-01-09', blk));
    }
    assert.equal(timelineText.booked.holdUpgraded('2027-01-09'), bookingText.holdUpgraded('2027-01-09'));
    assert.equal(timelineText.booked.released('2027-01-09'), bookingText.released('2027-01-09'));
    for (const [space, requested] of [['both', 'both'], ['outdoor', 'both'], ['indoor', 'indoor']] as const) {
      assert.equal(timelineText.booked.added('2027-01-09', space, requested), bookingText.added('2027-01-09', space, requested));
    }
  });
});
