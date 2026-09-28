import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayKey } from '../../src/shared/dates';
import type { AdminStats, AvailabilityResponse, CalendarBlock, Inquiry, InquiryCreated, InquiryDetail } from '../../src/shared/types';
import { ADMIN_EMAIL, ADMIN_PASSWORD, createHarness, freshIp, login, sessionCookie, submitInquiry, type Harness } from './helpers';

async function createInquiry(h: Harness, overrides: Parameters<typeof submitInquiry>[1] = {}): Promise<{ id: number; reference: string }> {
  const res = await submitInquiry(h, overrides);
  assert.equal(res.status, 201, await res.clone().text());
  const { reference } = (await res.json()) as InquiryCreated;
  const row = h.db.prepare('SELECT id FROM inquiries WHERE reference = ?').get(reference) as { id: number };
  return { id: row.id, reference };
}

describe('admin API', () => {
  let h: Harness;
  before(async () => {
    h = await createHarness();
  });
  after(() => h.close());

  const today = () => todayKey(new Date(h.clock.now));

  describe('sign-in and sessions', () => {
    test('every admin route except login needs a session', async () => {
      for (const [method, p] of [
        ['GET', '/api/admin/session'],
        ['GET', '/api/admin/stats'],
        ['GET', '/api/admin/inquiries'],
        ['GET', '/api/admin/inquiries/1'],
        ['GET', '/api/admin/blocks'],
        ['GET', '/api/admin/export.csv'],
        ['POST', '/api/admin/logout'],
        ['POST', '/api/admin/password'],
        ['POST', '/api/admin/blocks'],
        ['DELETE', '/api/admin/blocks/1'],
        ['PATCH', '/api/admin/inquiries/1'],
      ] as const) {
        const res = await h.request(p, { method, body: method === 'GET' || method === 'DELETE' ? undefined : {} });
        assert.equal(res.status, 401, `${method} ${p}`);
        assert.equal((await res.json()).ok, false);
      }
    });

    test('wrong password and unknown email get the same generic error', async () => {
      const ip = freshIp();
      const wrong = await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: 'nope' }, ip });
      const unknown = await h.request('/api/admin/login', { body: { email: 'someone@example.com', password: 'nope' }, ip });
      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      assert.deepEqual(await wrong.json(), { ok: false, error: 'Email or password is incorrect.' });
      assert.deepEqual(await unknown.json(), { ok: false, error: 'Email or password is incorrect.' });
    });

    test('login sets a secure session cookie; session and logout work', async () => {
      const res = await h.request('/api/admin/login', { body: { email: 'FAITH@venueatncc.org', password: ADMIN_PASSWORD }, ip: freshIp() });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { id: 1, email: ADMIN_EMAIL, name: 'Faith' });
      const setCookie = res.headers.get('set-cookie') ?? '';
      assert.match(setCookie, /ncc_session=[A-Za-z0-9_-]{40,}/);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.match(setCookie, /Path=[/]/);
      assert.match(setCookie, /Max-Age=1209600/);
      assert.match(setCookie, /Secure/);
      const cookie = sessionCookie(res);

      const token = cookie.split('=')[1];
      const stored = h.db.prepare('SELECT id FROM sessions').all() as { id: string }[];
      assert.ok(stored.every((s) => s.id !== token), 'only the hash of the token is stored');

      const session = await h.request('/api/admin/session', { cookie });
      assert.equal(session.status, 200);
      assert.deepEqual(await session.json(), { user: { id: 1, email: ADMIN_EMAIL, name: 'Faith' } });

      const out = await h.request('/api/admin/logout', { method: 'POST', body: {}, cookie });
      assert.equal(out.status, 200);
      assert.deepEqual(await out.json(), { ok: true });
      assert.match(out.headers.get('set-cookie') ?? '', /ncc_session=;/);
      assert.equal((await h.request('/api/admin/session', { cookie })).status, 401);
    });

    test('every login issues a new token and retires the one the browser sent', async () => {
      const first = await login(h);
      const second = await login(h, freshIp(), first);
      assert.notEqual(first, second);
      assert.equal((await h.request('/api/admin/session', { cookie: first })).status, 401);
      assert.equal((await h.request('/api/admin/session', { cookie: second })).status, 200);
    });

    test('sessions expire after 14 days', async () => {
      const cookie = await login(h);
      h.clock.advance(14 * 24 * 60 * 60 * 1000 + 1000);
      assert.equal((await h.request('/api/admin/session', { cookie })).status, 401);
    });

    test('login is rate limited per IP and email: 10 failures, then 429 even with the right password', async () => {
      const ip = freshIp();
      for (let i = 0; i < 10; i++) {
        assert.equal((await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: `wrong-${i}` }, ip })).status, 401);
      }
      const blocked = await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ip });
      assert.equal(blocked.status, 429);
      assert.equal((await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ip: freshIp() })).status, 200);
      h.clock.advance(15 * 60 * 1000 + 1000);
      assert.equal((await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ip })).status, 200);
    });

    test('writes need a same-site Origin and X-Requested-With: fetch', async () => {
      const cookie = await login(h);
      const noXrw = await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, xrw: false, ip: freshIp() });
      assert.equal(noXrw.status, 403);
      const block = { date: addDays(today(), 200), space: 'indoor', kind: 'closed', label: 'Maintenance' };
      assert.equal((await h.request('/api/admin/blocks', { body: block, cookie, origin: null })).status, 403);
      assert.equal((await h.request('/api/admin/blocks', { body: block, cookie, origin: 'https://evil.example' })).status, 403);
      assert.equal((await h.request('/api/admin/blocks', { body: block, cookie, xrw: false })).status, 403);
      assert.equal((await h.request('/api/admin/blocks', { body: block, cookie })).status, 201);
    });
  });

  describe('inquiries', () => {
    test('list, filter, search, and detail', async () => {
      const cookie = await login(h);
      const a = await createInquiry(h, { name: 'Avery Search-Target', guests: 40 });
      await createInquiry(h, { name: 'Blake Other' });

      const all = (await (await h.request('/api/admin/inquiries', { cookie })).json()) as Inquiry[];
      assert.ok(all.length >= 2);
      assert.ok(all[0].createdAt >= all[all.length - 1].createdAt, 'newest first');
      assert.ok(!('estimate' in all[0]));
      assert.equal(all.find((i) => i.id === a.id)?.altDate, undefined);
      assert.ok(!Object.values(all[0]).includes(null), 'no null fields');

      const found = (await (await h.request('/api/admin/inquiries?q=search-target', { cookie })).json()) as Inquiry[];
      assert.deepEqual(
        found.map((i) => i.reference),
        [a.reference],
      );
      const open = (await (await h.request('/api/admin/inquiries?status=open', { cookie })).json()) as Inquiry[];
      assert.ok(open.every((i) => ['new', 'contacted', 'visit', 'quoted'].includes(i.status)));
      assert.equal((await h.request('/api/admin/inquiries?status=bogus', { cookie })).status, 400);

      const detail = (await (await h.request(`/api/admin/inquiries/${a.id}`, { cookie })).json()) as InquiryDetail;
      assert.equal(detail.reference, a.reference);
      assert.equal(detail.guests, 40);
      assert.ok(detail.estimate.total > 0);
      assert.equal(detail.estimate.total, detail.estimateTotal);
      assert.ok(detail.events.some((e) => e.kind === 'created'));
      assert.equal((await h.request('/api/admin/inquiries/999999', { cookie })).status, 404);
      assert.equal((await h.request('/api/admin/inquiries/abc', { cookie })).status, 404);
    });

    test('notes are added with the admin as author', async () => {
      const cookie = await login(h);
      const { id } = await createInquiry(h);
      const res = await h.request(`/api/admin/inquiries/${id}/notes`, { body: { body: 'Called, left a voicemail.' }, cookie });
      assert.equal(res.status, 200);
      const detail = (await res.json()) as InquiryDetail;
      assert.equal(detail.notes.length, 1);
      assert.equal(detail.notes[0].author, 'Faith');
      assert.equal(detail.notes[0].body, 'Called, left a voicemail.');
      assert.equal((await h.request(`/api/admin/inquiries/${id}/notes`, { body: { body: '   ' }, cookie })).status, 400);
    });

    test('setting status to booked records an event and blocks the date on the calendar', async () => {
      const cookie = await login(h);
      const date = addDays(today(), 60);
      const { id } = await createInquiry(h, { date, space: 'indoor', name: 'Casey Booker', eventType: 'birthday-parties' });

      const res = await h.request(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: { status: 'booked' }, cookie });
      assert.equal(res.status, 200);
      const detail = (await res.json()) as InquiryDetail;
      assert.equal(detail.status, 'booked');
      assert.ok(detail.events.some((e) => e.kind === 'status' && e.detail.includes('Booked')));
      assert.ok(detail.events.some((e) => e.kind === 'block'));

      const blocks = (await (await h.request(`/api/admin/blocks?from=${date}&to=${date}`, { cookie })).json()) as CalendarBlock[];
      assert.equal(blocks.length, 1);
      assert.deepEqual(
        { kind: blocks[0].kind, space: blocks[0].space, label: blocks[0].label, inquiryId: blocks[0].inquiryId },
        { kind: 'booked', space: 'indoor', label: 'Casey Booker: Birthdays & milestones', inquiryId: id },
      );

      const avail = (await (await h.request(`/api/availability?from=${date}&to=${date}`)).json()) as AvailabilityResponse;
      assert.equal(avail.days[0].status, 'partial');
      assert.equal(avail.days[0].spaces.indoor, 'taken');

      // Idempotent: booking again does not add a second block.
      await h.request(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: { status: 'booked' }, cookie });
      const again = (await (await h.request(`/api/admin/blocks?from=${date}&to=${date}`, { cookie })).json()) as CalendarBlock[];
      assert.equal(again.length, 1);

      assert.equal((await h.request(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: { status: 'nope' }, cookie })).status, 400);
    });

    test('booking a date that is already blocked keeps the status and notes the clash', async () => {
      const cookie = await login(h);
      const date = addDays(today(), 61);
      await h.request('/api/admin/blocks', { body: { date, space: 'both', kind: 'closed', label: 'Church retreat' }, cookie });
      const { id } = await createInquiry(h, { date, space: 'outdoor' });
      const detail = (await (await h.request(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: { status: 'booked' }, cookie })).json()) as InquiryDetail;
      assert.equal(detail.status, 'booked');
      assert.ok(detail.events.some((e) => e.kind === 'block' && e.detail.includes('Church retreat')));
      const blocks = (await (await h.request(`/api/admin/blocks?from=${date}&to=${date}`, { cookie })).json()) as CalendarBlock[];
      assert.equal(blocks.length, 1);
    });

    test('CSV export is an attachment with formula cells neutralised', async () => {
      const cookie = await login(h);
      await createInquiry(h, { name: '=HYPERLINK("http://x.example","click")', message: '+SUM(A1:A2)' });
      const res = await h.request('/api/admin/export.csv', { cookie });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /text[/]csv/);
      assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="venue-inquiries-[0-9-]+[.]csv"/);
      const csv = await res.text();
      assert.ok(csv.startsWith('Reference,Status,Received'));
      assert.ok(csv.includes(`"'=HYPERLINK(""http://x.example"",""click"")"`), 'formula is quoted and prefixed');
      assert.ok(csv.includes("'+SUM(A1:A2)"));
      assert.ok(!/(^|,)=HYPERLINK/m.test(csv));
    });

    test('stats', async () => {
      const cookie = await login(h);
      const stats = (await (await h.request('/api/admin/stats', { cookie })).json()) as AdminStats;
      assert.deepEqual(Object.keys(stats.byStatus).sort(), ['archived', 'booked', 'contacted', 'declined', 'new', 'quoted', 'visit']);
      assert.ok(stats.byStatus.new >= 1);
      assert.ok(stats.byStatus.booked >= 1);
      assert.ok(stats.newThisWeek >= 1);
      assert.ok(stats.pipelineValue > 0);
      assert.ok(stats.bookedValue > 0);
      assert.ok(stats.upcomingBooked.some((b) => b.label.startsWith('Casey Booker')));
    });
  });

  describe('calendar blocks', () => {
    test('create, conflict 409, overlap rules, delete', async () => {
      const cookie = await login(h);
      const date = addDays(today(), 90);
      const created = await h.request('/api/admin/blocks', { body: { date, space: 'indoor', kind: 'held', label: 'Tentative' }, cookie });
      assert.equal(created.status, 201);
      const block = (await created.json()) as CalendarBlock;
      assert.equal(block.inquiryId, null);

      const clash = await h.request('/api/admin/blocks', { body: { date, space: 'both', kind: 'closed', label: '' }, cookie });
      assert.equal(clash.status, 409);
      const body = await clash.json();
      assert.equal(body.ok, false);
      assert.match(body.error, /already has a held block/);
      assert.equal((await h.request('/api/admin/blocks', { body: { date, space: 'indoor', kind: 'booked', label: '' }, cookie })).status, 409);

      const outdoor = await h.request('/api/admin/blocks', { body: { date, space: 'outdoor', kind: 'closed', label: 'Lawn work' }, cookie });
      assert.equal(outdoor.status, 201);

      assert.equal((await h.request('/api/admin/blocks', { body: { date: 'soon', space: 'indoor', kind: 'held' }, cookie })).status, 400);
      assert.equal((await h.request('/api/admin/blocks', { body: { date, space: 'indoor', kind: 'held', inquiryId: 999999 }, cookie })).status, 400);

      const del = await h.request(`/api/admin/blocks/${block.id}`, { method: 'DELETE', cookie });
      assert.equal(del.status, 200);
      assert.deepEqual(await del.json(), { ok: true });
      assert.equal((await h.request(`/api/admin/blocks/${block.id}`, { method: 'DELETE', cookie })).status, 404);
      assert.equal((await h.request('/api/admin/blocks', { body: { date, space: 'indoor', kind: 'held', label: '' }, cookie })).status, 201);
    });

    test('block range limits', async () => {
      const cookie = await login(h);
      assert.equal((await h.request(`/api/admin/blocks?from=${today()}&to=${addDays(today(), 401)}`, { cookie })).status, 400);
      assert.equal((await h.request('/api/admin/blocks', { cookie })).status, 200);
    });
  });

  describe('password change', () => {
    test('needs the current password, then ends other sessions', async () => {
      const mine = await login(h);
      const other = await login(h);
      const wrong = await h.request('/api/admin/password', { body: { current: 'not it', next: 'a brand new passphrase' }, cookie: mine });
      assert.equal(wrong.status, 400);
      assert.ok((await wrong.json()).fields.current);
      const short = await h.request('/api/admin/password', { body: { current: ADMIN_PASSWORD, next: 'short' }, cookie: mine });
      assert.equal(short.status, 400);
      assert.ok((await short.json()).fields.next);

      const ok = await h.request('/api/admin/password', { body: { current: ADMIN_PASSWORD, next: 'a brand new passphrase' }, cookie: mine });
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { ok: true });
      assert.equal((await h.request('/api/admin/session', { cookie: mine })).status, 200);
      assert.equal((await h.request('/api/admin/session', { cookie: other })).status, 401);

      const ip = freshIp();
      assert.equal((await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ip })).status, 401);
      assert.equal((await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: 'a brand new passphrase' }, ip })).status, 200);
    });
  });
});
