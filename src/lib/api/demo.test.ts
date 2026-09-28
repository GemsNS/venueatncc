/**
 * Tests for the in-browser demo backend. Run with:
 *   npx tsx --test src/lib/api/demo.test.ts
 * Installs minimal localStorage/sessionStorage polyfills; demo.ts only touches storage when called.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventTypes } from '../../data/event-types';
import { CAPACITY } from '../../shared/capacity';
import { CSV_COLUMNS } from '../../shared/csv';
import { addDays, dayOfWeek, todayKey } from '../../shared/dates';
import { estimate } from '../../shared/pricing';
import { referencePattern } from '../../shared/reference';
import { INQUIRY_STATUSES } from '../../shared/types';
import type { InquiryInput, SpaceChoice } from '../../shared/types';
import { DEMO_STORAGE_KEY, demoApi as api, demoMessages, resetDemoData, setDemoLatency } from './demo';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from './demo-credentials';
import { blockLabelFor } from './demo-seed';
import { isError, type Result } from './types';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  } as Storage;
}

const local = memoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true, writable: true });

setDemoLatency(0);

/** Unwrap a result, failing the test with the API's message when it is an error. */
function ok<T>(result: Result<T>): T {
  if (isError(result)) assert.fail(`Expected success, got: ${result.error}`);
  return result as T;
}

const today = todayKey();
const future = (days: number) => addDays(today, days);
/** A Wednesday far enough out that the seed never blocks it. */
const quietWednesday = (() => {
  let d = future(200);
  while (dayOfWeek(d) !== 3) d = addDays(d, 1);
  return d;
})();

async function validInput(overrides: Partial<InquiryInput> = {}): Promise<InquiryInput> {
  const { token } = ok(await api.formToken());
  return {
    eventType: 'birthday-parties',
    date: quietWednesday,
    startTime: '18:00',
    hours: 4,
    space: 'indoor',
    guests: 50,
    name: 'Test Person',
    email: 'test.person@example.com',
    contactPreference: 'email',
    wantsVisit: false,
    servingAlcohol: false,
    formToken: token,
    website: '',
    ...overrides,
  };
}

test('importing is side-effect free; the seed appears on first use', async () => {
  assert.equal(local.getItem(DEMO_STORAGE_KEY), null);
  ok(await api.availability(today, future(6)));
  assert.ok(local.getItem(DEMO_STORAGE_KEY), 'seed stored after the first call');
});

test('availability has one day per date with per-space state', async () => {
  const from = today;
  const to = future(60);
  const res = ok(await api.availability(from, to));
  assert.equal(res.from, from);
  assert.equal(res.to, to);
  assert.equal(res.days.length, 61);
  assert.equal(res.days[0].date, from);
  assert.equal(res.days[60].date, to);
  for (const day of res.days) {
    assert.ok(['open', 'partial', 'booked', 'past'].includes(day.status));
    assert.ok(['free', 'taken'].includes(day.spaces.indoor));
    assert.ok(['free', 'taken'].includes(day.spaces.outdoor));
  }
  assert.ok(res.days.some((d) => d.status === 'partial'), 'seed has a partly taken day');
  assert.ok(res.days.some((d) => d.status === 'booked'), 'seed has a fully taken day');

  const past = ok(await api.availability(addDays(today, -3), today));
  assert.equal(past.days[0].status, 'past');

  const bad = await api.availability('2026-02-30', today);
  assert.ok(isError(bad));
});

test('submitInquiry happy path returns a reference and the rate card estimate', async () => {
  const input = await validInput({ phone: '', message: '  Looking forward to it.  ' });
  const res = ok(await api.submitInquiry(input));
  assert.equal(res.ok, true);
  assert.equal(res.demo, true);
  assert.match(res.reference, referencePattern);
  assert.deepEqual(res.estimate, estimate({ date: input.date, space: input.space, hours: input.hours, eventType: input.eventType }));
});

test('submitInquiry rejects a filled honeypot', async () => {
  const res = await api.submitInquiry(await validInput({ website: 'https://spam.example.com' }));
  assert.ok(isError(res));
  assert.equal(res.error, demoMessages.honeypot);
});

test('submitInquiry enforces capacity, past dates, validation, and the form token', async () => {
  const tooBig = await api.submitInquiry(await validInput({ space: 'indoor', guests: CAPACITY.indoor + 20 }));
  assert.ok(isError(tooBig));
  assert.ok(tooBig.fields?.guests, 'capacity error is attached to guests');
  assert.match(tooBig.error, new RegExp(String(CAPACITY.indoor)));

  const tooBigOutdoor = await api.submitInquiry(await validInput({ space: 'both', guests: CAPACITY.both + 1 }));
  assert.ok(isError(tooBigOutdoor));

  const past = await api.submitInquiry(await validInput({ date: addDays(today, -1) }));
  assert.ok(isError(past));
  assert.equal(past.fields?.date, demoMessages.pastDate);

  const invalid = await api.submitInquiry(await validInput({ email: 'not-an-email', name: 'A' }));
  assert.ok(isError(invalid));
  assert.equal(invalid.error, demoMessages.invalid);
  assert.ok(invalid.fields?.email);
  assert.ok(invalid.fields?.name);

  const forged = await api.submitInquiry(await validInput({ formToken: 'x'.repeat(20) }));
  assert.ok(isError(forged));
  assert.equal(forged.error, demoMessages.formExpired);
});

test('admin calls need a session; login fails generically and then succeeds', async () => {
  assert.equal(await api.admin.session(), null);
  const locked = await api.admin.stats();
  assert.ok(isError(locked));
  assert.equal(locked.error, demoMessages.signedOut);

  const wrongPassword = await api.admin.login(DEMO_ADMIN_EMAIL, 'nope');
  assert.ok(isError(wrongPassword));
  assert.equal(wrongPassword.error, demoMessages.badLogin);
  const wrongEmail = await api.admin.login('someone@example.com', DEMO_ADMIN_PASSWORD);
  assert.ok(isError(wrongEmail));
  assert.equal(wrongEmail.error, demoMessages.badLogin);
  assert.equal(await api.admin.session(), null);

  const user = ok(await api.admin.login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD));
  assert.equal(user.email, DEMO_ADMIN_EMAIL);
  assert.deepEqual(await api.admin.session(), user);
});

test('seed data covers every status, event type, and space, within capacity', async () => {
  const all = ok(await api.admin.listInquiries({ status: 'all' }));
  const seeded = all.filter((i) => i.email !== 'test.person@example.com');
  assert.ok(seeded.length >= 8 && seeded.length <= 10, `8 to 10 seeded inquiries, got ${seeded.length}`);
  for (const s of INQUIRY_STATUSES) assert.ok(seeded.some((i) => i.status === s.id), `status ${s.id}`);
  for (const e of eventTypes) assert.ok(seeded.some((i) => i.eventType === e.slug), `event type ${e.slug}`);
  for (const space of ['indoor', 'outdoor', 'both'] as SpaceChoice[]) assert.ok(seeded.some((i) => i.space === space), `space ${space}`);
  for (const i of seeded) {
    assert.match(i.reference, referencePattern);
    assert.match(i.email, /@example\.com$/);
    assert.ok(i.guests >= 1 && i.guests <= CAPACITY[i.space], `${i.name} fits ${i.space}`);
    const detail = ok(await api.admin.getInquiry(i.id));
    assert.equal(detail.estimate.total, i.estimateTotal);
    assert.equal(i.estimateTotal, estimate({ date: i.date, space: i.space, hours: i.hours, eventType: i.eventType }).total);
    assert.ok(detail.events.length >= 2);
  }
  assert.ok(seeded.some((i) => i.createdAt > new Date(Date.now() - 7 * 86400000).toISOString()));

  const blocks = ok(await api.admin.listBlocks(today, future(120)));
  assert.ok(blocks.length >= 5 && blocks.length <= 7, `5 to 7 upcoming blocks, got ${blocks.length}`);
  assert.ok(blocks.some((b) => b.kind === 'booked'));
  assert.ok(blocks.some((b) => b.kind === 'held'));
  for (const b of blocks) {
    assert.ok([0, 5, 6].includes(dayOfWeek(b.date)), `${b.date} is on a weekend`);
    if (b.inquiryId) {
      const linked = all.find((i) => i.id === b.inquiryId);
      assert.ok(linked);
      assert.equal(linked.date, b.date);
      assert.equal(linked.space, b.space);
    }
  }

  const stats = ok(await api.admin.stats());
  for (const s of INQUIRY_STATUSES) assert.equal(typeof stats.byStatus[s.id], 'number');
  assert.ok(stats.newThisWeek >= 1);
  assert.ok(stats.pipelineValue > 0);
  assert.ok(stats.bookedValue > 0);
  assert.ok(stats.upcomingBooked.length >= 1);
});

test('the submitted inquiry is stored as new and found by filters and search', async () => {
  const open = ok(await api.admin.listInquiries({ status: 'open' }));
  assert.ok(open.every((i) => ['new', 'contacted', 'visit', 'quoted'].includes(i.status)));
  const mine = ok(await api.admin.listInquiries({ status: 'new', q: 'TEST.PERSON' }));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, 'new');
  assert.equal(mine[0].phone, undefined, 'blank optional fields are dropped');
  assert.equal(mine[0].message, 'Looking forward to it.', 'text is trimmed');
  const byRef = ok(await api.admin.listInquiries({ q: mine[0].reference.toLowerCase() }));
  assert.equal(byRef.length, 1);
  const byEventName = ok(await api.admin.listInquiries({ q: 'repasts' }));
  assert.ok(byEventName.length >= 1);
  assert.ok(isError(await api.admin.getInquiry(99999)));
});

test('marking an inquiry booked adds a booked block once, and upgrades a linked hold', async () => {
  const all = ok(await api.admin.listInquiries({ status: 'all' }));
  const blocks = ok(await api.admin.listBlocks(today, future(365)));
  const covers = (a: SpaceChoice, b: SpaceChoice) => a === 'both' || b === 'both' || a === b;
  const candidate = all.find(
    (i) =>
      i.email !== 'test.person@example.com' &&
      i.status !== 'booked' &&
      i.date >= today &&
      !blocks.some((b) => b.inquiryId === i.id || (b.date === i.date && covers(b.space, i.space))),
  );
  assert.ok(candidate, 'a seeded inquiry with a free date');

  const detail = ok(await api.admin.setStatus(candidate.id, 'booked'));
  assert.equal(detail.status, 'booked');
  assert.ok(detail.events.some((e) => e.kind === 'status'));
  assert.ok(detail.events.some((e) => e.kind === 'block'));

  const after = ok(await api.admin.listBlocks(candidate.date, candidate.date));
  const created = after.filter((b) => b.inquiryId === candidate.id);
  assert.equal(created.length, 1);
  assert.equal(created[0].kind, 'booked');
  assert.equal(created[0].space, candidate.space);
  assert.equal(created[0].label, blockLabelFor(candidate));

  ok(await api.admin.setStatus(candidate.id, 'booked'));
  const again = ok(await api.admin.listBlocks(candidate.date, candidate.date));
  assert.equal(again.filter((b) => b.inquiryId === candidate.id).length, 1, 'no duplicate block');

  const hold = blocks.find((b) => b.kind === 'held' && b.inquiryId);
  assert.ok(hold, 'the seed has a held block linked to an inquiry');
  ok(await api.admin.setStatus(hold.inquiryId as number, 'booked'));
  const upgraded = ok(await api.admin.listBlocks(hold.date, hold.date)).find((b) => b.id === hold.id);
  assert.equal(upgraded?.kind, 'booked');

  const badStatus = await api.admin.setStatus(candidate.id, 'nope' as never);
  assert.ok(isError(badStatus));
});

test('notes are added to the inquiry timeline', async () => {
  const [first] = ok(await api.admin.listInquiries({ status: 'all' }));
  const detail = ok(await api.admin.addNote(first.id, '  Called back, left a message.  '));
  assert.equal(detail.notes.at(-1)?.body, 'Called back, left a message.');
  assert.ok(detail.events.some((e) => e.kind === 'note'));
  const empty = await api.admin.addNote(first.id, '   ');
  assert.ok(isError(empty));
  assert.ok(empty.fields?.body);
});

test('createBlock rejects a date whose space is already blocked', async () => {
  const blocks = ok(await api.admin.listBlocks(today, future(365)));
  const taken = blocks[0];
  const clash = await api.admin.createBlock({ date: taken.date, space: 'both', kind: 'held', label: 'Clash' });
  assert.ok(isError(clash));
  assert.match(clash.error, /already has a calendar block/);

  const created = ok(await api.admin.createBlock({ date: quietWednesday, space: 'outdoor', kind: 'closed', label: 'Maintenance' }));
  assert.equal(created.label, 'Maintenance');
  assert.equal(created.inquiryId, null);
  const sameSpace = await api.admin.createBlock({ date: quietWednesday, space: 'outdoor', kind: 'held', label: '' });
  assert.ok(isError(sameSpace));
  const otherSpace = ok(await api.admin.createBlock({ date: quietWednesday, space: 'indoor', kind: 'held', label: '' }));

  const day = ok(await api.availability(quietWednesday, quietWednesday)).days[0];
  assert.equal(day.status, 'booked');

  ok(await api.admin.deleteBlock(created.id));
  ok(await api.admin.deleteBlock(otherSpace.id));
  assert.ok(isError(await api.admin.deleteBlock(created.id)));
  const freed = ok(await api.availability(quietWednesday, quietWednesday)).days[0];
  assert.equal(freed.status, 'open');
});

test('exportCsv returns a text/csv Blob that starts with the shared header', async () => {
  const blob = ok(await api.admin.exportCsv());
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'text/csv');
  const text = await blob.text();
  const lines = text.split(String.fromCharCode(13, 10));
  assert.equal(lines[0], CSV_COLUMNS.map((c) => c.label).join(','));
  const all = ok(await api.admin.listInquiries({ status: 'all' }));
  assert.equal(lines.filter((l) => l.length > 0).length, all.length + 1);
});

test('password changes are turned off in the demo', async () => {
  const res = await api.admin.changePassword('venue-demo', 'a much longer password');
  assert.ok(isError(res));
  assert.equal(res.error, 'Password changes are turned off in the demo.');
});

test('resetDemoData restores the seed and keeps the session', async () => {
  await resetDemoData();
  const all = ok(await api.admin.listInquiries({ status: 'all' }));
  assert.ok(!all.some((i) => i.email === 'test.person@example.com'));
  assert.ok(all.length >= 8 && all.length <= 10);
  assert.ok(await api.admin.session());
});

test('stored data from more than two weeks ago is replaced with a current seed', async () => {
  const stale = JSON.parse(local.getItem(DEMO_STORAGE_KEY) as string);
  stale.seededOn = addDays(today, -30);
  stale.inquiries = [];
  local.setItem(DEMO_STORAGE_KEY, JSON.stringify(stale));
  const all = ok(await api.admin.listInquiries({ status: 'all' }));
  assert.ok(all.length >= 8, 'reseeded');
  assert.equal(JSON.parse(local.getItem(DEMO_STORAGE_KEY) as string).seededOn, today);

  const recent = JSON.parse(local.getItem(DEMO_STORAGE_KEY) as string);
  recent.seededOn = addDays(today, -3);
  recent.inquiries = recent.inquiries.slice(0, 2);
  local.setItem(DEMO_STORAGE_KEY, JSON.stringify(recent));
  assert.equal(ok(await api.admin.listInquiries({ status: 'all' })).length, 2, 'recent data is kept');
  await resetDemoData();
});

test('logout ends the session', async () => {
  await api.admin.logout();
  assert.equal(await api.admin.session(), null);
  assert.ok(isError(await api.admin.listInquiries({})));
});

test('keeps working in memory when storage is unavailable', async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError: storage is disabled');
    },
  });
  const res = ok(await api.availability(today, future(13)));
  assert.equal(res.days.length, 14);
  const created = ok(await api.submitInquiry(await validInput()));
  assert.match(created.reference, referencePattern);
});

test('simulated latency is between 200 and 500 ms by default', async () => {
  setDemoLatency(200, 500);
  const started = Date.now();
  await api.formToken();
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 190 && elapsed <= 1500, `took ${elapsed} ms`);
  setDemoLatency(0);
});
