/**
 * Date helpers shared by the server, the demo backend, and the UI.
 * Dates are plain YYYY-MM-DD keys in the venue's local time (America/New_York),
 * so there is no timezone drift between browser, server, and database.
 */
import type { DateKey } from './types';

export const VENUE_TZ = 'America/New_York';

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(y: number, m: number, d: number): DateKey {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseKey(key: DateKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function isDateKey(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const { y, m, d } = parseKey(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 0 = Sunday ... 6 = Saturday, independent of the machine's timezone. */
export function dayOfWeek(key: DateKey): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(key: DateKey, days: number): DateKey {
  const { y, m, d } = parseKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Today's date key in the venue's timezone. */
export function todayKey(now: Date = new Date()): DateKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return toKey(get('year'), get('month'), get('day'));
}

export function daysBetween(a: DateKey, b: DateKey): number {
  const pa = parseKey(a);
  const pb = parseKey(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

/** "Saturday, October 17, 2026" */
export function formatLong(key: DateKey): string {
  const { y, m, d } = parseKey(key);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Sat, Oct 17" */
export function formatShort(key: DateKey): string {
  const { y, m, d } = parseKey(key);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "6:00 PM" from "18:00" */
export function formatTime(hhmm: string): string {
  const [h, min] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${suffix}`;
}

/** When an event ends, for display: "10:00 PM", or "midnight" when it ends exactly at 12:00 AM. */
export function formatEndTime(startTime: string, hours: number): string {
  const end = addHours(startTime, hours);
  return end === '00:00' ? 'midnight' : formatTime(end);
}

/** End time "HH:MM" after adding hours (may pass midnight; returns the wall-clock time). */
export function addHours(hhmm: string, hours: number): string {
  const [h, min] = hhmm.split(':').map(Number);
  const total = (h * 60 + min + Math.round(hours * 60)) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Month grid for a calendar: weeks of 7 date keys (null outside the month). Weeks start on Sunday. */
export function monthGrid(year: number, month: number): (DateKey | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (DateKey | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DateKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
