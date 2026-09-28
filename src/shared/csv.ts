/**
 * CSV export of inquiries, shared by the API server and the demo backend so both produce
 * identical files. Values are written the way the admin shows them (status, space, event type,
 * and contact labels; the received time in the venue's time zone), cells that could be read as
 * spreadsheet formulas are neutralised, and the file starts with a UTF-8 byte order mark so
 * Excel on Windows reads accented names correctly.
 */
import { eventTypeName } from '../data/event-types';
import { VENUE_TZ } from './dates';
import { pricing } from './pricing';
import { INQUIRY_STATUSES } from './types';
import type { ContactPreference, Inquiry } from './types';

export interface CsvColumn {
  key: keyof Inquiry;
  label: string;
  /** How the value reads in the file; the raw value when absent. */
  format?: (row: Inquiry) => string | undefined;
}

const CONTACT_LABEL: Record<ContactPreference, string> = { email: 'Email', phone: 'Phone call', text: 'Text message' };

let receivedFormat: Intl.DateTimeFormat | null = null;

/** "2026-09-28 01:40": an ISO timestamp as the venue's local date and 24-hour time. */
export function formatReceived(isoTime: string): string {
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return isoTime;
  receivedFormat ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = receivedFormat.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export const CSV_COLUMNS: CsvColumn[] = [
  { key: 'reference', label: 'Reference' },
  { key: 'status', label: 'Status', format: (r) => INQUIRY_STATUSES.find((s) => s.id === r.status)?.label },
  { key: 'createdAt', label: 'Received (Eastern)', format: (r) => formatReceived(r.createdAt) },
  { key: 'date', label: 'Event date' },
  { key: 'altDate', label: 'Alternate date' },
  { key: 'startTime', label: 'Start time' },
  { key: 'hours', label: 'Hours' },
  { key: 'space', label: 'Space', format: (r) => pricing.spaces[r.space]?.label },
  { key: 'guests', label: 'Guests' },
  { key: 'eventType', label: 'Event type', format: (r) => eventTypeName(r.eventType) },
  { key: 'eventTypeOther', label: 'Event type (other)' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'contactPreference', label: 'Contact preference', format: (r) => CONTACT_LABEL[r.contactPreference] },
  { key: 'servingAlcohol', label: 'Serving alcohol' },
  { key: 'wantsVisit', label: 'Wants a visit' },
  { key: 'visitNotes', label: 'Visit notes' },
  { key: 'estimateTotal', label: 'Estimate (USD)' },
  { key: 'message', label: 'Message' },
];

/** The UTF-8 byte order mark that starts every export. */
export const CSV_BOM = String.fromCharCode(0xfeff);

const QUOTE = String.fromCharCode(34);
const CRLF = String.fromCharCode(13, 10);
const FORMULA_START = /^[=+@-]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = QUOTE + s.split(QUOTE).join(QUOTE + QUOTE) + QUOTE;
  return s;
}

function valueOf(column: CsvColumn, row: Inquiry): unknown {
  const raw = row[column.key];
  if (!column.format || raw === undefined || raw === null) return raw;
  return column.format(row) ?? raw;
}

export function inquiriesToCsv(rows: Inquiry[]): string {
  const lines = [CSV_COLUMNS.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => cell(valueOf(c, r))).join(','));
  return CSV_BOM + lines.join(CRLF) + CRLF;
}
