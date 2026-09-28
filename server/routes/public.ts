/**
 * Public API: health, availability, form tokens, and inquiries.
 */
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { site } from '../../src/data/site';
import { availabilityFor, MAX_RANGE_DAYS } from '../../src/shared/availability';
import { capacityError } from '../../src/shared/capacity';
import { addDays, daysBetween, formatLong, isDateKey, parseKey, toKey, todayKey } from '../../src/shared/dates';
import { estimate } from '../../src/shared/pricing';
import { makeReference } from '../../src/shared/reference';
import { availabilityQuerySchema, fieldErrors, inquiryInputSchema } from '../../src/shared/schemas';
import type { AvailabilityResponse, DateKey, Estimate, InquiryCreated, SpaceChoice } from '../../src/shared/types';
import { apiError, clientIp, iso, readBody, type AppEnv, type ServerContext } from '../context';
import { guestConfirmationEmail, spaceLabel, venueNotificationEmail } from '../email/templates';
import type { EmailMessage } from '../email/mailer';
import { checkFormToken, issueFormToken } from '../security';

export const INQUIRY_LIMITS = { perHour: 5, perDay: 20 } as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const BOOLEAN_FIELDS = ['wantsVisit', 'servingAlcohol'] as const;
const OPTIONAL_TEXT_FIELDS = ['eventTypeOther', 'altDate', 'phone', 'message', 'visitNotes'] as const;
const TRUE_WORDS = new Set(['true', 'on', '1', 'yes']);

/** Make form-encoded and JSON bodies look the same before validation. */
export function normalizeInquiryBody(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const key of BOOLEAN_FIELDS) {
    const v = out[key];
    if (typeof v === 'string') out[key] = TRUE_WORDS.has(v.trim().toLowerCase());
    else if (typeof v === 'number') out[key] = v !== 0;
    else if (v === null) delete out[key];
  }
  for (const key of OPTIONAL_TEXT_FIELDS) {
    const v = out[key];
    if (v === null || (typeof v === 'string' && v.trim() === '')) delete out[key];
  }
  // Never let a client-side estimate or status through, even though zod strips unknown keys.
  delete out.estimate;
  delete out.status;
  return out;
}

/** The latest bookable date: the same calendar day two years from today. */
export function latestBookableDate(today: DateKey): DateKey {
  const { y, m, d } = parseKey(today);
  return toKey(y + 2, m, d);
}

function conflictNote(ctx: ServerContext, date: DateKey, space: SpaceChoice): string | null {
  const conflicts = ctx.repo.conflictingBlocks(date, space);
  if (conflicts.length === 0) return null;
  const b = conflicts[0];
  const what = b.label ? `${b.kind}: ${b.label}` : b.kind;
  return `The calendar already shows ${formatLong(date)} as taken for ${spaceLabel(b.space).toLowerCase()} (${what}). Check it before you confirm this request.`;
}

async function deliver(ctx: ServerContext, inquiryId: number, kind: string, label: string, message: EmailMessage): Promise<void> {
  const { repo, mailer, now, log } = ctx;
  try {
    const result = await mailer.send(message);
    repo.logEmail(
      { inquiryId, kind, to: message.to, subject: message.subject, status: result.status, transport: mailer.transport, messageId: result.messageId, location: result.location },
      iso(now()),
    );
    repo.addEvent(
      inquiryId,
      'email',
      result.status === 'sent' ? `${label} sent to ${message.to}.` : `${label} to ${message.to} saved to the outbox (email sending is not set up).`,
      iso(now()),
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.error(`[email] ${kind} for inquiry ${inquiryId} failed:`, reason);
    repo.logEmail(
      { inquiryId, kind, to: message.to, subject: message.subject, status: 'failed', transport: mailer.transport, error: reason.slice(0, 1000) },
      iso(now()),
    );
    repo.addEvent(inquiryId, 'email', `${label} to ${message.to} could not be sent: ${reason.slice(0, 200)}`, iso(now()));
  }
}

export async function sendInquiryEmails(ctx: ServerContext, inquiryId: number, est: Estimate, conflict: string | null): Promise<void> {
  const inquiry = ctx.repo.getInquiry(inquiryId);
  if (!inquiry) return;
  const origin = ctx.config.publicOrigin;
  const venue = venueNotificationEmail(inquiry, est, { origin, conflict });
  await deliver(ctx, inquiryId, 'venue_notification', 'Venue notification', {
    to: ctx.config.notifyTo,
    replyTo: { name: inquiry.name, address: inquiry.email },
    ...venue,
    tag: `${inquiry.reference}-venue`,
  });
  const guest = guestConfirmationEmail(inquiry, est, { origin });
  await deliver(ctx, inquiryId, 'guest_confirmation', 'Confirmation email', {
    to: inquiry.email,
    replyTo: ctx.config.notifyTo,
    ...guest,
    tag: `${inquiry.reference}-guest`,
  });
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && String((err as { code?: string }).code ?? '').startsWith('SQLITE_CONSTRAINT');
}

export function publicRoutes(ctx: ServerContext): Hono<AppEnv> {
  const api = new Hono<AppEnv>();
  const { config, repo, now } = ctx;

  api.get('/health', (c) => {
    try {
      repo.db.prepare('SELECT 1').get();
    } catch {
      return apiError(c, 503, 'The database is not available.');
    }
    return c.json({ ok: true, time: iso(now()) });
  });

  api.get('/availability', (c) => {
    const today = todayKey(new Date(now()));
    const from = c.req.query('from') || today;
    const to = c.req.query('to') || (isDateKey(from) ? addDays(from, 89) : from);
    const parsed = availabilityQuerySchema.safeParse({ from, to });
    if (!parsed.success) return apiError(c, 400, 'Choose a valid date range.', fieldErrors(parsed.error));
    if (to < from) return apiError(c, 400, 'The end date must be on or after the start date.', { to: 'The end date must be on or after the start date.' });
    if (daysBetween(from, to) > MAX_RANGE_DAYS) {
      return apiError(c, 400, `Ask for ${MAX_RANGE_DAYS} days or fewer at a time.`, { to: `Ask for ${MAX_RANGE_DAYS} days or fewer at a time.` });
    }
    const body: AvailabilityResponse = { from, to, days: availabilityFor(from, to, repo.blocksBetween(from, to), today) };
    return c.json(body);
  });

  api.get('/form-token', (c) => c.json({ token: issueFormToken(config.formTokenSecret, now()) }));

  api.post('/inquiries', async (c) => {
    const raw = await readBody(c, true);
    if (!raw) return apiError(c, 400, 'We could not read your request. Refresh the page and try again.');

    // 1. Honeypot: people never see the "website" field, so anything in it means a bot.
    if (typeof raw.website === 'string' && raw.website.trim() !== '') {
      ctx.log.warn('[inquiry] honeypot filled; rejected');
      return apiError(c, 400, `We could not send your request. Call us at ${site.contact.phone} and we will help.`);
    }

    // 2. Rate limits per client IP, counted from stored inquiries so they survive restarts.
    const nowMs = now();
    const ipHash = ctx.hashIp(clientIp(c, config.trustProxy));
    const lastHour = repo.countInquiriesFromIp(ipHash, iso(nowMs - HOUR));
    const lastDay = repo.countInquiriesFromIp(ipHash, iso(nowMs - DAY));
    if (lastHour >= INQUIRY_LIMITS.perHour || lastDay >= INQUIRY_LIMITS.perDay) {
      c.header('Retry-After', String(lastHour >= INQUIRY_LIMITS.perHour ? 3600 : 86400));
      return apiError(c, 429, `You have sent several requests already. Call us at ${site.contact.phone} and we will help.`);
    }

    // 3. Signed form token: proves the form was loaded here, at least a few seconds ago.
    const token = typeof raw.formToken === 'string' ? raw.formToken : '';
    const check = checkFormToken(config.formTokenSecret, token, nowMs);
    if (!check.ok) {
      return apiError(
        c,
        400,
        check.reason === 'too-fast'
          ? 'That was quick. Wait a few seconds, then send your request again.'
          : 'This form has expired. Refresh the page and send your request again.',
      );
    }

    // 4. Validate with the shared schema, then the rules that depend on today and capacity.
    const parsed = inquiryInputSchema.safeParse(normalizeInquiryBody(raw));
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      const messages = Object.values(fields);
      return apiError(c, 400, messages.length === 1 ? messages[0] : 'Check the highlighted fields.', fields);
    }
    const input = parsed.data;
    const today = todayKey(new Date(nowMs));
    const latest = latestBookableDate(today);
    const fields: Record<string, string> = {};
    if (input.date < today) fields.date = 'Choose a date that has not passed.';
    else if (input.date > latest) fields.date = 'Choose a date within the next two years.';
    if (input.altDate && input.altDate < today) fields.altDate = 'Choose an alternate date that has not passed.';
    else if (input.altDate && input.altDate > latest) fields.altDate = 'Choose an alternate date within the next two years.';
    const tooMany = capacityError(input.space, input.guests);
    if (tooMany) fields.guests = tooMany;
    const messages = Object.values(fields);
    if (messages.length > 0) return apiError(c, 400, messages.length === 1 ? messages[0] : 'Check the highlighted fields.', fields);

    // 5. Price it here; never trust a client-side estimate.
    const est = estimate({ date: input.date, space: input.space, hours: input.hours, eventType: input.eventType }, undefined, today);
    const conflict = conflictNote(ctx, input.date, input.space);
    const userAgent = (c.req.header('user-agent') ?? '').slice(0, 400) || null;

    let id = 0;
    let reference = '';
    for (let attempt = 0; attempt < 8 && id === 0; attempt++) {
      reference = makeReference((n) => randomBytes(n));
      const stamp = iso(nowMs);
      try {
        id = repo.db.transaction(() => {
          const newId = repo.insertInquiry(
            {
              reference,
              eventType: input.eventType,
              eventTypeOther: input.eventTypeOther || undefined,
              date: input.date,
              altDate: input.altDate || undefined,
              startTime: input.startTime,
              hours: input.hours,
              space: input.space,
              guests: input.guests,
              name: input.name,
              email: input.email,
              phone: input.phone || undefined,
              contactPreference: input.contactPreference,
              message: input.message || undefined,
              wantsVisit: input.wantsVisit,
              visitNotes: input.visitNotes || undefined,
              servingAlcohol: input.servingAlcohol,
              estimate: est,
              ipHash,
              userAgent,
            },
            stamp,
          );
          repo.addEvent(newId, 'created', 'Request received through the website.', stamp);
          if (conflict) repo.addEvent(newId, 'block', conflict, stamp);
          return newId;
        })();
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    if (id === 0) throw new Error('Could not allocate a unique reference.');

    // 6. Email the venue and the guest in the background. Failures are logged, never returned.
    ctx.tasks.run(`emails for ${reference}`, () => sendInquiryEmails(ctx, id, est, conflict));

    const body: InquiryCreated = { ok: true, reference, estimate: est };
    return c.json(body, 201);
  });

  return api;
}
