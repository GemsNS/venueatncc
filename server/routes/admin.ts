/**
 * Admin API. Everything except /login needs a session cookie; every request that changes data
 * also needs X-Requested-With: fetch (the same-origin check runs before this router).
 */
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { eventTypeName } from '../../src/data/event-types';
import { MAX_RANGE_DAYS } from '../../src/shared/availability';
import { inquiriesToCsv } from '../../src/shared/csv';
import { addDays, daysBetween, formatLong, isDateKey, todayKey } from '../../src/shared/dates';
import { availabilityQuerySchema, blockInputSchema, fieldErrors, loginSchema, noteInputSchema, passwordChangeSchema, statusUpdateSchema } from '../../src/shared/schemas';
import { INQUIRY_STATUSES } from '../../src/shared/types';
import type { AdminUser, BlockKind, CalendarBlock, DateKey, Inquiry, InquiryListQuery, InquiryStatus, SpaceChoice } from '../../src/shared/types';
import { apiError, clientIp, ipBucket, iso, MUTATING_METHODS, readBody, type AppContextT, type AppEnv, type ServerContext } from '../context';
import { spaceLabel } from '../email/templates';
import { spacesOverlap, type Repo } from '../repo';
import { BusyError, dummyPasswordHash, hashPassword, needsRehash, newSessionToken, sha256, verifyPassword, type RateLimiter } from '../security';

/** Without HTTPS (local development) the cookie cannot carry the __Host- prefix. */
export const sessionCookieName = (secure: boolean) => (secure ? '__Host-ncc_session' : 'ncc_session');
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** A session that has not been used for this long ends, even before its 14 days are up. */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 5 * 60 * 1000;
const LOGIN_ERROR = 'Email or password is incorrect.';
const BUSY_ERROR = 'Sign-in is busy right now. Wait a minute, then try again.';

const statusLabel = (s: InquiryStatus) => INQUIRY_STATUSES.find((x) => x.id === s)?.label ?? s;
const kindLabel: Record<BlockKind, string> = { booked: 'booked', held: 'held', closed: 'closed' };
const LIST_FILTERS = new Set<string>([...INQUIRY_STATUSES.map((s) => s.id), 'open', 'all']);

function parseId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9][0-9]{0,14}$/.test(raw)) return null;
  return Number(raw);
}

export function blockLabelFor(i: Pick<Inquiry, 'name' | 'eventType' | 'eventTypeOther'>): string {
  return `${i.name}: ${eventTypeName(i.eventType, i.eventTypeOther)}`.slice(0, 120);
}

// ---------------------------------------------------------------- booked requests and the calendar

type Part = 'indoor' | 'outdoor';
const partsOf = (space: SpaceChoice): Part[] => (space === 'both' ? ['indoor', 'outdoor'] : [space]);
const spaceOf = (parts: Part[]): SpaceChoice | null => (parts.length === 2 ? 'both' : (parts[0] ?? null));

export type BookingPlan =
  | { ok: true; /** Linked holds to turn into booked blocks. */ upgrade: CalendarBlock[]; /** The part of the request no linked block covers yet. */ add: SpaceChoice | null }
  | { ok: false; clash: CalendarBlock };

/**
 * What marking a request booked must change so the calendar shows every space it asked for as
 * taken. Blocks linked to the request (booked, or held and upgraded) count as covering it; for
 * whatever they leave uncovered, any other block on that date and space is a clash, and nothing
 * is changed.
 */
export function planBooking(inquiry: Pick<Inquiry, 'date' | 'space'>, linked: CalendarBlock[], others: CalendarBlock[]): BookingPlan {
  const mine = linked.filter((b) => b.date === inquiry.date && spacesOverlap(b.space, inquiry.space) && b.kind !== 'closed');
  const covered = new Set(mine.flatMap((b) => partsOf(b.space)));
  const add = spaceOf(partsOf(inquiry.space).filter((p) => !covered.has(p)));
  if (add) {
    const clash = others.find((b) => b.date === inquiry.date && spacesOverlap(b.space, add) && !mine.some((m) => m.id === b.id));
    if (clash) return { ok: false, clash };
  }
  return { ok: true, upgrade: mine.filter((b) => b.kind === 'held'), add };
}

export const bookingText = {
  clash: (date: DateKey, b: Pick<CalendarBlock, 'kind' | 'space' | 'label'>) =>
    `${formatLong(date)} already has a ${kindLabel[b.kind]} block for ${spaceLabel(b.space).toLowerCase()}${b.label ? ` (${b.label})` : ''}. Remove or change that block on the calendar, then mark this request booked.`,
  holdUpgraded: (date: DateKey) => `The hold on ${formatLong(date)} is now marked booked on the calendar.`,
  added: (date: DateKey, space: SpaceChoice, requested: SpaceChoice) =>
    space === requested
      ? `Added to the calendar as booked for ${formatLong(date)}.`
      : `Added to the calendar as booked for ${formatLong(date)} (${spaceLabel(space).toLowerCase()}).`,
  released: (date: DateKey) => `Removed the booked block for ${formatLong(date)} from the calendar, so the date is open again.`,
};

function applyBooking(repo: Repo, inquiry: Inquiry, plan: Extract<BookingPlan, { ok: true }>, createdBy: number, stamp: string): void {
  const label = blockLabelFor(inquiry);
  for (const held of plan.upgrade) {
    repo.updateBlockKind(held.id, 'booked', label);
    repo.addEvent(inquiry.id, 'block', bookingText.holdUpgraded(inquiry.date), stamp);
  }
  if (plan.add) {
    repo.insertBlock({ date: inquiry.date, space: plan.add, kind: 'booked', label, inquiryId: inquiry.id, createdBy }, stamp);
    repo.addEvent(inquiry.id, 'block', bookingText.added(inquiry.date, plan.add, inquiry.space), stamp);
  }
}

/** A request is no longer booked: take its booked blocks for today and later off the calendar. */
function releaseBooking(repo: Repo, inquiry: Inquiry, today: DateKey, stamp: string): void {
  for (const b of repo.blocksForInquiry(inquiry.id)) {
    if (b.kind !== 'booked' || b.date < today) continue;
    repo.deleteBlock(b.id);
    repo.addEvent(inquiry.id, 'block', bookingText.released(b.date), stamp);
  }
}

export function adminRoutes(ctx: ServerContext): Hono<AppEnv> {
  const admin = new Hono<AppEnv>();
  const { config, repo, now } = ctx;
  const SESSION_COOKIE = sessionCookieName(config.secureCookies);

  const setSessionCookie = (c: AppContextT, token: string) =>
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      secure: config.secureCookies,
    });
  const clearSessionCookie = (c: AppContextT) => deleteCookie(c, SESSION_COOKIE, { path: '/', secure: config.secureCookies, httpOnly: true, sameSite: 'Lax' });

  const startSession = (c: AppContextT, adminId: number, nowMs: number) => {
    const { token, id } = newSessionToken();
    repo.createSession(
      {
        id,
        adminId,
        expiresAt: iso(nowMs + SESSION_TTL_MS),
        ip: clientIp(c, config.trustProxy).slice(0, 100),
        userAgent: (c.req.header('user-agent') ?? '').slice(0, 400) || null,
      },
      iso(nowMs),
    );
    setSessionCookie(c, token);
  };

  const tooMany = (c: AppContextT, limiter: RateLimiter, key: string, nowMs: number, message: string) => {
    c.header('Retry-After', String(Math.max(1, Math.ceil(limiter.retryAfterMs(key, nowMs) / 1000))));
    return apiError(c, 429, message);
  };

  // Guard: X-Requested-With on writes, then the session for everything but login.
  admin.use('*', async (c, next) => {
    if (MUTATING_METHODS.has(c.req.method) && (c.req.header('x-requested-with') ?? '').toLowerCase() !== 'fetch') {
      return apiError(c, 403, 'This request was blocked. Reload the page and try again.');
    }
    if (c.req.path === '/api/admin/login') return next();
    const token = getCookie(c, SESSION_COOKIE);
    const nowMs = now();
    const session = token ? repo.findSession(sha256(token), iso(nowMs), iso(nowMs - SESSION_IDLE_MS)) : null;
    if (!session) {
      if (token) clearSessionCookie(c);
      return apiError(c, 401, 'Sign in to continue.');
    }
    if (nowMs - Date.parse(session.lastSeenAt) > TOUCH_EVERY_MS) repo.touchSession(session.sessionId, iso(nowMs));
    c.set('session', session);
    return next();
  });

  // ------------------------------------------------------------ session

  admin.post('/login', async (c) => {
    const body = await readBody(c, false);
    const parsed = loginSchema.safeParse(body ?? {});
    if (!parsed.success) return apiError(c, 400, 'Enter your email and password.', fieldErrors(parsed.error));
    const email = parsed.data.email.trim().toLowerCase();
    const bucket = ipBucket(clientIp(c, config.trustProxy));
    const nowMs = now();
    const tooManyMessage = 'Too many sign-in attempts. Wait 15 minutes, then try again.';
    // Both limits count the attempt before any await, so a burst of concurrent guesses cannot
    // all pass the check before one is recorded. The first caps an address across every email.
    if (!ctx.limits.loginIp.consume(bucket, nowMs)) return tooMany(c, ctx.limits.loginIp, bucket, nowMs, tooManyMessage);
    const key = sha256(`${bucket}|${email}`);
    if (!ctx.limits.login.consume(key, nowMs)) return tooMany(c, ctx.limits.login, key, nowMs, tooManyMessage);

    const found = repo.findAdminByEmail(email);
    let valid: boolean;
    try {
      valid = await verifyPassword(parsed.data.password, found?.passwordHash ?? (await dummyPasswordHash()));
    } catch (err) {
      if (err instanceof BusyError) return apiError(c, 503, BUSY_ERROR);
      throw err;
    }
    if (!found || !valid) return apiError(c, 401, LOGIN_ERROR);
    ctx.limits.login.reset(key);

    // Hashes made with older, weaker settings are replaced now that the password is known.
    if (needsRehash(found.passwordHash)) {
      try {
        repo.updateAdmin(found.id, { passwordHash: await hashPassword(parsed.data.password) }, iso(nowMs));
      } catch (err) {
        if (!(err instanceof BusyError)) throw err;
      }
    }

    // A fresh token on every sign-in; drop the one this browser had, if any.
    const previous = getCookie(c, SESSION_COOKIE);
    if (previous) repo.deleteSession(sha256(previous));
    startSession(c, found.id, nowMs);
    repo.recordLogin(found.id, iso(nowMs));
    const user: AdminUser = { id: found.id, email: found.email, name: found.name };
    return c.json(user);
  });

  admin.get('/session', (c) => c.json({ user: c.get('session').user }));

  admin.post('/logout', (c) => {
    repo.deleteSession(c.get('session').sessionId);
    clearSessionCookie(c);
    return c.json({ ok: true as const });
  });

  admin.post('/password', async (c) => {
    const session = c.get('session');
    const parsed = passwordChangeSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      return apiError(c, 400, fields.next ?? 'Enter your current password and a new one.', fields);
    }
    const key = `admin:${session.user.id}`;
    const nowMs = now();
    // Counted before the password check, like sign-in, so concurrent guesses cannot slip past.
    if (!ctx.limits.password.consume(key, nowMs)) return tooMany(c, ctx.limits.password, key, nowMs, 'Too many attempts. Wait 15 minutes, then try again.');
    const hash = repo.getAdminHash(session.user.id);
    let nextHash: string;
    try {
      if (!hash || !(await verifyPassword(parsed.data.current, hash))) {
        return apiError(c, 400, 'Your current password is incorrect.', { current: 'Your current password is incorrect.' });
      }
      if (parsed.data.next === parsed.data.current) {
        return apiError(c, 400, 'Choose a new password that is different from the current one.', { next: 'Choose a new password that is different from the current one.' });
      }
      nextHash = await hashPassword(parsed.data.next);
    } catch (err) {
      if (err instanceof BusyError) return apiError(c, 503, 'The server is busy. Wait a minute, then try again.');
      throw err;
    }
    ctx.limits.password.reset(key);
    // Every session ends, this one included; this browser gets a fresh token.
    repo.db.transaction(() => {
      repo.updateAdmin(session.user.id, { passwordHash: nextHash }, iso(nowMs));
      repo.deleteAllSessions(session.user.id);
    })();
    startSession(c, session.user.id, nowMs);
    return c.json({ ok: true as const });
  });

  // ------------------------------------------------------------ dashboard

  admin.get('/stats', (c) => {
    const nowMs = now();
    return c.json(repo.stats(todayKey(new Date(nowMs)), iso(nowMs - 7 * 24 * 60 * 60 * 1000)));
  });

  // ------------------------------------------------------------ inquiries

  admin.get('/inquiries', (c) => {
    const status = c.req.query('status') || undefined;
    if (status && !LIST_FILTERS.has(status)) return apiError(c, 400, 'Unknown status filter.', { status: 'Unknown status filter.' });
    const q = (c.req.query('q') ?? '').slice(0, 200);
    return c.json(repo.listInquiries({ status: status as InquiryListQuery['status'], q }));
  });

  admin.get('/inquiries/:id', (c) => {
    const id = parseId(c.req.param('id'));
    const detail = id ? repo.getInquiryDetail(id) : null;
    return detail ? c.json(detail) : apiError(c, 404, 'That inquiry was not found.');
  });

  admin.patch('/inquiries/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    const current = id ? repo.getInquiry(id) : null;
    if (!id || !current) return apiError(c, 404, 'That inquiry was not found.');
    const parsed = statusUpdateSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) return apiError(c, 400, 'Choose a status.', fieldErrors(parsed.error));
    const status = parsed.data.status as InquiryStatus;
    const who = c.get('session').user;
    const nowMs = now();
    const stamp = iso(nowMs);

    // Booked means every requested space is taken on the calendar. Work out the change first,
    // and refuse (leaving the status as it was) when another block is in the way.
    const plan = status === 'booked' ? planBooking(current, repo.blocksForInquiry(id), repo.blocksBetween(current.date, current.date)) : null;
    if (plan && !plan.ok) return apiError(c, 409, bookingText.clash(current.date, plan.clash));

    repo.db.transaction(() => {
      if (status !== current.status) {
        repo.setInquiryStatus(id, status, stamp);
        repo.addEvent(id, 'status', `Status changed from ${statusLabel(current.status)} to ${statusLabel(status)} by ${who.name}.`, stamp);
      }
      if (plan?.ok) applyBooking(repo, current, plan, who.id, stamp);
      else if (current.status === 'booked' && status !== 'booked') releaseBooking(repo, current, todayKey(new Date(nowMs)), stamp);
    })();

    return c.json(repo.getInquiryDetail(id)!);
  });

  admin.post('/inquiries/:id/notes', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id || !repo.getInquiry(id)) return apiError(c, 404, 'That inquiry was not found.');
    const parsed = noteInputSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      return apiError(c, 400, fields.body ?? 'Write a note first.', fields);
    }
    const who = c.get('session').user;
    const stamp = iso(now());
    repo.db.transaction(() => {
      repo.addNote(id, who, parsed.data.body, stamp);
      repo.addEvent(id, 'note', `Note added by ${who.name}.`, stamp);
      repo.touchInquiry(id, stamp);
    })();
    return c.json(repo.getInquiryDetail(id)!);
  });

  admin.get('/export.csv', (c) => {
    const today = todayKey(new Date(now()));
    return c.body(inquiriesToCsv(repo.allInquiries()), 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="venue-inquiries-${today}.csv"`,
    });
  });

  // ------------------------------------------------------------ calendar blocks

  admin.get('/blocks', (c) => {
    const today = todayKey(new Date(now()));
    const from = c.req.query('from') || addDays(today, -31);
    const to = c.req.query('to') || (isDateKey(from) ? addDays(from, 365) : from);
    const parsed = availabilityQuerySchema.safeParse({ from, to });
    if (!parsed.success) return apiError(c, 400, 'Choose a valid date range.', fieldErrors(parsed.error));
    if (to < from) return apiError(c, 400, 'The end date must be on or after the start date.', { to: 'The end date must be on or after the start date.' });
    if (daysBetween(from, to) > MAX_RANGE_DAYS) return apiError(c, 400, `Ask for ${MAX_RANGE_DAYS} days or fewer at a time.`);
    return c.json(repo.blocksBetween(from, to));
  });

  admin.post('/blocks', async (c) => {
    const parsed = blockInputSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      const messages = Object.values(fields);
      return apiError(c, 400, messages.length === 1 ? messages[0] : 'Check the highlighted fields.', fields);
    }
    const input = parsed.data;
    const inquiryId = input.inquiryId ?? null;
    if (inquiryId !== null && !repo.getInquiry(inquiryId)) {
      return apiError(c, 400, 'That inquiry was not found.', { inquiryId: 'That inquiry was not found.' });
    }
    const clash = repo.conflictingBlocks(input.date, input.space)[0];
    if (clash) {
      const message = `${formatLong(input.date)} already has a ${kindLabel[clash.kind]} block for ${spaceLabel(clash.space).toLowerCase()}${
        clash.label ? ` (${clash.label})` : ''
      }. Remove that block first, or choose another date or space.`;
      return apiError(c, 409, message, { date: message });
    }
    const who = c.get('session').user;
    const stamp = iso(now());
    const block = repo.db.transaction(() => {
      const created = repo.insertBlock(
        { date: input.date, space: input.space, kind: input.kind, label: input.label, inquiryId, createdBy: who.id },
        stamp,
      );
      if (inquiryId !== null) {
        repo.addEvent(inquiryId, 'block', `${formatLong(input.date)} marked ${kindLabel[created.kind]} on the calendar by ${who.name}.`, stamp);
      }
      return created;
    })();
    return c.json(block, 201);
  });

  admin.delete('/blocks/:id', (c) => {
    const id = parseId(c.req.param('id'));
    const block = id ? repo.getBlock(id) : null;
    if (!id || !block) return apiError(c, 404, 'That calendar block was not found.');
    const who = c.get('session').user;
    const stamp = iso(now());
    repo.db.transaction(() => {
      repo.deleteBlock(id);
      if (block.inquiryId !== null && repo.getInquiry(block.inquiryId)) {
        repo.addEvent(block.inquiryId, 'block', `The ${kindLabel[block.kind]} block for ${formatLong(block.date)} was removed by ${who.name}.`, stamp);
      }
    })();
    return c.json({ ok: true as const });
  });

  return admin;
}
