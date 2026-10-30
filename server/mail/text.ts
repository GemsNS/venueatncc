/**
 * Text helpers for the admin's mail: thread keys, snippets, the signature, and replies (quoted
 * text and the HTML part). Pure functions, shared by the server and its tests.
 */
import { VENUE_TZ } from '../../src/shared/dates';
import { formatAddress, signature } from '../../src/shared/mail-text';
import type { MailAddress } from '../../src/shared/types';

export { formatAddress, replySubject, signature, snippetOf, subjectKey } from '../../src/shared/mail-text';

/** "<abc@host>" or " abc@host " to "abc@host". */
export function cleanMessageId(id: string | null | undefined): string | null {
  const v = (id ?? '').trim().replace(/^<|>$/g, '').trim();
  return v && v.length <= 500 ? v : null;
}

/** Message ids from a References or In-Reply-To value (a string of <ids>, or a list). */
export function messageIds(value: string | string[] | null | undefined): string[] {
  const list = Array.isArray(value) ? value : (value ?? '').split(/\s+/);
  return list.map((v) => cleanMessageId(v)).filter((v): v is string => v !== null);
}

const quoteDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: VENUE_TZ,
});

export interface Quoted {
  from: MailAddress;
  sentAt: string;
  text: string;
}

function quoteHeader(q: Quoted): string {
  return `On ${quoteDate.format(new Date(q.sentAt))}, ${formatAddress(q.from)} wrote:`;
}

/** The plain text part: the message, the signature, then the message being answered, quoted. */
export function replyText(body: string, adminName: string, quoted?: Quoted): string {
  const parts = [body.trim(), '', signature(adminName)];
  if (quoted) {
    const lines = quoted.text.replace(/\s+$/, '').split(/\r?\n/);
    parts.push('', quoteHeader(quoted), ...lines.map((l) => (l ? `> ${l}` : '>')));
  }
  return parts.join('\n');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** The HTML part: the same words as replyText, nothing more. */
export function replyHtml(body: string, adminName: string, quoted?: Quoted): string {
  let html = paragraphs(body) + paragraphs(signature(adminName));
  if (quoted) {
    html +=
      `<p style="margin:0 0 0.5em;color:#555">${escapeHtml(quoteHeader(quoted))}</p>` +
      `<blockquote style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex;color:#555">${paragraphs(quoted.text)}</blockquote>`;
  }
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">${html}</body></html>`;
}

/** A Message-ID for mail the venue sends: "<random@venueatncc.org>". */
export function newMessageId(random: string, address: string): string {
  const domain = address.split('@')[1] || 'venueatncc.org';
  return `<${random}@${domain}>`;
}
