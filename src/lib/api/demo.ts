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
import { daysBetween, formatLong, todayKey } from '../../shared/dates';
import { estimateWithRates } from '../../shared/rate-card';
import { finishDraft, pickDraftInquiry, templateDraft, type DraftInput } from '../../shared/draft';
import { site } from '../../data/site';
import { makeReference } from '../../shared/reference';
import { INQUIRY_STATUSES, SPACE_NAMES, spaceFromParts, spaceParts, spacesOverlap } from '../../shared/types';
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
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_NAME, DEMO_ADMIN_PASSWORD } from './demo-credentials';
import { DEMO_DB_VERSION, blockLabelFor, buildSeed, eventLabel, timelineText, type DemoDb } from './demo-seed';
import { DEMO_MAIL_STATUS, addSent, replySubject, replyTo, seedMail, threadList, threadOf, unreadCount, type DemoMail } from './demo-mail';
import type { MailDraftRequest, VenueApi } from './types';

/**
 * The validation schemas are loaded on first use rather than imported. schemas.ts runs zod at
 * module level, which a bundler must keep, so a static import here would ship zod in every
 * production island that imports the API client, even though production drops demoApi itself.
 */
type Schemas = typeof import('../../shared/schemas');
const loadSchemas = (): Promise<Schemas> => import('../../shared/schemas');

export const DEMO_STORAGE_KEY = 'ncc-demo-v1';
export const DEMO_SESSION_KEY = 'ncc-demo-session';

/**
 * Every message this backend can return. The API server should use the same wording
 * so the demo and production read identically.
 */
export const demoMessages = {
  /** More than one field is wrong (with one, that field's own message is the error). */
  invalid: 'Check the highlighted fields.',
  honeypot: 'We could not send your request. Call us and we will help.',
  formExpired: 'This form has expired. Refresh the page and send your request again.',
  pastDate: 'Choose a date that has not passed.',
  pastAltDate: 'Choose an alternate date that has not passed.',
  /** The same words as DATE_TOO_FAR and ALT_DATE_TOO_FAR in shared/schemas.ts (not imported: see loadSchemas). */
  tooFar: `That date is not open for online requests yet. Call us at ${site.contact.phone} and we will help.`,
  altTooFar: `That alternate date is not open for online requests yet. Call us at ${site.contact.phone} and we will help.`,
  badRange: 'Choose a valid date range.',
  signedOut: 'Your session ended. Sign in again.',
  badLogin: 'That email and password do not match.',
  inquiryNotFound: 'We could not find that inquiry.',
  blockNotFound: 'We could not find that calendar block.',
  passwordDemo: 'Password changes are turned off in the demo.',
  mailNotFound: 'That email was not found.',
  rewriteDemo: 'The server does not rewrite in the demo. Press Tidy, or use Chrome on a computer for its built-in writer.',
  draftNeedsContext: 'Say in a few words what the email should say, then press Draft.',
  nothingToRewrite: 'Write something to rewrite first.',
  nothingToChange: 'Nothing to change.',
  blockConflict: (date: DateKey, space: SpaceChoice) => `${formatLong(date)} already has a calendar block for ${SPACE_NAMES[space]}.`,
  /** Mark Booked refused because another block is in the way (the server's 409). */
  bookClash: timelineText.booked.clash,
};

/** The server's rule for a validation failure: one field's own message, or a general one. */
function invalid(fields: Record<string, string>): ApiError {
  const messages = Object.values(fields);
  return fail(messages.length === 1 ? messages[0] : demoMessages.invalid, fields);
}

const OPEN_STATUSES: InquiryStatus[] = ['new', 'contacted', 'visit', 'quoted'];
const UPCOMING_BOOKED_LIMIT = 5;
/** Stored demo data older than this many days is replaced with a fresh seed. */
const RESEED_AFTER_DAYS = 14;
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
  // Demo data is throwaway: after a couple of weeks the seeded dates drift into the past,
  // so a returning visitor gets a fresh, current seed instead.
  if (existing && daysBetween(existing.seededOn, todayKey()) <= RESEED_AFTER_DAYS) return existing;
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

/** Whether two space choices share any ground ('both' is The Fireside Room and The Pine Garden, not The Stage Hall). */
const overlaps = spacesOverlap;

/** The part of the venue two overlapping choices share. */
const sharedSpace = (existing: SpaceChoice, requested: SpaceChoice): SpaceChoice =>
  existing === 'both' ? requested : requested === 'both' ? existing : requested;

function conflictFor(db: DemoDb, date: DateKey, space: SpaceChoice, ignoreId?: number): CalendarBlock | undefined {
  return db.blocks.find((b) => b.date === date && b.id !== ignoreId && overlaps(b.space, space));
}

function toInquiry(detail: InquiryDetail): Inquiry {
  const copy: Partial<DemoInquiryDetail> = { ...detail };
  delete copy.estimate;
  delete copy.notes;
  delete copy.events;
  delete copy.blocks;
  return copy as Inquiry;
}

const byCreatedDesc = (a: Inquiry, b: Inquiry) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id);
const byDate = (a: CalendarBlock, b: CalendarBlock) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);

/** InquiryDetail plus its linked calendar blocks, as the API server returns it. */
export type DemoInquiryDetail = InquiryDetail & { blocks: CalendarBlock[] };

/** What a draft is written from, as the server's /api/admin/mail/draft-input builds it. */
function demoDraftInput(db: DemoDb, req: MailDraftRequest): DraftInput | ApiError {
  const text = (req.text ?? '').trim();
  const instructions = (req.instructions ?? '').trim();
  if (req.mode === 'rewrite' && !text) return fail(demoMessages.nothingToRewrite);
  const mail = mailOf(db);
  const thread = req.threadId ? threadOf(mail, db.inquiries, req.threadId) : null;
  if (req.threadId && !thread) return fail(demoMessages.mailNotFound);
  const linked = req.inquiryId ?? thread?.inquiry?.id;
  const record = linked ? db.inquiries.find((i) => i.id === linked) : undefined;
  if (req.inquiryId && !record) return fail(demoMessages.inquiryNotFound);
  if (!thread && !record && req.mode === 'draft' && !instructions) return fail(demoMessages.draftNeedsContext, { instructions: demoMessages.draftNeedsContext });
  const detail = record ? detailOf(db, record) : null;
  const messages = thread?.messages ?? detail?.emails ?? [];
  const lastIn = [...messages].reverse().find((m) => m.direction === 'in');
  return {
    mode: req.mode,
    text,
    instructions,
    inquiry: detail ? pickDraftInquiry(detail) : null,
    emails: messages.map((m) => ({ direction: m.direction, fromName: m.from.name || m.from.address, sentAt: m.sentAt, text: m.text })),
    adminName: DEMO_ADMIN_NAME,
    guestName: detail?.name || lastIn?.from.name || thread?.counterpart.name || '',
    today: todayKey(),
  };
}

/** The demo mailbox, seeded on first use for data saved before it existed. */
function mailOf(db: DemoDb): DemoMail {
  db.mail ??= seedMail(db.inquiries, Date.now());
  return db.mail;
}

function detailOf(db: DemoDb, record: InquiryDetail): DemoInquiryDetail {
  const emails = (db.mail?.messages ?? [])
    .filter((m) => m.inquiryId === record.id)
    .map((m) => threadOf(db.mail!, db.inquiries, m.threadId)!.messages.find((x) => x.id === m.id)!)
    .sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : a.id - b.id));
  const out: DemoInquiryDetail = {
    ...clone(record),
    blocks: db.blocks.filter((b) => b.inquiryId === record.id).sort(byDate).map((b) => ({ ...b })),
    emails,
  };
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

const partsOf = spaceParts;
const spaceOf = spaceFromParts;

type BookingPlan = { ok: true; upgrade: CalendarBlock[]; add: SpaceChoice | null } | { ok: false; clash: CalendarBlock };

/**
 * What marking a request booked must change so every space it asked for is taken on the
 * calendar; the same rule as planBooking() in server/routes/admin.ts. Linked booked or held
 * blocks cover the request; any other block on what they leave uncovered is a clash.
 */
function planBooking(db: DemoDb, record: InquiryDetail): BookingPlan {
  const mine = db.blocks.filter((b) => b.inquiryId === record.id && b.date === record.date && overlaps(b.space, record.space) && b.kind !== 'closed');
  const covered = new Set(mine.flatMap((b) => partsOf(b.space)));
  const add = spaceOf(partsOf(record.space).filter((p) => !covered.has(p)));
  if (add) {
    const clash = db.blocks.find((b) => b.date === record.date && overlaps(b.space, add) && !mine.includes(b));
    if (clash) return { ok: false, clash };
  }
  return { ok: true, upgrade: mine.filter((b) => b.kind === 'held'), add };
}

function applyBooking(db: DemoDb, record: InquiryDetail, plan: Extract<BookingPlan, { ok: true }>, at: string): void {
  const label = blockLabelFor(record);
  for (const held of plan.upgrade) {
    held.kind = 'booked';
    held.label = label;
    addEvent(db, record, 'block', timelineText.booked.holdUpgraded(record.date), at);
  }
  if (plan.add) {
    db.blocks.push({ id: db.nextBlockId++, date: record.date, space: plan.add, kind: 'booked', label, inquiryId: record.id, createdAt: at });
    addEvent(db, record, 'block', timelineText.booked.added(record.date, plan.add, record.space), at);
  }
}

/** No longer booked: take the request's booked blocks for today and later off the calendar. */
function releaseBooking(db: DemoDb, record: InquiryDetail, today: DateKey, at: string): void {
  const released = db.blocks.filter((b) => b.inquiryId === record.id && b.kind === 'booked' && b.date >= today).sort(byDate);
  if (released.length === 0) return;
  db.blocks = db.blocks.filter((b) => !released.includes(b));
  for (const b of released) addEvent(db, record, 'block', timelineText.booked.released(b.date), at);
}

/** A stable fingerprint of a validated request, without its form token (see requestFingerprint on the server). */
function fingerprintOf(input: Record<string, unknown>): string {
  const rest: Record<string, unknown> = { ...input };
  delete rest.formToken;
  delete rest.website;
  return JSON.stringify(
    Object.keys(rest)
      .sort()
      .map((k) => [k, rest[k] ?? null]),
  );
}

/** Form tokens older than this are forgotten, like the server's 24-hour token lifetime. */
const TOKEN_MEMORY_MS = 24 * 3600 * 1000;

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
    const { inquiryInputSchema, fieldErrors, latestBookableDate } = await loadSchemas();
    await delay();
    // Honeypot: people never see this field, so anything in it came from a bot.
    const honeypot = (input as { website?: unknown } | null)?.website;
    if (typeof honeypot === 'string' && honeypot.trim() !== '') return fail(demoMessages.honeypot);

    // The form token first, like the server; the formToken field asks the page for a new one.
    const token = (input as { formToken?: unknown } | null)?.formToken;
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return fail(demoMessages.formExpired, { formToken: demoMessages.formExpired });

    const parsed = inquiryInputSchema.safeParse(input);
    if (!parsed.success) return invalid(fieldErrors(parsed.error));
    const data = parsed.data;

    // A retry of a request that already went through returns the same reference.
    const fingerprint = fingerprintOf(data);
    const earlier = load();
    const used = earlier.formTokenUses?.[data.formToken];
    const repeat = used && used.fingerprint === fingerprint ? earlier.inquiries.find((i) => i.id === used.inquiryId) : undefined;
    if (repeat) return { ok: true as const, reference: repeat.reference, demo: true };

    const today = todayKey();
    const latest = latestBookableDate(today);
    const fields: Record<string, string> = {};
    if (data.date < today) fields.date = demoMessages.pastDate;
    else if (data.date > latest) fields.date = demoMessages.tooFar;
    if (data.altDate && data.altDate < today) fields.altDate = demoMessages.pastAltDate;
    else if (data.altDate && data.altDate > latest) fields.altDate = demoMessages.altTooFar;
    const tooMany = capacityError(data.space, data.guests);
    if (tooMany) fields.guests = tooMany;
    if (Object.keys(fields).length > 0) return invalid(fields);

    const est = estimateWithRates({ date: data.date, space: data.space, hours: data.hours, eventType: data.eventType });

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
        estimateTotal: est.total,
        createdAt: now,
        updatedAt: now,
        estimate: est,
        notes: [],
        events: [],
      };
      addEvent(db, record, 'created', timelineText.created, now);
      // Like the server: warn the team when the calendar already shows the space as taken.
      const clash = conflictFor(db, data.date, data.space);
      if (clash) addEvent(db, record, 'block', timelineText.conflict(data.date, clash), now);
      addEvent(db, record, 'email', timelineText.demoEmail, now);
      db.inquiries.push(record);
      const cutoff = new Date(Date.now() - TOKEN_MEMORY_MS).toISOString();
      const uses = Object.fromEntries(Object.entries(db.formTokenUses ?? {}).filter(([, u]) => u.usedAt >= cutoff));
      uses[data.formToken] ??= { inquiryId: record.id, fingerprint, usedAt: now };
      db.formTokenUses = uses;
      return { ok: true as const, reference, demo: true };
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
        return { byStatus, newThisWeek, upcomingBooked, pipelineValue, bookedValue, unreadMail: db.mail ? unreadCount(db.mail) : 0, drafting: 'basic' as const };
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
        const db = load();
        const record = db.inquiries.find((i) => i.id === id);
        return record ? detailOf(db, record) : fail(demoMessages.inquiryNotFound);
      }),

    setStatus: (id, status) =>
      admin<InquiryDetail>(({ statusUpdateSchema, fieldErrors }) => {
        const parsed = statusUpdateSchema.safeParse({ status });
        if (!parsed.success) return fail(demoMessages.invalid, fieldErrors(parsed.error));
        const next = parsed.data.status as InquiryStatus;
        return mutate((db) => {
          const record = db.inquiries.find((i) => i.id === id);
          if (!record) return fail(demoMessages.inquiryNotFound);
          // Booked means every requested space is taken on the calendar; refuse, changing
          // nothing, when another block is in the way (the server answers 409).
          const plan = next === 'booked' ? planBooking(db, record) : null;
          if (plan && !plan.ok) return fail(demoMessages.bookClash(record.date, plan.clash));
          const now = new Date().toISOString();
          const was = record.status;
          if (was !== next) {
            addEvent(db, record, 'status', timelineText.status(was, next), now);
            record.status = next;
            record.updatedAt = now;
          }
          if (plan?.ok) applyBooking(db, record, plan, now);
          else if (was === 'booked' && next !== 'booked') releaseBooking(db, record, todayKey(), now);
          return detailOf(db, record);
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
          return detailOf(db, record);
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

    mail: {
      threads: (box, q) =>
        admin(() => mutate((db) => ({ threads: threadList(mailOf(db), db.inquiries, box, q ?? ''), status: DEMO_MAIL_STATUS }))),

      thread: (id) =>
        admin(() =>
          mutate((db) => {
            const mail = mailOf(db);
            for (const m of mail.messages) if (m.threadId === id && m.direction === 'in') m.read = true;
            return threadOf(mail, db.inquiries, id) ?? fail(demoMessages.mailNotFound);
          }),
        ),

      update: (id, change) =>
        admin(({ mailThreadUpdateSchema }) => {
          const parsed = mailThreadUpdateSchema.safeParse(change);
          if (!parsed.success) return fail(demoMessages.nothingToChange);
          return mutate((db) => {
            const mail = mailOf(db);
            const list = mail.messages.filter((m) => m.threadId === id);
            if (list.length === 0) return fail(demoMessages.mailNotFound);
            for (const m of list) {
              if (parsed.data.archived !== undefined) m.archived = parsed.data.archived;
              if (parsed.data.read !== undefined && m.direction === 'in') m.read = parsed.data.read;
            }
            return threadOf(mail, db.inquiries, id)!;
          });
        }),

      reply: (id, body) =>
        admin(({ mailReplySchema, fieldErrors }) => {
          const parsed = mailReplySchema.safeParse({ body });
          if (!parsed.success) return invalid(fieldErrors(parsed.error));
          return mutate((db) => {
            const mail = mailOf(db);
            const thread = threadOf(mail, db.inquiries, id);
            if (!thread) return fail(demoMessages.mailNotFound);
            const to = replyTo(thread);
            const subject = replySubject(thread.subject);
            addSent(mail, { to: [to], subject, body: parsed.data.body, adminName: DEMO_ADMIN_NAME, threadId: id, inquiryId: thread.inquiry?.id ?? null });
            const record = thread.inquiry ? db.inquiries.find((i) => i.id === thread.inquiry!.id) : undefined;
            if (record) addEvent(db, record, 'email', timelineText.emailSent(to.address, DEMO_ADMIN_NAME, subject), new Date().toISOString());
            return threadOf(mail, db.inquiries, id)!;
          });
        }),

      send: (input) =>
        admin(({ mailComposeSchema, parseRecipients, fieldErrors }) => {
          const parsed = mailComposeSchema.safeParse(input);
          if (!parsed.success) return invalid(fieldErrors(parsed.error));
          return mutate((db) => {
            const inquiryId = parsed.data.inquiryId ?? null;
            const record = inquiryId === null ? undefined : db.inquiries.find((i) => i.id === inquiryId);
            if (inquiryId !== null && !record) return fail(demoMessages.inquiryNotFound);
            const to = parseRecipients(parsed.data.to)!.map((address) => ({ name: '', address }));
            const mail = mailOf(db);
            const threadId = addSent(mail, { to, subject: parsed.data.subject, body: parsed.data.body, adminName: DEMO_ADMIN_NAME, inquiryId });
            if (record) addEvent(db, record, 'email', timelineText.emailSent(to.map((a) => a.address).join(', '), DEMO_ADMIN_NAME, parsed.data.subject), new Date().toISOString());
            return threadOf(mail, db.inquiries, threadId)!;
          });
        }),

      emailInquiry: (id, body) =>
        admin(({ inquiryEmailSchema, fieldErrors }) => {
          const parsed = inquiryEmailSchema.safeParse({ body });
          if (!parsed.success) return invalid(fieldErrors(parsed.error));
          return mutate((db) => {
            const record = db.inquiries.find((i) => i.id === id);
            if (!record) return fail(demoMessages.inquiryNotFound);
            const mail = mailOf(db);
            const latest = mail.messages
              .filter((m) => (m.direction === 'in' ? m.from : m.to[0]).address === record.email.toLowerCase())
              .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))[0];
            const thread = latest ? threadOf(mail, db.inquiries, latest.threadId) : null;
            const subject = thread ? replySubject(thread.subject) : `Your request for ${formatLong(record.date)} at The Venue @ NCC (${record.reference})`;
            addSent(mail, {
              to: [{ name: record.name, address: record.email }],
              subject,
              body: parsed.data.body,
              adminName: DEMO_ADMIN_NAME,
              threadId: thread?.id ?? null,
              inquiryId: id,
            });
            const now = new Date().toISOString();
            addEvent(db, record, 'email', timelineText.emailSent(record.email, DEMO_ADMIN_NAME, subject), now);
            if (record.status === 'new') {
              record.status = 'contacted';
              addEvent(db, record, 'status', timelineText.emailedGuest(DEMO_ADMIN_NAME), now);
            }
            record.updatedAt = now;
            return detailOf(db, record);
          });
        }),

      async sync() {
        await delay();
        return isSignedIn() ? DEMO_MAIL_STATUS : fail(demoMessages.signedOut);
      },

      attachmentUrl: () => null,

      // The demo has no Claude: the built-in template writes the draft, as on a server without ANTHROPIC_API_KEY.
      draft: (req) =>
        admin(() =>
          mutate((db) => {
            if (req.mode === 'rewrite') return fail(demoMessages.rewriteDemo);
            const input = demoDraftInput(db, req);
            return 'ok' in input ? input : finishDraft(templateDraft(input), input, 'basic');
          }),
        ),

      // What the computer's own writer drafts from (the same as the server's /draft-input).
      draftInput: (req) => admin(() => mutate((db) => demoDraftInput(db, req))),
    },
  },
};
