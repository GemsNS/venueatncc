/**
 * Booking wizard state: the draft, its defaults, prefill from the URL, and validation.
 * Validation reuses inquiryInputSchema so the browser and the server agree on every message.
 */
import { eventTypes } from '../../data/event-types';
import { spaceIsFree } from '../../shared/availability';
import { capacityError } from '../../shared/capacity';
import { formatShort } from '../../shared/dates';
import { dayTypeOf, pricing } from '../../shared/pricing';
import { fieldErrors, inquiryInputSchema } from '../../shared/schemas';
import type { AvailabilityDay, ContactPreference, DateKey, InquiryInput, SpaceChoice } from '../../shared/types';
import { HOURS_MAX, HOURS_MIN, TOO_LATE_MESSAGE, latestBookableDate, parseDate, parseIntIn, parseSpace, spaceLabel } from './lib';

export type Step = 1 | 2 | 3 | 4;

/** title: the step heading. nav: the clickable progress label, in the same sentence case. */
export const STEPS: { n: Step; title: string; nav: string }[] = [
  { n: 1, title: 'Date and space', nav: 'Date and space' },
  { n: 2, title: 'Your event', nav: 'Your event' },
  { n: 3, title: 'Contact', nav: 'Contact' },
  { n: 4, title: 'Review', nav: 'Review' },
];

export const GUESTS_MIN = 1;
export const GUESTS_MAX = 1000;

export interface Draft {
  v: 1;
  step: Step;
  reached: Step;
  date: DateKey | '';
  space: SpaceChoice;
  /** True once the person picks a space themselves; until then the space follows the guest count. */
  spaceChosen: boolean;
  startTime: string;
  hours: number;
  guests: number;
  eventType: string;
  eventTypeOther: string;
  wantsVisit: boolean;
  visitNotes: string;
  name: string;
  email: string;
  phone: string;
  contactPreference: ContactPreference;
  message: string;
  /** The query string already applied, so a refresh does not overwrite later edits. */
  appliedSearch: string;
}

export const DEFAULT_DRAFT: Draft = {
  v: 1,
  step: 1,
  reached: 1,
  date: '',
  space: 'indoor',
  spaceChosen: false,
  startTime: '17:00',
  hours: 4,
  guests: 50,
  eventType: '',
  eventTypeOther: '',
  wantsVisit: false,
  visitNotes: '',
  name: '',
  email: '',
  phone: '',
  contactPreference: 'email',
  message: '',
  appliedSearch: '',
};

export const DRAFT_KEY = 'venueatncc:booking-draft';

const isStep = (n: unknown): n is Step => n === 1 || n === 2 || n === 3 || n === 4;

/** Accept a saved draft only if it has the right shape. */
export function restoreDraft(saved: unknown): Draft | null {
  if (!saved || typeof saved !== 'object') return null;
  const s = saved as Partial<Draft>;
  if (s.v !== 1) return null;
  const out: Draft = { ...DEFAULT_DRAFT };
  for (const key of Object.keys(DEFAULT_DRAFT) as (keyof Draft)[]) {
    const val = s[key];
    if (val !== undefined && typeof val === typeof DEFAULT_DRAFT[key]) (out as unknown as Record<string, unknown>)[key] = val;
  }
  if (!isStep(out.step)) out.step = 1;
  if (!isStep(out.reached)) out.reached = out.step;
  if (!parseSpace(out.space)) out.space = 'indoor';
  if (out.date && !parseDate(out.date)) out.date = '';
  return out;
}

/** Prefill from ?date=&space=&guests=&event=&hours=&visit=1 (links from the home page, pricing, and the space page). */
/** The fewest hours that can be booked on a date: the day's minimum from the rate card, or HOURS_MIN with no date. */
export function minHoursFor(date: DateKey | ''): number {
  return date ? Math.max(HOURS_MIN, pricing.minimumHours[dayTypeOf(date)]) : HOURS_MIN;
}

/**
 * Raises the hours to the chosen day's minimum (a Saturday bills at least 5), so the stepper, the time
 * range, and the estimate always show the same length.
 */
export function withMinimumHours(d: Draft): Draft {
  const min = minHoursFor(d.date);
  return d.hours < min ? { ...d, hours: min } : d;
}

export function applySearch(draft: Draft, params: URLSearchParams, today: DateKey): Draft {
  const next = { ...draft };
  const date = parseDate(params.get('date'));
  if (date && date >= today && date <= latestBookableDate(today)) next.date = date;
  const space = parseSpace(params.get('space'));
  if (space) {
    next.space = space;
    next.spaceChosen = true;
  }
  const guests = parseIntIn(params.get('guests'), GUESTS_MIN, GUESTS_MAX);
  if (guests !== null) next.guests = guests;
  const hours = parseIntIn(params.get('hours'), HOURS_MIN, HOURS_MAX);
  if (hours !== null) next.hours = hours;
  const event = params.get('event');
  if (event && (event === 'other' || eventTypes.some((e) => e.slug === event))) next.eventType = event;
  if (params.get('visit') === '1') next.wantsVisit = true;
  if (date || space || guests !== null || hours !== null) {
    next.step = 1;
  }
  return next;
}

/** Which step owns each field, for routing server errors and the error summary. */
export const FIELD_STEP: Record<string, Step> = {
  date: 1,
  altDate: 1,
  space: 1,
  guests: 1,
  startTime: 1,
  hours: 1,
  eventType: 2,
  eventTypeOther: 2,
  wantsVisit: 2,
  visitNotes: 2,
  name: 3,
  email: 3,
  phone: 3,
  contactPreference: 3,
  message: 3,
};

/** Field order within the form, so the error summary reads top to bottom. */
const FIELD_ORDER = Object.keys(FIELD_STEP);
export const orderFields = (keys: string[]) =>
  [...keys].sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a);
    const ib = FIELD_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

export const fieldId = (field: string) => `bk-f-${field}`;
export const errorId = (field: string) => `bk-f-${field}-err`;

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

export function buildInput(d: Draft, formToken: string, website: string): InquiryInput {
  return {
    eventType: d.eventType,
    eventTypeOther: d.eventType === 'other' ? opt(d.eventTypeOther) : undefined,
    date: d.date,
    startTime: d.startTime,
    hours: d.hours,
    space: d.space,
    guests: d.guests,
    name: d.name.trim(),
    email: d.email.trim(),
    phone: opt(d.phone),
    contactPreference: d.contactPreference,
    message: opt(d.message),
    wantsVisit: d.wantsVisit,
    visitNotes: d.wantsVisit ? opt(d.visitNotes) : undefined,
    formToken,
    website,
  };
}

/** Email check used on blur. Returns a message or null. */
export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  const r = inquiryInputSchema.shape.email.safeParse(v);
  return r.success ? null : (r.error.issues[0]?.message ?? 'Enter a valid email address.');
}

export interface ValidationContext {
  today: DateKey;
  day: AvailabilityDay | undefined;
}

/** Validate one step (or all of them). Returns { field: message }. */
export function validate(d: Draft, steps: Step[], ctx: ValidationContext): Record<string, string> {
  const parsed = inquiryInputSchema.safeParse(buildInput(d, 'placeholder-form-token', ''));
  const base = parsed.success ? {} : fieldErrors(parsed.error);
  const out: Record<string, string> = {};
  const want = (f: string) => steps.includes(FIELD_STEP[f]);

  for (const [field, msg] of Object.entries(base)) if (want(field)) out[field] = msg;

  if (want('date')) {
    if (!d.date) out.date = 'Choose a date.';
    else if (d.date < ctx.today) out.date = 'Choose a date from today on.';
    else if (d.date > latestBookableDate(ctx.today)) out.date = TOO_LATE_MESSAGE;
    else if (ctx.day?.status === 'booked') out.date = 'That date is booked. Choose another date.';
  }
  if (want('space') && d.date && ctx.day && ctx.day.status !== 'booked' && !spaceIsFree(ctx.day, d.space)) {
    out.space = `${spaceLabel(d.space)} is booked on ${formatShort(d.date)}. Choose another space.`;
  }
  if (want('guests') && !out.guests) {
    const cap = capacityError(d.space, d.guests);
    if (cap) out.guests = cap;
  }
  if (want('eventType')) {
    if (!d.eventType) out.eventType = 'Choose the kind of event.';
    else if (d.eventType === 'other' && !d.eventTypeOther.trim()) out.eventTypeOther = 'Tell us what kind of event.';
  }
  if (want('email')) {
    const e = emailError(d.email);
    if (e) out.email = e;
    else delete out.email;
  }
  if (want('phone') && !out.phone) {
    const digits = d.phone.replace(/[^0-9]/g, '');
    if ((d.contactPreference === 'phone' || d.contactPreference === 'text') && !digits) {
      out.phone = d.contactPreference === 'text' ? 'Add a mobile number so we can text you.' : 'Add a phone number so we can call you.';
    } else if (digits && digits.length < 10) {
      out.phone = 'Enter your phone number with the area code.';
    }
  }
  return out;
}
