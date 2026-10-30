/**
 * Mail wording shared by the API server (server/mail) and the demo backend: thread keys, snippets,
 * reply subjects, and the signature under every email sent from the admin.
 */
import { site } from '../data/site';
import type { MailAddress } from './types';

/** The subject without Re:, Fwd:, and the like, for matching replies that lost their headers. */
export function subjectKey(subject: string): string {
  let s = subject.trim().toLowerCase();
  for (;;) {
    const next = s.replace(/^(re|fw|fwd|aw|sv|wg)\s*(\[\d+\])?\s*:\s*/, '').replace(/^\[[^\]]*\]\s*/, '');
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, ' ').slice(0, 200);
}

/** "Re: <subject>" unless it already starts with Re:. */
export function replySubject(subject: string): string {
  const s = subject.trim() || '(no subject)';
  return /^re\s*:/i.test(s) ? s : `Re: ${s}`;
}

/** The first words of the new text in a message: quoted lines and the "On ... wrote:" line left out. */
export function snippetOf(text: string, max = 160): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^On .{4,200} wrote:\s*$/.test(line.trim())) break;
    kept.push(line);
  }
  const flat = kept.join(' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}${String.fromCharCode(8230)}` : flat;
}

/** The signature under every email sent from the admin. */
export function signature(adminName: string): string {
  const host = site.url.replace(/^https?:\/\//, '');
  return [adminName, site.name, site.contact.phone, host].join('\n');
}

export const formatAddress = (a: MailAddress) => (a.name ? `${a.name} <${a.address}>` : a.address);
