import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../config';
import { MIGRATIONS, openDatabase } from '../db';
import { guestConfirmationEmail, venueNotificationEmail } from '../email/templates';
import { originAllowed } from '../middleware';
import { latestBookableDate, normalizeInquiryBody } from '../routes/public';
import { Repo, spacesOverlap } from '../repo';
import { ensureFirstAdmin } from '../bootstrap';
import { checkFormToken, hashPassword, issueFormToken, RateLimiter, verifyPassword } from '../security';
import { estimate } from '../../src/shared/pricing';
import type { Inquiry } from '../../src/shared/types';
import { silentLog } from './helpers';

describe('passwords', () => {
  test('scrypt hashes verify, with per-user salt and the agreed parameters', async () => {
    const a = await hashPassword('correct horse battery staple');
    const b = await hashPassword('correct horse battery staple');
    assert.notEqual(a, b);
    assert.match(a, /^scrypt[$]16384[$]8[$]1[$]/);
    assert.equal(Buffer.from(a.split('$')[5], 'base64').length, 64);
    assert.equal(await verifyPassword('correct horse battery staple', a), true);
    assert.equal(await verifyPassword('Correct horse battery staple', a), false);
    assert.equal(await verifyPassword('x', 'garbage'), false);
  });
});

describe('form tokens', () => {
  const secret = 'k'.repeat(40);
  test('valid between 3 seconds and 24 hours old', () => {
    const t0 = 1_800_000_000_000;
    const token = issueFormToken(secret, t0);
    assert.deepEqual(checkFormToken(secret, token, t0 + 2_999), { ok: false, reason: 'too-fast' });
    assert.deepEqual(checkFormToken(secret, token, t0 + 3_000), { ok: true, issuedAt: t0 });
    assert.deepEqual(checkFormToken(secret, token, t0 + 24 * 3600 * 1000 - 1), { ok: true, issuedAt: t0 });
    assert.deepEqual(checkFormToken(secret, token, t0 + 24 * 3600 * 1000), { ok: false, reason: 'expired' });
    assert.deepEqual(checkFormToken(secret, token, t0 - 1), { ok: false, reason: 'invalid' });
    assert.deepEqual(checkFormToken('other'.repeat(10), token, t0 + 5_000), { ok: false, reason: 'invalid' });
    const [v, , nonce, sig] = token.split('.');
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
});

describe('request helpers', () => {
  test('normalizeInquiryBody turns form strings into booleans and drops empty optionals', () => {
    const out = normalizeInquiryBody({ wantsVisit: 'false', servingAlcohol: 'on', altDate: '', phone: '  ', message: 'hi', estimate: { total: 1 } });
    assert.deepEqual(out, { wantsVisit: false, servingAlcohol: true, message: 'hi' });
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
      assert.deepEqual(tables, ['admins', 'blocks', 'email_log', 'inquiries', 'inquiry_events', 'inquiry_notes', 'sessions']);
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
      await ensureFirstAdmin({ admin: { email: 'b@example.com', password: 'another long passphrase', name: 'B' } }, repo, silentLog);
      assert.equal(repo.countAdmins(), 1);
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
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
    servingAlcohol: true,
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
      assert.ok(mail.html.includes('#7B2FBE'));
      assert.ok(mail.html.includes(inquiry.reference));
      assert.ok(mail.text.includes(inquiry.reference));
    }
    assert.ok(venue.html.includes('Line one<br>Line &lt;two&gt;'));
    assert.ok(venue.text.includes('Date is taken.'));
    assert.ok(guest.text.includes('text message'));
    assert.ok(guest.html.includes('5112 Godwin Blvd'));
    assert.ok(guest.html.includes('faith@venueatncc.org'));
    assert.ok(guest.text.includes('(948) 205-2934'));
    assert.match(guest.subject, /NCC-7K3QX/);
  });
});
