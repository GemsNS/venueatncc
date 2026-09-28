/**
 * The in-browser demo backend for the GitHub Pages build (PUBLIC_DEMO=true).
 *
 * A faithful twin of the API server: the same validation (src/shared/schemas.ts), availability
 * (availabilityFor), capacity rules, pricing (estimate), references, and CSV export, with data kept
 * in this browser's localStorage instead of SQLite. Nothing is ever sent anywhere.
 *
 * Storage: one JSON document under "ncc-demo-v1", re-read on every call so a booking tab and an
 * admin tab stay in step. When storage is blocked (private mode, disabled site data) or a write
 * fails, the backend keeps working in memory for the rest of the page's life.
 * The admin session is a flag in sessionStorage, so it ends when the tab closes.
 *
 * Import is side-effect free: nothing is read, seeded, or scheduled until the first call.
 */
import { availabilityFor } from '../../shared/availability';
import { capacityError } from '../../shared/capacity';
import { inquiriesToCsv } from '../../shared/csv';
import { formatLong, todayKey } from '../../shared/dates';
import { estimate } from '../../shared/pricing';
import { makeReference } from '../../shared/reference';
import { INQUIRY_STATUSES } from '../../shared/types';
import type {
  AdminStats,
  AdminUser,
  ApiError,
  CalendarBlock,
  DateKey,
  Inquiry,
  InquiryDetail,
  InquiryStatus,
  SpaceChoice,
} from '../../shared/types';
import { OTHER_EVENT, eventTypes } from '../../data/event-types';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_NAME, DEMO_ADMIN_PASSWORD } from './demo-credentials';
import { DEMO_DB_VERSION, blockLabelFor, buildSeed, eventLabel, timelineText, type DemoDb } from './demo-seed';
import type { VenueApi } from './types';

/**
 * The validation schemas are loaded on first use rather than imported. schemas.ts runs zod at
 * module level, which a bundler must keep, so a static import here would ship zod in every
 * production island that imports the API client, even though production drops demoApi itself.
 */
type Schemas = typeof import('../../shared/schemas');
const loadSchemas = (): Promise<Schemas> => import('../../shared/schemas');

export const DEMO_STORAGE_KEY = 'ncc-demo-v1';
export const DEMO_SESSION_KEY = 'ncc-demo-session';

const SPACE_PHRASE: Record<SpaceChoice, string> = {
  indoor: 'the indoor hall',
  outdoor: 'the outdoor space',
  both: 'the indoor hall and outdoor space',
};

/**
 * Every message this backend can return. The API server should use the same wording
 * so the demo and production read identically.
 */
export const demoMessages = {
  invalid: 'Check the highlighted fields and try again.',
  honeypot: 'We could not send your request. Call us and we will help.',
  formExpired: 'This form expired. Reload the page and try again.',
  pastDate: 'That date has passed. Choose another.',
  unknownEventType: 'Choose the kind of event.',
  badRange: 'Choose a valid date range.',
  signedOut: 'Your session ended. Sign in again.',
  badLogin: 'That email and password do not match.',
  inquiryNotFound: 'We could not find that inquiry.',
  blockNotFound: 'We could not find that calendar block.',
  passwordDemo: 'Password changes are turned off in the demo.',
  blockConflict: (date: DateKey, space: SpaceChoice) => `${formatLong(date)} already has a calendar block for ${SPACE_PHRASE[space]}.`,
};

const OPEN_STATUSES: InquiryStatus[] = ['new', 'contacted', 'visit', 'quoted'];
const UPCOMING_BOOKED_LIMIT = 5;
const WEEK_MS = 7 * 24 * 3600 * 1000;

// ---------------------------------------------------------------------------------------------
// Latency

let latencyMin = 200;
let latencyMax = 500;

/** Simulated network latency in milliseconds (default 200 to 500). Tests set it to 0. */
export function setDemoLatency(minMs: number, maxMs: number = minMs): void {
  latencyMin = Math.max(0, minMs);
  latencyMax = Math.max(latencyMin, maxMs);
}

function delay(): Promise<void> {
  const ms = latencyMin + Math.random() * (latencyMax - latencyMin);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------------------------
// Storage (localStorage with an in-memory fallback)

let memoryDb: DemoDb | null = null;
let memorySession = false;
let localBroken = false;
let sessionBroken = false;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function localStore(): Storage | null {
  if (localBroken) return null;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function sessionStore(): Storage | null {
  if (sessionBroken) return null;
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function isDb(value: unknown): value is DemoDb {
  const db = value as DemoDb | null;
  return (
    !!db &&
    typeof db === 'object' &&
    db.v === DEMO_DB_VERSION &&
    Array.isArray(db.inquiries) &&
    Array.isArray(db.blocks) &&
    typeof db.nextInquiryId === 'number' &&
    typeof db.nextBlockId === 'number' &&
    typeof db.nextEntryId === 'number'
  );
}

function readDb(): DemoDb | null {
  const store = localStore();
  if (store) {
    try {
      const raw = store.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isDb(parsed)) return parsed;
      }
      // Nothing stored yet, or an older or damaged copy: let load() seed a fresh one.
      return null;
    } catch {
      localBroken = true;
    }
  }
  return memoryDb ? clone(memoryDb) : null;
}

function writeDb(db: DemoDb): void {
  memoryDb = clone(db);
  const store = localStore();
  if (!store) return;
  try {
    store.setItem(DEMO_STORAGE_KEY, JSON.stringify(db));
  } catch {
    localBroken = true;
  }
}

/** The current database, seeded on first use. */
function load(): DemoDb {
  const existing = readDb();
  if (existing) return existing;
  const seeded = buildSeed();
  writeDb(seeded);
  return clone(seeded);
}

/** Read, change, and write back in one step. */
function mutate<T>(fn: (db: DemoDb) => T): T {
  const db = load();
  const result = fn(db);
  writeDb(db);
  return result;
}

function isSignedIn(): boolean {
  const store = sessionStore();
  if (store) {
    try {
      return store.getItem(DEMO_SESSION_KEY) === '1';
    } catch {
      sessionBroken = true;
    }
  }
  return memorySession;
}

function setSignedIn(on: boolean): void {
  memorySession = on;
  const store = sessionStore();
  if (!store) return;
  try {
    if (on) store.setItem(DEMO_SESSION_KEY, '1');
    else store.removeItem(DEMO_SESSION_KEY);
  } catch {
    sessionBroken = true;
  }
}

/** Clear everything the demo stored and start again from fresh seed data. Keeps the admin signed in. */
export async function resetDemoData(): Promise<void> {
  const store = localStore();
  if (store) {
    try {
      store.removeItem(DEMO_STORAGE_KEY);
    } catch {
      localBroken = true;
    }
  }
  memoryDb = null;
  writeDb(buildSeed());
  await delay();
}

// ---------------------------------------------------------------------------------------------
// Helpers

const fail = (error: string, fields?: Record<string, string>): ApiError => (fields ? { ok: false, error, fields } : { ok: false, error });

const adminUser = (): AdminUser => ({ id: 1, email: DEMO_ADMIN_EMAIL, name: DEMO_ADMIN_NAME });

const blank = (value: string | undefined): string | undefined => (value && value.trim() !== '' ? value : undefined);

const isKnownEventType = (slug: string) => slug === OTHER_EVENT.slug || eventTypes.some((e) => e.slug === slug);

/** Whether two space choices overlap: 'both' overlaps everything. */
const overlaps = (a: SpaceChoice, b: SpaceChoice) => a === 'both' || b === 'both' || a === b;

/** The part of the venue two overlapping choices share. */
const sharedSpace = (existing: SpaceChoice, requested: SpaceChoice): SpaceChoice =>
  existing === 'both' ? requested : requested === 'both' ? existing : requested;

function conflictFor(db: DemoDb, date: DateKey, space: SpaceChoice, ignoreId?: number): CalendarBlock | undefined {
  return db.blocks.find((b) => b.date === date && b.id !== ignoreId && overlaps(b.space, space));
}

function toInquiry(detail: InquiryDetail): Inquiry {
  const copy: Partial<InquiryDetail> = { ...detail };
  delete copy.estimate;
  delete copy.notes;
  delete copy.events;
  return copy as Inquiry;
}

const byCreatedDesc = (a: Inquiry, b: Inquiry) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id);
const byDate = (a: CalendarBlock, b: CalendarBlock) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);

function detailOf(record: InquiryDetail): InquiryDetail {
  const out = clone(record);
  out.notes.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id));
  out.events.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id));
  return out;
}

function addEvent(db: DemoDb, record: InquiryDetail, kind: InquiryDetail['events'][number]['kind'], detail: string, at: string): void {
  record.events.push({ id: db.nextEntryId++, kind, detail, createdAt: at });
}

/** Tokens look like demo.<issued, base 36>.<16 hex digits>. */
const TOKEN_PATTERN = /^demo\.[0-9a-z]+\.[0-9a-f]{16}$/;

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** When an inquiry is marked booked: make sure it is on the calendar as booked. */
function ensureBookedBlock(db: DemoDb, record: InquiryDetail, at: string): void {
  const linked = db.blocks.find((b) => b.inquiryId === record.id);
  if (linked) {
    if (linked.kind !== 'booked') {
      linked.kind = 'booked';
      addEvent(db, record, 'block', timelineText.blockUpgraded(linked.date), at);
    }
    return;
  }
  const conflict = conflictFor(db, record.date, record.space);
  if (conflict) {
    addEvent(db, record, 'block', timelineText.blockSkipped(demoMessages.blockConflict(record.date, sharedSpace(conflict.space, record.space))), at);
    return;
  }
  db.blocks.push({
    id: db.nextBlockId++,
    date: record.date,
    space: record.space,
    kind: 'booked',
    label: blockLabelFor(record),
    inquiryId: record.id,
    createdAt: at,
  });
  addEvent(db, record, 'block', timelineText.blockAdded('booked', record.date), at);
}

/** Run an admin call after the simulated latency, or refuse when signed out. */
async function admin<T>(fn: (schemas: Schemas) => T | ApiError): Promise<T | ApiError> {
  const schemas = await loadSchemas();
  await delay();
  if (!isSignedIn()) return fail(demoMessages.signedOut);
  return fn(schemas);
}

// ---------------------------------------------------------------------------------------------
// The API

export const demoApi: VenueApi = {
  demo: true,

  async availability(from, to) {
    const { availabilityQuerySchema, fieldErrors } = await loadSchemas();
    await delay();
    const parsed = availabilityQuerySchema.safeParse({ from, to });
    if (!parsed.success) return fail(demoMessages.badRange, fieldErrors(parsed.error));
    if (parsed.data.to < parsed.data.from) return fail(demoMessages.badRange);
    const db = load();
    return { from: parsed.data.from, to: parsed.data.to, days: availabilityFor(parsed.data.from, parsed.data.to, db.blocks) };
  },

  async formToken() {
    await delay();
    return { token: `demo.${Date.now().toString(36)}.${randomHex(8)}` };
  },

  async submitInquiry(input) {
    const { inquiryInputSchema, fieldErrors } = await loadSchemas();
    await delay();
    // Honeypot: people never see this field, so anything in it came from a bot.
    const honeypot = (input as { website?: unknown } | null)?.website;
    if (typeof honeypot === 'string' && honeypot.trim() !== '') return fail(demoMessages.honeypot);

    const parsed = inquiryInputSchema.safeParse(input);
    if (!parsed.success) return fail(demoMessages.invalid, fieldErrors(parsed.error));
    const data = parsed.data;

    if (!TOKEN_PATTERN.test(data.formToken)) return fail(demoMessages.formExpired);
    if (!isKnownEventType(data.eventType)) return fail(demoMessages.unknownEventType, { eventType: demoMessages.unknownEventType });

    const today = todayKey();
    if (data.date < today) return fail(demoMessages.pastDate, { date: demoMessages.pastDate });
    if (data.altDate && data.altDate < today) return fail(demoMessages.pastDate, { altDate: demoMessages.pastDate });

    const tooMany = capacityError(data.space, data.guests);
    if (tooMany) return fail(tooMany, { guests: tooMany });

    const est = estimate({ date: data.date, space: data.space, hours: data.hours, eventType: data.eventType });

    return mutate((db) => {
      let reference = makeReference((n) => crypto.getRandomValues(new Uint8Array(n)));
      while (db.inquiries.some((i) => i.reference === reference)) {
        reference = makeReference((n) => crypto.getRandomValues(new Uint8Array(n)));
      }
      const now = new Date().toISOString();
      const record: InquiryDetail = {
        id: db.nextInquiryId++,
        reference,
        status: 'new',
        eventType: data.eventType,
        eventTypeOther: data.eventType === 'other' ? blank(data.eventTypeOther) : undefined,
        date: data.date,
        altDate: blank(data.altDate),
        startTime: data.startTime,
        hours: data.hours,
        space: data.space,
        guests: data.guests,
        name: data.name,
        email: data.email,
        phone: blank(data.phone),
        contactPreference: data.contactPreference,
        message: blank(data.message),
        wantsVisit: data.wantsVisit,
        visitNotes: data.wantsVisit ? blank(data.visitNotes) : undefined,
        servingAlcohol: data.servingAlcohol,
        estimateTotal: est.total,
        createdAt: now,
        updatedAt: now,
        estimate: est,
        notes: [],
        events: [],
      };
      addEvent(db, record, 'created', timelineText.created, now);
      addEvent(db, record, 'email', timelineText.demoEmail, now);
      db.inquiries.push(record);
      return { ok: true as const, reference, estimate: est, demo: true };
    });
  },

  admin: {
    async session() {
      await delay();
      return isSignedIn() ? adminUser() : null;
    },

    async login(email, password) {
      const { loginSchema, fieldErrors } = await loadSchemas();
      await delay();
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) return fail(demoMessages.invalid, fieldErrors(parsed.error));
      const emailOk = parsed.data.email.trim().toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase();
      if (!emailOk || parsed.data.password !== DEMO_ADMIN_PASSWORD) return fail(demoMessages.badLogin);
      setSignedIn(true);
      return adminUser();
    },

    async logout() {
      await delay();
      setSignedIn(false);
    },

    stats: () =>
      admin<AdminStats>(() => {
        const db = load();
        const today = todayKey();
        const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();
        const byStatus = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s.id, 0])) as Record<InquiryStatus, number>;
        let newThisWeek = 0;
        let pipelineValue = 0;
        let bookedValue = 0;
        for (const i of db.inquiries) {
          byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
          if (i.createdAt >= weekAgo) newThisWeek += 1;
          if (OPEN_STATUSES.includes(i.status)) pipelineValue += i.estimateTotal;
          if (i.status === 'booked') bookedValue += i.estimateTotal;
        }
        const upcomingBooked = db.blocks
          .filter((b) => b.kind === 'booked' && b.date >= today)
          .sort(byDate)
          .slice(0, UPCOMING_BOOKED_LIMIT)
          .map((b) => ({ date: b.date, label: b.label, space: b.space }));
        return { byStatus, newThisWeek, upcomingBooked, pipelineValue, bookedValue };
      }),

    listInquiries: (query) =>
      admin<Inquiry[]>(() => {
        const db = load();
        const status = query?.status ?? 'all';
        const needle = (query?.q ?? '').trim().toLowerCase();
        return db.inquiries
          .filter((i) => {
            if (status === 'open') return OPEN_STATUSES.includes(i.status);
            if (status !== 'all' && INQUIRY_STATUSES.some((s) => s.id === status)) return i.status === status;
            return true;
          })
          .filter((i) => {
            if (!needle) return true;
            const haystack = [i.name, i.email, i.reference, i.eventType, eventLabel(i.eventType, i.eventTypeOther)];
            return haystack.some((value) => value.toLowerCase().includes(needle));
          })
          .map(toInquiry)
          .sort(byCreatedDesc);
      }),

    getInquiry: (id) =>
      admin<InquiryDetail>(() => {
        const record = load().inquiries.find((i) => i.id === id);
        return record ? detailOf(record) : fail(demoMessages.inquiryNotFound);
      }),

    setStatus: (id, status) =>
      admin<InquiryDetail>(({ statusUpdateSchema, fieldErrors }) => {
        const parsed = statusUpdateSchema.safeParse({ status });
        if (!parsed.success) return fail(demoMessages.invalid, fieldErrors(parsed.error));
        const next = parsed.data.status as InquiryStatus;
        return mutate((db) => {
          const record = db.inquiries.find((i) => i.id === id);
          if (!record) return fail(demoMessages.inquiryNotFound);
          const now = new Date().toISOString();
          if (record.status !== next) {
            addEvent(db, record, 'status', timelineText.status(record.status, next), now);
            record.status = next;
            record.updatedAt = now;
          }
          if (next === 'booked') ensureBookedBlock(db, record, now);
          return detailOf(record);
        });
      }),

    addNote: (id, body) =>
      admin<InquiryDetail>(({ noteInputSchema, fieldErrors }) => {
        const parsed = noteInputSchema.safeParse({ body });
        if (!parsed.success) return fail(demoMessages.invalid, fieldErrors(parsed.error));
        return mutate((db) => {
          const record = db.inquiries.find((i) => i.id === id);
          if (!record) return fail(demoMessages.inquiryNotFound);
          const now = new Date().toISOString();
          record.notes.push({ id: db.nextEntryId++, body: parsed.data.body, author: DEMO_ADMIN_NAME, createdAt: now });
          addEvent(db, record, 'note', timelineText.note(DEMO_ADMIN_NAME), now);
          record.updatedAt = now;
          return detailOf(record);
        });
      }),

    listBlocks: (from, to) =>
      admin<CalendarBlock[]>(({ availabilityQuerySchema, fieldErrors }) => {
        const parsed = availabilityQuerySchema.safeParse({ from, to });
        if (!parsed.success) return fail(demoMessages.badRange, fieldErrors(parsed.error));
        return load()
          .blocks.filter((b) => b.date >= parsed.data.from && b.date <= parsed.data.to)
          .sort(byDate);
      }),

    createBlock: (input) =>
      admin<CalendarBlock>(({ blockInputSchema, fieldErrors }) => {
        const parsed = blockInputSchema.safeParse(input);
        if (!parsed.success) return fail(demoMessages.invalid, fieldErrors(parsed.error));
        const data = parsed.data;
        return mutate((db) => {
          const conflict = conflictFor(db, data.date, data.space);
          if (conflict) return fail(demoMessages.blockConflict(data.date, sharedSpace(conflict.space, data.space)));
          const linked = data.inquiryId ? db.inquiries.find((i) => i.id === data.inquiryId) : undefined;
          if (data.inquiryId && !linked) return fail(demoMessages.inquiryNotFound);
          const now = new Date().toISOString();
          const block: CalendarBlock = {
            id: db.nextBlockId++,
            date: data.date,
            space: data.space,
            kind: data.kind,
            label: data.label || (linked ? blockLabelFor(linked) : ''),
            inquiryId: linked ? linked.id : null,
            createdAt: now,
          };
          db.blocks.push(block);
          if (linked) {
            addEvent(db, linked, 'block', timelineText.blockAdded(block.kind, block.date), now);
            linked.updatedAt = now;
          }
          return { ...block };
        });
      }),

    deleteBlock: (id) =>
      admin<{ ok: true }>(() =>
        mutate((db) => {
          const index = db.blocks.findIndex((b) => b.id === id);
          if (index < 0) return fail(demoMessages.blockNotFound);
          const [removed] = db.blocks.splice(index, 1);
          const linked = removed.inquiryId ? db.inquiries.find((i) => i.id === removed.inquiryId) : undefined;
          if (linked) {
            const now = new Date().toISOString();
            addEvent(db, linked, 'block', timelineText.blockRemoved(removed.date), now);
            linked.updatedAt = now;
          }
          return { ok: true as const };
        }),
      ),

    exportCsv: () =>
      admin<Blob>(() => {
        const rows = load().inquiries.map(toInquiry).sort(byCreatedDesc);
        return new Blob([inquiriesToCsv(rows)], { type: 'text/csv' });
      }),

    changePassword: () => admin<{ ok: true }>(() => fail(demoMessages.passwordDemo)),
  },
};
