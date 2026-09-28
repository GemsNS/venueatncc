/**
 * CSV export of inquiries, shared by the API server and the demo backend so both produce
 * identical files. Cells that could be read as spreadsheet formulas are neutralised.
 */
import type { Inquiry } from './types';

export const CSV_COLUMNS: { key: keyof Inquiry; label: string }[] = [
  { key: 'reference', label: 'Reference' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Received' },
  { key: 'date', label: 'Event date' },
  { key: 'altDate', label: 'Alternate date' },
  { key: 'startTime', label: 'Start time' },
  { key: 'hours', label: 'Hours' },
  { key: 'space', label: 'Space' },
  { key: 'guests', label: 'Guests' },
  { key: 'eventType', label: 'Event type' },
  { key: 'eventTypeOther', label: 'Event type (other)' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'contactPreference', label: 'Contact preference' },
  { key: 'servingAlcohol', label: 'Serving alcohol' },
  { key: 'wantsVisit', label: 'Wants a visit' },
  { key: 'visitNotes', label: 'Visit notes' },
  { key: 'estimateTotal', label: 'Estimate (USD)' },
  { key: 'message', label: 'Message' },
];

const QUOTE = String.fromCharCode(34);
const FORMULA_START = /^[=+@-]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = QUOTE + s.split(QUOTE).join(QUOTE + QUOTE) + QUOTE;
  return s;
}

export function inquiriesToCsv(rows: Inquiry[]): string {
  const lines = [CSV_COLUMNS.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => cell(r[c.key])).join(','));
  return lines.join(String.fromCharCode(13, 10)) + String.fromCharCode(13, 10);
}
