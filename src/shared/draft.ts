/**
 * Reply drafts for the admin's mail (the Draft and Rewrite buttons in the reply boxes).
 * Shared by the API server (server/mail/draft.ts, which asks Claude) and the demo backend, so both
 * build a draft from the same facts, clean it the same way, and flag the same problems.
 *
 * Every fact comes from the site's own data at run time (site.ts, rate-card.ts, booking-rules.ts, faq.ts),
 * so a change to the rates or the rules reaches the drafts with no edit here. The rules mirror
 * docs/design/brand.md: the exact business name, no church connection, no drinks, no outside-caterer
 * wording, no booking lead times, no gazebo roof, no em or en dashes.
 */
import { faqs, publishedFaqs } from '../data/faq';
import { site } from '../data/site';
import { eventTypeName } from '../data/event-types';
import { ACCESS_HOURS, CLOSED_HOLIDAYS, SETUP_CLEANUP_RULE, minimumHours } from './booking-rules';
import { formatEndTime, formatLong, formatTime } from './dates';
import { PUBLIC_RATES, RATES_FINE_PRINT } from './rate-card';
import { SPACE_NAMES, type DateKey, type Inquiry } from './types';

export type DraftMode = 'draft' | 'rewrite';

/** The request a reply is about, as the draft needs it. */
export type DraftInquiry = Pick<
  Inquiry,
  'reference' | 'name' | 'eventType' | 'eventTypeOther' | 'date' | 'altDate' | 'startTime' | 'hours' | 'space' | 'guests' | 'message' | 'wantsVisit' | 'visitNotes' | 'status'
>;

export interface DraftEmail {
  direction: 'in' | 'out';
  fromName: string;
  /** ISO. */
  sentAt: string;
  text: string;
}

export interface DraftInput {
  mode: DraftMode;
  /** Faith's text, for a rewrite. */
  text: string;
  /** What the admin wants the email to say, in a few words (optional). */
  instructions: string;
  inquiry: DraftInquiry | null;
  /** The emails so far, oldest first. */
  emails: DraftEmail[];
  /** The person writing; the signature with their name is added when the email is sent. */
  adminName: string;
  /** The guest's first name, when known. */
  guestName: string;
  today: DateKey;
}

export interface DraftResult {
  text: string;
  /** Things to check before sending. */
  warnings: string[];
  /** Who wrote it: Claude, or the built-in template. */
  by: 'claude' | 'basic';
}

/** How many earlier emails a draft reads, and how much of each. */
export const DRAFT_MAX_EMAILS = 12;
export const DRAFT_MAX_EMAIL_CHARS = 4000;
export const DRAFT_INSTRUCTIONS_MAX = 500;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** The new text in an email: quoted lines and everything from "On ... wrote:" left out. */
export function newTextOf(text: string): string {
  const kept: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    if (/^On .{4,200} wrote:\s*$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim())) break;
    if (/^From: .+/.test(line.trim()) && kept.some((l) => /^_{8,}$/.test(l.trim()))) break;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The venue's facts, one per line, for the drafting instructions. */
export function venueFacts(): string[] {
  const fireside = SPACE_NAMES.indoor;
  const stage = SPACE_NAMES.main;
  const garden = SPACE_NAMES.outdoor;
  const unanswered = faqs.filter((f) => !f.a).map((f) => f.q.replace(/\?$/, '').toLowerCase());
  return [
    `Business name, written exactly: ${site.name}. Address: ${site.address.street}, ${site.address.city}, ${site.address.region} ${site.address.postalCode}. Phone: ${site.contact.phone}. Email: ${site.contact.email}. Website: ${site.url.replace(/^https?:\/\//, '')}. Contact person: ${site.contact.contactName}.`,
    ...site.spaces.map((s) => `${s.name}: ${s.description} Up to ${s.capacity} guests.`),
    `${fireside} and ${garden} can be booked together. To add ${stage} on the same day, the guest mentions it and the team confirms. Never add capacities together.`,
    `Every booking includes: ${site.included.join(', ').toLowerCase()}. Anyone can book; no membership is needed.`,
    `Amenities: ${site.amenities.map((a) => `${a.name.toLowerCase()} (${a.detail.replace(/\.$/, '').toLowerCase()})`).join('; ')}.`,
    `Building access for events: ${ACCESS_HOURS}. Closed on Sundays, ${CLOSED_HOLIDAYS.join(', ')}. Christmas events and parties are welcome.`,
    `Minimum booking: ${minimumHours.weekday} hours Monday to Thursday, ${minimumHours.friday} hours on Fridays, ${minimumHours.saturday} hours on Saturdays. ${SETUP_CLEANUP_RULE}`,
    `Rates: ${PUBLIC_RATES.map((r) => `${r.name}, ${r.price}: ${r.detail.replace(/\.$/, '')}`).join('. ')}.`,
    `After the rates, say once: "${RATES_FINE_PRINT}"`,
    site.depositPolicy + ' No deposit amount is set; never name one.',
    ...publishedFaqs.map((f) => `Q: ${f.q} A: ${f.a}`),
    `Not decided yet, so never answer them; say ${firstName(site.contact.contactName)} will confirm: ${unanswered.join('; ')}.`,
  ];
}

/** The rules every draft follows (also checked in code, draftWarnings). */
export const DRAFT_RULES = [
  `Write the business name exactly "${site.name}".`,
  'The venue is its own business. Never mention a church, a congregation, worship, or a sanctuary.',
  'Never mention alcohol or drinks, and never suggest bringing an outside caterer or bringing your own anything.',
  'Never say how far ahead to book, reserve, or plan a date.',
  "Never describe the gazebo's roof or what it is made of.",
  'Use no em dashes and no en dashes; use commas, periods, or the word "to".',
  'Quote only the rates listed. Never make up a price, a total for their date, a discount, a fee amount, or a deposit amount.',
  'Never say a date is available, free, held, or booked unless the instructions say so. Say the date will be confirmed.',
  'Never promise anything the facts do not state. When the guest asks something the facts do not answer, write a short placeholder in square brackets for the team to fill in, such as [confirm: setup time on the day].',
  'Professional and warm, in plain words. Short paragraphs. No exclamation marks, except inside the rates line quoted above.',
  'Plain text only: no markdown, no bold, no bullet symbols, no headings.',
  'Start with "Hi <first name>," on its own line. End with a closing such as "Warm regards," on its own line and nothing after it: the name, the business, the phone number, and the website are added below it automatically.',
];

/** One request, described for the drafting instructions. */
export function describeInquiry(i: DraftInquiry): string {
  const lines = [
    `Reference: ${i.reference}`,
    `Guest: ${i.name}`,
    `Event: ${eventTypeName(i.eventType, i.eventTypeOther)}`,
    `Date: ${formatLong(i.date)}${i.altDate ? ` (or ${formatLong(i.altDate)})` : ''}`,
    `Time: ${formatTime(i.startTime)} to ${formatEndTime(i.startTime, i.hours)}, ${i.hours} hours including setup and cleanup`,
    `Space: ${SPACE_NAMES[i.space]}`,
    `Guests: ${i.guests}`,
    `Wants a tour first: ${i.wantsVisit ? `yes${i.visitNotes ? ` (${i.visitNotes})` : ''}` : 'no'}`,
    `Status in the admin: ${i.status}`,
  ];
  if (i.message) lines.push(`The guest's message with the request:\n${i.message.slice(0, DRAFT_MAX_EMAIL_CHARS)}`);
  return lines.join('\n');
}

const DASHES = /\s*[\u2013\u2014]\s*/g;

/** A draft made ready for the reply box: plain text, the house style, and no signature (it is added on send). */
export function cleanDraft(raw: string, adminName: string): string {
  let s = raw.replace(/\r\n/g, '\n').trim();
  // Number ranges keep their meaning ("6 to 8"); other dashes become commas.
  s = s.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1 to $2').replace(DASHES, ', ');
  s = s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');
  s = s.replace(/^#{1,6}[ \t]+/gm, '').replace(/^[ \t]*[*\u2022][ \t]+/gm, '- ');
  s = s.replace(/\bThe Venue (at|@)\s*NCC\b/gi, site.name).replace(/\bVenue@NCC\b/g, site.name);
  // The signature is added on send; drop one the model wrote anyway.
  const lines = s.split('\n');
  const sig = new Set([adminName, site.contact.contactName, site.name, site.contact.phone, site.url.replace(/^https?:\/\//, ''), site.contact.email].map((x) => x.toLowerCase()));
  while (lines.length > 1 && (sig.has(lines[lines.length - 1].trim().toLowerCase()) || lines[lines.length - 1].trim() === '')) lines.pop();
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The amounts the rate card names, like "$375". */
const rateAmounts = (): Set<string> => new Set(PUBLIC_RATES.flatMap((r) => r.price.match(/\$[\d,]+/g) ?? []));

/**
 * What to check before sending: placeholders to fill in, and anything the house rules do not allow.
 * `ownWords` is what the admin typed (their draft or instructions): amounts they wrote are theirs to quote.
 */
export function draftWarnings(text: string, ownWords = ''): string[] {
  const out: string[] = [];
  if (/\[[^\]\n]{2,}\]/.test(text)) out.push('Fill in the parts in [square brackets].');
  const allowed = rateAmounts();
  for (const amount of ownWords.match(/\$[\d,]+/g) ?? []) allowed.add(amount);
  const odd = [...new Set(text.match(/\$[\d,]+(\.\d\d)?/g) ?? [])].filter((a) => !allowed.has(a.replace(/\.\d\d$/, '')));
  if (odd.length) out.push(`Check ${odd.join(', ')}: not on the rate card.`);
  const rules: [RegExp, string][] = [
    [/\b(church|congregation|worship|sanctuary|ministry|pastor)\b/i, 'It mentions a church. The venue is its own business.'],
    [/\b(alcohol|wine|beer|liquor|champagne|cocktails?|bartend\w*|open bar|spirits)\b/i, 'It mentions drinks.'],
    [/\b(bring your own|BYO\w*|outside cater\w*|your own cater\w*)\b/i, 'It mentions bringing your own or an outside caterer.'],
    [/\b(in advance|ahead of time|book early|lead time|(weeks|months) (ahead|before|out|in advance))\b/i, 'It says how far ahead to book.'],
    [/gazebo[^.\n]*\broof|\broof[^.\n]*gazebo/i, "It describes the gazebo's roof."],
    [
      /\b(date|day|evening|weekend|it|that|\d{1,2}(st|nd|rd|th)?)\s+(is|looks|remains)\s+(still\s+)?(available|open(?!\s+to\b)|free)\b|\bwe have (it|your date) (open|available)\b/i,
      'It says a date is available. Check the calendar first.',
    ],
  ];
  for (const [re, message] of rules) if (re.test(text) && !re.test(ownWords)) out.push(message);
  return out;
}

/** A draft from the template, with no AI: the greeting, the request, the rates, and the next step. */
export function templateDraft(input: DraftInput): string {
  const name = firstName(input.guestName) || 'there';
  const i = input.inquiry;
  const parts: string[] = [`Hi ${name},`];
  if (!i) {
    parts.push(`Thank you for your email.`, '[Write your reply here.]');
    return [...parts, 'Warm regards,'].join('\n\n');
  }
  const when = `${formatLong(i.date)}, ${formatTime(i.startTime)} to ${formatEndTime(i.startTime, i.hours)}`;
  parts.push(
    `Thank you for your request for ${when}, in ${SPACE_NAMES[i.space]} for ${i.guests} ${i.guests === 1 ? 'guest' : 'guests'}${i.altDate ? `, with ${formatLong(i.altDate)} as another option` : ''}.`,
  );
  parts.push(['Our rates:', ...PUBLIC_RATES.map((r) => `- ${r.name}: ${r.price}. ${r.detail}`), RATES_FINE_PRINT].join('\n'));
  if (i.wantsVisit) parts.push('You asked to see the venue first. Let me know a day and time that suits you, and I will walk you through the space.');
  parts.push(`I will confirm your date and send you the details to reserve it. ${site.depositPolicy}`);
  parts.push('Warm regards,');
  return parts.join('\n\n');
}

/** The finished result, from the text the drafter wrote. */
export function finishDraft(raw: string, input: DraftInput, by: DraftResult['by']): DraftResult {
  const text = cleanDraft(raw, input.adminName);
  return { text, warnings: draftWarnings(text, `${input.mode === 'rewrite' ? input.text : ''}\n${input.instructions}`), by };
}
