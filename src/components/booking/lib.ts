/**
 * Small helpers shared by the booking islands. Keep this free of zod and the API client so the
 * lighter islands (the date checker) stay lean.
 */
import { href } from '../../lib/paths';
import { CAPACITY } from '../../shared/capacity';
import { formatLong, formatShort, formatTime, isDateKey, parseKey, toKey } from '../../shared/dates';
import { CLOSED_DAY_MESSAGE, CLOSES_HOUR, OPENS_HOUR, dayTypes, maxHoursFrom, minimumHours, type DayType } from '../../shared/booking-rules';
import { SINGLE_SPACE_IDS, SPACE_CHOICES, SPACE_NAMES, isSpaceChoice, spaceParts, type DateKey, type SingleSpace, type SpaceChoice } from '../../shared/types';

export { spaceParts };
import type { CalStatus } from './Calendar';

export const ELLIPSIS = String.fromCharCode(8230);
export const MIDDOT = String.fromCharCode(183);
export const NBSP = String.fromCharCode(160);

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
  if (status === 'closed') return CLOSED_DAY_MESSAGE;
  return `${formatShort(date)} is booked. Choose another date.`;
}

export const SPACES: SpaceChoice[] = [...SPACE_CHOICES];
export const SINGLE_SPACES: SingleSpace[] = SINGLE_SPACE_IDS;

/** The public name: The Hall, The Main Hall, The Grove, or The Hall and The Grove. */
export function spaceLabel(space: SpaceChoice): string {
  return SPACE_NAMES[space];
}

/** Names joined for a sentence: "The Hall", "The Hall and The Grove", "The Hall, The Main Hall, and The Grove". */
export function listSpaces(spaces: SpaceChoice[]): string {
  const names = spaces.map(spaceLabel);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * One sentence on which single spaces are open on a day where some are booked, e.g. "The Hall is booked
 * on Sat, Oct 17. The Main Hall and The Grove are open." Empty when all are open or all are booked.
 */
export function partlyBookedNote(taken: SingleSpace[], dateLabel: string): string {
  const open = SINGLE_SPACES.filter((s) => !taken.includes(s));
  if (taken.length === 0 || open.length === 0) return '';
  const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);
  return `${listSpaces(taken)} ${verb(taken.length, 'is', 'are')} booked on ${dateLabel}. ${listSpaces(open)} ${verb(open.length, 'is', 'are')} open.`;
}

/** The title of each space choice in the booking form. */
export const SPACE_CHOICE_TITLE: Record<SpaceChoice, string> = {
  indoor: SPACE_NAMES.indoor,
  main: SPACE_NAMES.main,
  outdoor: SPACE_NAMES.outdoor,
  both: SPACE_NAMES.both,
};

/** One line under each space choice: what it is, and how many guests it holds. */
export const SPACE_HINT: Record<SpaceChoice, string> = {
  indoor: `Indoor, up to ${CAPACITY.indoor} guests`,
  main: `Indoor auditorium, up to ${CAPACITY.main} guests`,
  outdoor: `Outdoor, up to ${CAPACITY.outdoor} guests`,
  both: `${SPACE_NAMES.indoor} up to ${CAPACITY.indoor}, ${SPACE_NAMES.outdoor} up to ${CAPACITY.outdoor}`,
};

export const HOURS_MIN = 1;
/** The longest event: 9:00 AM to 12:00 midnight. */
export const HOURS_MAX = CLOSES_HOUR - OPENS_HOUR;

/** The most hours a start time allows before 12:00 midnight, within HOURS_MAX. */
export const hoursMaxFor = (startTime: string) => Math.max(HOURS_MIN, Math.min(HOURS_MAX, maxHoursFrom(startTime)));

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

/**
 * Start times in 30-minute steps within building hours: from 9:00 AM to 11:00 PM, the last start that
 * leaves an hour before 12:00 midnight.
 */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: (CLOSES_HOUR - 1 - OPENS_HOUR) * 2 + 1 }, (_, i) => {
  const h = String(OPENS_HOUR + Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  const value = `${h}:${m}`;
  return { value, label: formatTime(value) };
});

/** The start times that leave room for at least minHours before 12:00 midnight. */
export const timeOptionsFor = (minHours: number) => TIME_OPTIONS.filter((t) => maxHoursFrom(t.value) >= minHours);

/** The latest start time that leaves room for this many hours, for moving a start that no longer fits. */
export function latestStartFor(hours: number): string {
  const fits = TIME_OPTIONS.filter((t) => maxHoursFrom(t.value) >= hours);
  return (fits[fits.length - 1] ?? TIME_OPTIONS[0]).value;
}

/** A plain sentence about the minimum booking length for a day type (the one booking rule the site states). */
export function minimumHoursNote(dayType: DayType): string {
  const min = minimumHours[dayType];
  return `${dayTypes[dayType].label} bookings have a ${min}-hour minimum.`;
}

export function hoursLabel(n: number): string {
  return `${n}${NBSP}${n === 1 ? 'hour' : 'hours'}`;
}

export function guestsLabel(n: number): string {
  return `${n}${NBSP}${n === 1 ? 'guest' : 'guests'}`;
}

export function parseSpace(v: string | null | undefined): SpaceChoice | null {
  return isSpaceChoice(v) ? v : null;
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
