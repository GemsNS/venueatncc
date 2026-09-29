/**
 * Small helpers shared by the booking islands. Keep this free of zod and the API client so the
 * lighter islands (date checker, price estimator) stay lean.
 */
import { href } from '../../lib/paths';
import { CAPACITY } from '../../shared/capacity';
import { addDays, dayOfWeek, formatLong, formatShort, formatTime, isDateKey, parseKey, toKey } from '../../shared/dates';
import { formatUSD, pricing, type DayType } from '../../shared/pricing';
import { SPACE_NAMES, type DateKey, type SpaceChoice } from '../../shared/types';
import type { CalStatus } from './Calendar';

export const ELLIPSIS = String.fromCharCode(8230);
export const MIDDOT = String.fromCharCode(183);
export const NBSP = String.fromCharCode(160);
export const MINUS = String.fromCharCode(8722);

/** Dollars with a true minus sign for discounts ("-$160" reads as a hyphen). */
export function formatMoney(n: number): string {
  return n < 0 ? `${MINUS}${formatUSD(Math.abs(n))}` : formatUSD(n);
}

/** "Wednesday, September 30, 2026" that only wraps after the weekday. */
export function formatLongKept(key: DateKey): string {
  return formatLong(key).replace(/ ([0-9])/g, `${NBSP}$1`);
}

/**
 * A chosen date as a date field shows it: "Saturday, October 17". The year is added only when it is not
 * this year's ("Saturday, January 9, 2027"), as the system date pickers do.
 */
export function formatPicked(key: DateKey, today?: DateKey | ''): string {
  const { y, m, d } = parseKey(key);
  const sameYear = !today || today.slice(0, 4) === key.slice(0, 4);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * The latest date the server accepts: the same calendar day two years from today.
 * Mirrors latestBookableDate() in server/routes/public.ts; use the shared one once it moves.
 */
export function latestBookableDate(today: DateKey): DateKey {
  const { y, m, d } = parseKey(today);
  return toKey(y + 2, m, d);
}

export const TOO_LATE_MESSAGE = 'Choose a date within the next two years.';

/** What a calendar says when someone picks a day that cannot be requested. */
export function unavailableMessage(date: DateKey, status: CalStatus): string {
  if (status === 'past') return 'That date has passed. Choose another date.';
  if (status === 'later') return TOO_LATE_MESSAGE;
  return `${formatShort(date)} is booked. Choose another date.`;
}

export const SPACES: SpaceChoice[] = ['indoor', 'outdoor', 'both'];
export const SINGLE_SPACES: ('indoor' | 'outdoor')[] = ['indoor', 'outdoor'];

/** Short segment labels (nouns, equal width) for the price estimator. */
export const SPACE_SHORT: Record<SpaceChoice, string> = { indoor: SPACE_NAMES.indoor, outdoor: SPACE_NAMES.outdoor, both: 'Both' };

/** The public name: The Hall, The Grove, or The Hall and The Grove. */
export function spaceLabel(space: SpaceChoice): string {
  return SPACE_NAMES[space];
}

/** The title of each space choice in the booking form. */
export const SPACE_CHOICE_TITLE: Record<SpaceChoice, string> = {
  indoor: SPACE_NAMES.indoor,
  outdoor: SPACE_NAMES.outdoor,
  both: 'Both spaces',
};

/** One line under each space choice: indoor or outdoor, and how many guests it holds. */
export const SPACE_HINT: Record<SpaceChoice, string> = {
  indoor: `Indoor, up to ${CAPACITY.indoor} guests`,
  outdoor: `Outdoor, up to ${CAPACITY.outdoor} guests`,
  both: `${SPACE_NAMES.indoor} up to ${CAPACITY.indoor}, ${SPACE_NAMES.outdoor} up to ${CAPACITY.outdoor}`,
};

export const HOURS_MIN = 1;
export const HOURS_MAX = 16;

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Where the booking wizard lives, with query parameters appended. */
export function bookUrl(bookHref: string | undefined, params: Record<string, string | number | undefined | null>): string {
  const base = bookHref && bookHref.length > 0 ? bookHref : href('/book/');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const str = qs.toString();
  if (!str) return base;
  return base.includes('?') ? `${base}&${str}` : `${base}?${str}`;
}

/** Start times in 30-minute steps across the whole day (venue hours are not published). */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  const value = `${h}:${m}`;
  return { value, label: formatTime(value) };
});

export const DAY_TYPES: DayType[] = ['weekday', 'friday', 'saturday', 'sunday'];

export const DAY_SHORT: Record<DayType, string> = {
  weekday: 'Mon to Thu',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/** A plain sentence about the minimum booking length for a day type, from the rate card. */
export function minimumHoursNote(dayType: DayType): string {
  const min = pricing.minimumHours[dayType];
  return `${pricing.dayTypes[dayType].label} bookings have a ${min}-hour minimum.`;
}

/**
 * A date with the given day type far enough ahead that the estimate's payment notes do not
 * depend on how soon the event is. Used when someone prices a day type without a date.
 */
export function representativeDate(dayType: DayType, today: DateKey): DateKey {
  const days = pricing.dayTypes[dayType].days;
  let d = addDays(today, pricing.bookingDeposit.balanceDueDaysBefore + 7);
  for (let i = 0; i < 7; i++) {
    if (days.includes(dayOfWeek(d))) return d;
    d = addDays(d, 1);
  }
  return d;
}

export function hoursLabel(n: number): string {
  return `${n}${NBSP}${n === 1 ? 'hour' : 'hours'}`;
}

export function guestsLabel(n: number): string {
  return `${n}${NBSP}${n === 1 ? 'guest' : 'guests'}`;
}

export function parseSpace(v: string | null | undefined): SpaceChoice | null {
  return v === 'indoor' || v === 'outdoor' || v === 'both' ? v : null;
}

export function parseDate(v: string | null | undefined): DateKey | null {
  return v && isDateKey(v) ? v : null;
}

export function parseIntIn(v: string | null | undefined, min: number, max: number): number | null {
  if (!v || !/^[0-9]{1,5}$/.test(v.trim())) return null;
  const n = Number(v.trim());
  return n >= min && n <= max ? n : null;
}

/** sessionStorage that never throws (private windows, blocked storage, previews). */
export const session = {
  get<T>(key: string): T | null {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable; the wizard still works without a saved draft
    }
  },
  remove(key: string): void {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/** Focus the first sensible control inside (or at) an element with this id. */
export function focusField(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const target = el.matches('input, select, textarea, button, a[href]')
    ? el
    : el.querySelector<HTMLElement>('[aria-checked="true"], [tabindex="0"], input, select, textarea, button');
  const node = (target ?? el) as HTMLElement;
  node.focus();
  if (typeof node.scrollIntoView === 'function') {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
  return true;
}

export const telHref = (e164: string) => `tel:${e164}`;
