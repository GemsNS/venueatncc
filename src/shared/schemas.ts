/**
 * Validation schemas shared by the API server and the browser (zod v4).
 * The server always re-validates; the browser uses the same rules for instant feedback.
 */
import { z } from 'zod';

// Skip zod's eval probe (new Function), which the production Content-Security-Policy blocks.
z.config({ jitless: true });
import { eventTypes, OTHER_EVENT } from '../data/event-types';
import { isDateKey, parseKey, toKey } from './dates';
import { INQUIRY_STATUSES } from './types';
import type { DateKey } from './types';

const dateKey = z.string().refine(isDateKey, 'Choose a valid date.');
const hhmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Choose a start time.');
const trimmed = (max: number) => z.string().trim().max(max);

/** The latest bookable date: the same calendar day two years from today. */
export function latestBookableDate(today: DateKey): DateKey {
  const { y, m, d } = parseKey(today);
  return toKey(y + 2, m, d);
}

export const DATE_TOO_FAR = 'Choose a date within the next two years.';

/** Every event type a request may name: the listed slugs, plus "other". */
export const EVENT_TYPE_SLUGS = [...eventTypes.map((e) => e.slug), OTHER_EVENT.slug] as string[] as [string, ...string[]];

/** At least this many digits when a phone number is given (a US number with its area code). */
export const MIN_PHONE_DIGITS = 10;
export const PHONE_TOO_SHORT = 'Enter your phone number with the area code.';

const charRange = (from: number, to: number) => String.fromCharCode(from) + '-' + String.fromCharCode(to);
/**
 * Characters that never belong in a one-line field: C0 and C1 controls (including line breaks
 * and tabs), DEL, the Unicode line and paragraph separators, and bidirectional overrides and
 * isolates, which can make text display differently from what it says.
 */
const INVISIBLE_AND_BIDI =
  charRange(0x200b, 0x200f) + charRange(0x2028, 0x202e) + charRange(0x2066, 0x2069) + String.fromCharCode(0x061c) + String.fromCharCode(0xfeff);
const SPECIAL_CHARACTERS = new RegExp('[' + charRange(0, 31) + charRange(127, 159) + INVISIBLE_AND_BIDI + ']');
export const isSingleLine = (s: string) => !SPECIAL_CHARACTERS.test(s);
/**
 * Multi-line fields (message, visit notes) may contain tabs and line breaks, but not other
 * control characters (vertical tab, form feed, NEL) or invisible and direction-changing ones.
 */
const MULTILINE_SPECIAL = new RegExp(
  '[' + charRange(0, 8) + charRange(11, 12) + charRange(14, 31) + charRange(127, 159) + INVISIBLE_AND_BIDI + ']',
);
const multiLine = (max: number) => trimmed(max).refine((s) => !MULTILINE_SPECIAL.test(s), SINGLE_LINE_ERROR_MULTI);
export const SINGLE_LINE_ERROR = 'Remove line breaks and special characters.';
const SINGLE_LINE_ERROR_MULTI = 'Remove special characters.';
const singleLine = (max: number) => trimmed(max).refine(isSingleLine, SINGLE_LINE_ERROR);

export const inquiryInputSchema = z.object({
  eventType: z.enum(EVENT_TYPE_SLUGS, { error: 'Choose the kind of event.' }),
  eventTypeOther: singleLine(80).optional(),
  date: dateKey,
  altDate: dateKey.optional().or(z.literal('').transform(() => undefined)),
  startTime: hhmm,
  hours: z.coerce.number().int('Choose whole hours.').min(1, 'Choose at least 1 hour.').max(16, 'For more than 16 hours, call us.'),
  space: z.enum(['indoor', 'outdoor', 'both'], { error: 'Choose a space.' }),
  guests: z.coerce.number().int('Enter a whole number.').min(1, 'Enter your guest count.').max(1000, 'Enter a guest count of 1,000 or fewer.'),
  name: singleLine(120).min(2, 'Enter your name.'),
  email: z.email('Enter a valid email address.').max(200),
  phone: singleLine(40).optional(),
  contactPreference: z.enum(['email', 'phone', 'text']).default('email'),
  message: multiLine(4000).optional(),
  wantsVisit: z.coerce.boolean().default(false),
  visitNotes: multiLine(500).optional(),
  formToken: z.string().min(10).max(400),
  website: z.string().max(0, 'Leave this field empty.').optional(),
}).superRefine((v, ctx) => {
  if ((v.contactPreference === 'phone' || v.contactPreference === 'text') && !v.phone) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Add a phone number so we can reach you that way.' });
  } else if (v.phone && v.phone.replace(/[^0-9]/g, '').length < MIN_PHONE_DIGITS) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: PHONE_TOO_SHORT });
  }
  if (v.eventType === 'other' && !v.eventTypeOther) {
    ctx.addIssue({ code: 'custom', path: ['eventTypeOther'], message: 'Tell us what kind of event you are planning.' });
  }
});

export type InquiryInputParsed = z.infer<typeof inquiryInputSchema>;

export const statusUpdateSchema = z.object({
  status: z.enum(INQUIRY_STATUSES.map((s) => s.id) as [string, ...string[]]),
});

export const noteInputSchema = z.object({
  body: z.string().trim().min(1, 'Write a note first.').max(4000),
});

export const blockInputSchema = z.object({
  date: dateKey,
  space: z.enum(['indoor', 'outdoor', 'both']),
  kind: z.enum(['booked', 'held', 'closed']),
  label: z.string().trim().max(120).default(''),
  inquiryId: z.coerce.number().int().positive().nullable().optional(),
});

export const loginSchema = z.object({
  email: z.email('Enter your email address.').max(200, 'Enter your email address.'),
  password: z.string().min(1, 'Enter your password.').max(500),
});

export const passwordChangeSchema = z.object({
  current: z.string().min(1).max(500),
  next: z.string().min(12, 'Use at least 12 characters.').max(500),
});

export const availabilityQuerySchema = z.object({
  from: dateKey,
  to: dateKey,
});

/** Flatten zod issues into { field: message } for the UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
