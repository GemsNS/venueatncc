/**
 * Data access. All SQL lives here; routes speak in the API types from src/shared/types.ts.
 */
import type { Db } from './db';
import type {
  AdminStats,
  AdminUser,
  BlockKind,
  CalendarBlock,
  ContactPreference,
  DateKey,
  Estimate,
  Inquiry,
  InquiryDetail,
  InquiryEvent,
  InquiryNote,
  InquiryStatus,
  SpaceChoice,
} from '../src/shared/types';
import { INQUIRY_STATUSES } from '../src/shared/types';

/** Open statuses: still in the pipeline. */
export const OPEN_STATUSES: InquiryStatus[] = ['new', 'contacted', 'visit', 'quoted'];

/** Whether two space choices share any ground. 'both' overlaps everything. */
export function spacesOverlap(a: SpaceChoice, b: SpaceChoice): boolean {
  return a === 'both' || b === 'both' || a === b;
}

// ---------------------------------------------------------------- rows

interface InquiryRow {
  id: number;
  reference: string;
  status: InquiryStatus;
  event_type: string;
  event_type_other: string | null;
  date: string;
  alt_date: string | null;
  start_time: string;
  hours: number;
  space: SpaceChoice;
  guests: number;
  name: string;
  email: string;
  phone: string | null;
  contact_preference: ContactPreference;
  message: string | null;
  wants_visit: number;
  visit_notes: string | null;
  estimate_json: string;
  estimate_total: number;
  created_at: string;
  updated_at: string;
}

interface BlockRow {
  id: number;
  date: string;
  space: SpaceChoice;
  kind: BlockKind;
  label: string;
  inquiry_id: number | null;
  created_at: string;
  created_by: number | null;
}

interface AdminRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}

/** Optional text: undefined (never null) so JSON matches the optional fields in Inquiry. */
const opt = (v: string | null): string | undefined => (v === null || v === '' ? undefined : v);

export function toInquiry(r: InquiryRow): Inquiry {
  const out: Inquiry = {
    id: r.id,
    reference: r.reference,
    status: r.status,
    eventType: r.event_type,
    date: r.date,
    startTime: r.start_time,
    hours: r.hours,
    space: r.space,
    guests: r.guests,
    name: r.name,
    email: r.email,
    contactPreference: r.contact_preference,
    wantsVisit: r.wants_visit === 1,
    estimateTotal: r.estimate_total,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  const optional = {
    eventTypeOther: opt(r.event_type_other),
    altDate: opt(r.alt_date),
    phone: opt(r.phone),
    message: opt(r.message),
    visitNotes: opt(r.visit_notes),
  };
  for (const [k, v] of Object.entries(optional)) if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  return out;
}

export function toBlock(r: BlockRow): CalendarBlock {
  return { id: r.id, date: r.date, space: r.space, kind: r.kind, label: r.label, inquiryId: r.inquiry_id, createdAt: r.created_at };
}

export interface NewInquiry {
  reference: string;
  eventType: string;
  eventTypeOther?: string;
  date: DateKey;
  altDate?: DateKey;
  startTime: string;
  hours: number;
  space: SpaceChoice;
  guests: number;
  name: string;
  email: string;
  phone?: string;
  contactPreference: ContactPreference;
  message?: string;
  wantsVisit: boolean;
  visitNotes?: string;
  estimate: Estimate;
  ipHash: string | null;
  userAgent: string | null;
}

export interface EmailLogEntry {
  inquiryId: number | null;
  kind: string;
  to: string;
  subject: string;
  status: 'sent' | 'outbox' | 'failed';
  transport: string;
  messageId?: string | null;
  location?: string | null;
  error?: string | null;
}

/** InquiryDetail plus the calendar blocks linked to the inquiry. */
export type InquiryDetailWithBlocks = InquiryDetail & { blocks: CalendarBlock[] };

export interface FormTokenUse {
  inquiryId: number;
  bodyHash: string;
}

export interface SessionRecord {
  sessionId: string;
  expiresAt: string;
  lastSeenAt: string;
  user: AdminUser;
}

const LIKE_ESCAPE = '!';
const likeEscape = (s: string) => s.replace(/[!%_]/g, (m) => LIKE_ESCAPE + m);

export class Repo {
  constructor(readonly db: Db) {}

  // ------------------------------------------------------------ inquiries

  insertInquiry(input: NewInquiry, now: string): number {
    const info = this.db
      .prepare(
        `INSERT INTO inquiries (reference, status, event_type, event_type_other, date, alt_date, start_time, hours, space, guests,
          name, email, phone, contact_preference, message, wants_visit, visit_notes,
          estimate_json, estimate_total, ip_hash, user_agent, created_at, updated_at)
         VALUES (@reference, 'new', @eventType, @eventTypeOther, @date, @altDate, @startTime, @hours, @space, @guests,
          @name, @email, @phone, @contactPreference, @message, @wantsVisit, @visitNotes,
          @estimateJson, @estimateTotal, @ipHash, @userAgent, @now, @now)`,
      )
      .run({
        reference: input.reference,
        eventType: input.eventType,
        eventTypeOther: input.eventTypeOther ?? null,
        date: input.date,
        altDate: input.altDate ?? null,
        startTime: input.startTime,
        hours: input.hours,
        space: input.space,
        guests: input.guests,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        contactPreference: input.contactPreference,
        message: input.message ?? null,
        wantsVisit: input.wantsVisit ? 1 : 0,
        visitNotes: input.visitNotes ?? null,
        estimateJson: JSON.stringify(input.estimate),
        estimateTotal: input.estimate.total,
        ipHash: input.ipHash,
        userAgent: input.userAgent,
        now,
      });
    return Number(info.lastInsertRowid);
  }

  referenceExists(reference: string): boolean {
    return this.db.prepare('SELECT 1 FROM inquiries WHERE reference = ?').get(reference) !== undefined;
  }

  countInquiriesFromIp(ipHash: string, sinceIso: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE ip_hash = ? AND created_at >= ?').get(ipHash, sinceIso) as { n: number };
    return row.n;
  }

  private inquiryRow(id: number): InquiryRow | undefined {
    return this.db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id) as InquiryRow | undefined;
  }

  getInquiry(id: number): Inquiry | null {
    const row = this.inquiryRow(id);
    return row ? toInquiry(row) : null;
  }

  /**
   * An inquiry with its estimate, notes, timeline, and the calendar blocks linked to it (so the
   * admin can tell when a booked request has lost its block).
   */
  getInquiryDetail(id: number): InquiryDetailWithBlocks | null {
    const row = this.inquiryRow(id);
    if (!row) return null;
    const notes = (
      this.db.prepare('SELECT id, body, author, created_at FROM inquiry_notes WHERE inquiry_id = ? ORDER BY created_at, id').all(id) as {
        id: number;
        body: string;
        author: string;
        created_at: string;
      }[]
    ).map((n): InquiryNote => ({ id: n.id, body: n.body, author: n.author, createdAt: n.created_at }));
    const events = (
      this.db.prepare('SELECT id, kind, detail, created_at FROM inquiry_events WHERE inquiry_id = ? ORDER BY created_at, id').all(id) as {
        id: number;
        kind: InquiryEvent['kind'];
        detail: string;
        created_at: string;
      }[]
    ).map((e): InquiryEvent => ({ id: e.id, kind: e.kind, detail: e.detail, createdAt: e.created_at }));
    const detail: InquiryDetailWithBlocks = {
      ...toInquiry(row),
      estimate: JSON.parse(row.estimate_json) as Estimate,
      notes,
      events,
      blocks: this.blocksForInquiry(id),
    };
    return detail;
  }

  listInquiries(filter: { status?: InquiryStatus | 'open' | 'all'; q?: string }, limit = 1000): Inquiry[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.status === 'open') {
      where.push(`status IN (${OPEN_STATUSES.map(() => '?').join(',')})`);
      params.push(...OPEN_STATUSES);
    } else if (filter.status && filter.status !== 'all') {
      where.push('status = ?');
      params.push(filter.status);
    }
    const q = filter.q?.trim();
    if (q) {
      const like = `%${likeEscape(q)}%`;
      const cols = ['reference', 'name', 'email', 'phone', 'message', 'event_type', 'event_type_other', 'visit_notes'];
      where.push(`(${cols.map((c) => `${c} LIKE ? ESCAPE '${LIKE_ESCAPE}'`).join(' OR ')})`);
      params.push(...cols.map(() => like));
    }
    const sql = `SELECT * FROM inquiries ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT ?`;
    return (this.db.prepare(sql).all(...params, limit) as InquiryRow[]).map(toInquiry);
  }

  allInquiries(): Inquiry[] {
    return (this.db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC, id DESC').all() as InquiryRow[]).map(toInquiry);
  }

  setInquiryStatus(id: number, status: InquiryStatus, now: string): void {
    this.db.prepare('UPDATE inquiries SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  }

  touchInquiry(id: number, now: string): void {
    this.db.prepare('UPDATE inquiries SET updated_at = ? WHERE id = ?').run(now, id);
  }

  addNote(inquiryId: number, admin: AdminUser, body: string, now: string): void {
    this.db
      .prepare('INSERT INTO inquiry_notes (inquiry_id, admin_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(inquiryId, admin.id, admin.name, body, now);
  }

  addEvent(inquiryId: number, kind: InquiryEvent['kind'], detail: string, now: string): void {
    this.db.prepare('INSERT INTO inquiry_events (inquiry_id, kind, detail, created_at) VALUES (?, ?, ?, ?)').run(inquiryId, kind, detail, now);
  }

  // ------------------------------------------------------------ blocks

  blocksBetween(from: DateKey, to: DateKey): CalendarBlock[] {
    return (this.db.prepare('SELECT * FROM blocks WHERE date >= ? AND date <= ? ORDER BY date, id').all(from, to) as BlockRow[]).map(toBlock);
  }

  /** Blocks on a date that share ground with the given space. */
  conflictingBlocks(date: DateKey, space: SpaceChoice, excludeId?: number): CalendarBlock[] {
    return this.blocksBetween(date, date).filter((b) => b.id !== excludeId && spacesOverlap(b.space, space));
  }

  blocksForInquiry(inquiryId: number): CalendarBlock[] {
    return (this.db.prepare('SELECT * FROM blocks WHERE inquiry_id = ? ORDER BY date, id').all(inquiryId) as BlockRow[]).map(toBlock);
  }

  getBlock(id: number): CalendarBlock | null {
    const row = this.db.prepare('SELECT * FROM blocks WHERE id = ?').get(id) as BlockRow | undefined;
    return row ? toBlock(row) : null;
  }

  insertBlock(
    input: { date: DateKey; space: SpaceChoice; kind: BlockKind; label: string; inquiryId: number | null; createdBy: number | null },
    now: string,
  ): CalendarBlock {
    const info = this.db
      .prepare('INSERT INTO blocks (date, space, kind, label, inquiry_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(input.date, input.space, input.kind, input.label, input.inquiryId, now, input.createdBy);
    return this.getBlock(Number(info.lastInsertRowid))!;
  }

  updateBlockKind(id: number, kind: BlockKind, label: string): void {
    this.db.prepare('UPDATE blocks SET kind = ?, label = ? WHERE id = ?').run(kind, label, id);
  }

  deleteBlock(id: number): void {
    this.db.prepare('DELETE FROM blocks WHERE id = ?').run(id);
  }

  // ------------------------------------------------------------ admins

  countAdmins(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM admins').get() as { n: number }).n;
  }

  findAdminByEmail(email: string): (AdminUser & { passwordHash: string }) | null {
    const row = this.db.prepare('SELECT id, email, name, password_hash FROM admins WHERE email = ?').get(email.trim().toLowerCase()) as
      | AdminRow
      | undefined;
    return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash } : null;
  }

  getAdminHash(id: number): string | null {
    const row = this.db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(id) as { password_hash: string } | undefined;
    return row?.password_hash ?? null;
  }

  createAdmin(email: string, name: string, passwordHash: string, now: string): AdminUser {
    const info = this.db
      .prepare('INSERT INTO admins (email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(email.trim().toLowerCase(), name.trim(), passwordHash, now, now);
    return { id: Number(info.lastInsertRowid), email: email.trim().toLowerCase(), name: name.trim() };
  }

  updateAdmin(id: number, fields: { passwordHash?: string; name?: string }, now: string): void {
    if (fields.passwordHash) this.db.prepare('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?').run(fields.passwordHash, now, id);
    if (fields.name) this.db.prepare('UPDATE admins SET name = ?, updated_at = ? WHERE id = ?').run(fields.name.trim(), now, id);
  }

  recordLogin(id: number, now: string): void {
    this.db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(now, id);
  }

  // ------------------------------------------------------------ sessions

  createSession(s: { id: string; adminId: number; expiresAt: string; ip: string | null; userAgent: string | null }, now: string): void {
    this.db
      .prepare('INSERT INTO sessions (id, admin_id, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(s.id, s.adminId, now, s.expiresAt, now, s.ip, s.userAgent);
  }

  /** A session that has not expired and was last used after `idleSince`. */
  findSession(id: string, now: string, idleSince: string): SessionRecord | null {
    const row = this.db
      .prepare(
        `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, a.id, a.email, a.name
         FROM sessions s JOIN admins a ON a.id = s.admin_id
         WHERE s.id = ? AND s.expires_at > ? AND s.last_seen_at > ?`,
      )
      .get(id, now, idleSince) as { session_id: string; expires_at: string; last_seen_at: string; id: number; email: string; name: string } | undefined;
    if (!row) return null;
    return { sessionId: row.session_id, expiresAt: row.expires_at, lastSeenAt: row.last_seen_at, user: { id: row.id, email: row.email, name: row.name } };
  }

  touchSession(id: string, now: string): void {
    this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(now, id);
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  deleteOtherSessions(adminId: number, keepId: string): number {
    return this.db.prepare('DELETE FROM sessions WHERE admin_id = ? AND id != ?').run(adminId, keepId).changes;
  }

  deleteAllSessions(adminId: number): number {
    return this.db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(adminId).changes;
  }

  /** Delete sessions that have expired or have not been used since `idleSince`. */
  deleteExpiredSessions(now: string, idleSince?: string): number {
    if (idleSince === undefined) return this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now).changes;
    return this.db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR last_seen_at <= ?').run(now, idleSince).changes;
  }

  // ------------------------------------------------------------ form tokens

  /** The inquiry a form token's nonce already created, if any. */
  findFormTokenUse(nonce: string): FormTokenUse | null {
    const row = this.db.prepare('SELECT inquiry_id, body_hash FROM form_token_uses WHERE nonce = ?').get(nonce) as
      | { inquiry_id: number; body_hash: string }
      | undefined;
    return row ? { inquiryId: row.inquiry_id, bodyHash: row.body_hash } : null;
  }

  /** Remember which inquiry a nonce created (the first one wins), and forget uses older than `forgetBefore`. */
  recordFormTokenUse(nonce: string, inquiryId: number, bodyHash: string, now: string, forgetBefore: string): void {
    this.db.prepare('DELETE FROM form_token_uses WHERE used_at < ?').run(forgetBefore);
    this.db
      .prepare('INSERT OR IGNORE INTO form_token_uses (nonce, inquiry_id, body_hash, used_at) VALUES (?, ?, ?, ?)')
      .run(nonce, inquiryId, bodyHash, now);
  }

  // ------------------------------------------------------------ email log

  logEmail(e: EmailLogEntry, now: string): void {
    this.db
      .prepare(
        `INSERT INTO email_log (inquiry_id, kind, to_address, subject, status, transport, message_id, location, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(e.inquiryId, e.kind, e.to, e.subject, e.status, e.transport, e.messageId ?? null, e.location ?? null, e.error ?? null, now);
  }

  /** How many emails of a kind were attempted since a moment (any outcome). */
  countEmailsSince(kind: string, sinceIso: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM email_log WHERE kind = ? AND created_at >= ?').get(kind, sinceIso) as { n: number }).n;
  }

  // ------------------------------------------------------------ stats

  stats(today: DateKey, weekAgoIso: string): AdminStats {
    const byStatus = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s.id, 0])) as Record<InquiryStatus, number>;
    for (const row of this.db.prepare('SELECT status, COUNT(*) AS n FROM inquiries GROUP BY status').all() as { status: InquiryStatus; n: number }[]) {
      byStatus[row.status] = row.n;
    }
    const newThisWeek = (this.db.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE created_at >= ?').get(weekAgoIso) as { n: number }).n;
    const upcomingBooked = (
      this.db.prepare(`SELECT date, label, space FROM blocks WHERE kind = 'booked' AND date >= ? ORDER BY date, id LIMIT 10`).all(today) as {
        date: string;
        label: string;
        space: SpaceChoice;
      }[]
    ).map((b) => ({ date: b.date, label: b.label, space: b.space }));
    const sum = (statuses: InquiryStatus[]) =>
      (
        this.db
          .prepare(`SELECT COALESCE(SUM(estimate_total), 0) AS total FROM inquiries WHERE status IN (${statuses.map(() => '?').join(',')})`)
          .get(...statuses) as { total: number }
      ).total;
    return { byStatus, newThisWeek, upcomingBooked, pipelineValue: sum(OPEN_STATUSES), bookedValue: sum(['booked']) };
  }
}
