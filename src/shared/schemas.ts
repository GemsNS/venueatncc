/**
 * Validation schemas shared by the API server and the browser (zod v4).
 * The server always re-validates; the browser uses the same rules for instant feedback.
 */
import { z } from 'zod';
import { isDateKey } from './dates';
import { INQUIRY_STATUSES } from './types';

const dateKey = z.string().refine(isDateKey, 'Choose a valid date.');
const hhmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Choose a start time.');
const trimmed = (max: number) => z.string().trim().max(max);

export const inquiryInputSchema = z.object({
  eventType: trimmed(60).min(1, 'Choose the kind of event.'),
  eventTypeOther: trimmed(80).optional(),
  date: dateKey,
  altDate: dateKey.optional().or(z.literal('').transform(() => undefined)),
  startTime: hhmm,
  hours: z.coerce.number().int('Choose whole hours.').min(1, 'Choose at least 1 hour.').max(16, 'For more than 16 hours, call us.'),
  space: z.enum(['indoor', 'outdoor', 'both'], { error: 'Choose a space.' }),
  guests: z.coerce.number().int('Enter a whole number.').min(1, 'Enter your guest count.').max(1000, 'Enter a realistic guest count.'),
  name: trimmed(120).min(2, 'Enter your name.'),
  email: z.email('Enter a valid email address.').max(200),
  phone: trimmed(40).optional(),
  contactPreference: z.enum(['email', 'phone', 'text']).default('email'),
  message: trimmed(4000).optional(),
  wantsVisit: z.coerce.boolean().default(false),
  visitNotes: trimmed(500).optional(),
  servingAlcohol: z.coerce.boolean().default(false),
  formToken: z.string().min(10).max(400),
  website: z.string().max(0, 'Leave this field empty.').optional(),
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
  email: z.email('Enter your email address.'),
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
