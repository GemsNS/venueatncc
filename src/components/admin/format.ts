/** Labels and formatting for the admin app. Prices always come from src/shared/pricing.ts. */
import { INQUIRY_STATUSES, SPACE_NAMES, type BlockKind, type InquiryStatus, type SpaceChoice } from '../../shared/types';
import { formatUSD } from '../../shared/pricing';
import { VENUE_TZ, addHours, formatTime } from '../../shared/dates';

export { formatUSD };
export { eventTypeName } from '../../data/event-types';

export type Tone = 'accent' | 'gray' | 'orange' | 'green' | 'red';

const STATUS_TONE: Record<InquiryStatus, Tone> = {
  new: 'accent',
  contacted: 'gray',
  visit: 'gray',
  quoted: 'orange',
  booked: 'green',
  declined: 'red',
  archived: 'gray',
};

export const OPEN_STATUSES: InquiryStatus[] = ['new', 'contacted', 'visit', 'quoted'];

export function statusLabel(status: InquiryStatus): string {
  return INQUIRY_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function statusTone(status: InquiryStatus): Tone {
  return STATUS_TONE[status] ?? 'gray';
}

export function spaceLabel(space: SpaceChoice): string {
  return SPACE_NAMES[space] ?? space;
}

/** Short space names for calendar chips. */
export const SPACE_SHORT: Record<SpaceChoice, string> = { indoor: 'Hall', outdoor: 'Grove', both: 'Both' };

export const KIND_LABEL: Record<BlockKind, string> = { booked: 'Booked', held: 'Held', closed: 'Closed' };

export const DOT = String.fromCharCode(183);
export const ELLIPSIS = String.fromCharCode(8230);
export const LDQUO = String.fromCharCode(8220);
export const RDQUO = String.fromCharCode(8221);

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const NBSP = String.fromCharCode(160);

/** "6:00 PM to 11:00 PM (5 hours)". The hour count never wraps apart from its unit. */
export function timeRange(startTime: string, hours: number): string {
  return `${formatTime(startTime)} to ${formatTime(addHours(startTime, hours))} (${plural(hours, 'hour').replace(' ', NBSP)})`;
}

const stampFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: VENUE_TZ,
});
const stampFmtYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: VENUE_TZ,
});
const yearFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: VENUE_TZ });

/** "Sep 28, 3:04 PM" (adds the year when it is not this year). */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return yearFmt.format(d) === yearFmt.format(new Date()) ? stampFmt.format(d) : stampFmtYear.format(d);
}

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "October 2026" */
export function formatMonth(y: number, m: number): string {
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)));
}

/** A dialable phone number for tel: and sms: links. */
export function dialable(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (phone.trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits;
}
