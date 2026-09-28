/**
 * Email templates: table-based HTML with inline styles (renders in Gmail, Outlook, Apple Mail),
 * plus a plain-text version of each. Facts come from src/data/site.ts; prices from the stored estimate.
 */
import { fullAddress, site } from '../../src/data/site';
import { eventTypeName } from '../../src/data/event-types';
import { addHours, formatLong, formatTime } from '../../src/shared/dates';
import { formatUSD, pricing } from '../../src/shared/pricing';
import type { ContactPreference, Estimate, Inquiry } from '../../src/shared/types';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailContext {
  /** e.g. https://venueatncc.org */
  origin: string;
}

const NL = String.fromCharCode(10);
const PURPLE = '#7B2FBE';
const INK = '#1d1d1f';
const MUTED = '#6e6e73';
const RULE = '#e5e5ea';
const TINT = '#f5eefb';
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (m) => ENTITIES[m]);

/** Escape, keeping the writer's line breaks. */
const multiline = (s: string) => s.replace(/\r/g, '').split(NL).map(escapeHtml).join('<br>');

const CONTACT_LABEL: Record<ContactPreference, string> = { email: 'Email', phone: 'Phone call', text: 'Text message' };
const CONTACT_HOW: Record<ContactPreference, string> = { email: 'email', phone: 'phone', text: 'text message' };

export const spaceLabel = (space: Inquiry['space']) => pricing.spaces[space].label;
export const eventLabel = (i: Pick<Inquiry, 'eventType' | 'eventTypeOther'>) => eventTypeName(i.eventType, i.eventTypeOther);
export const timeRange = (i: Pick<Inquiry, 'startTime' | 'hours'>) =>
  `${formatTime(i.startTime)} to ${formatTime(addHours(i.startTime, i.hours))} (${i.hours} ${i.hours === 1 ? 'hour' : 'hours'})`;
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

// ---------------------------------------------------------------- HTML building blocks

function layout(opts: { preheader: string; body: string; origin: string }): string {
  const host = opts.origin.replace(/^https?:[/][/]/, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(site.name)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FONT};color:${INK};">
<tr><td style="padding:0 0 16px 0;border-bottom:3px solid ${PURPLE};">
<span style="font-size:20px;font-weight:700;color:${PURPLE};letter-spacing:-0.2px;">${escapeHtml(site.name)}</span>
</td></tr>
${opts.body}
<tr><td style="padding:24px 0 0 0;border-top:1px solid ${RULE};font-size:13px;line-height:20px;color:${MUTED};">
${escapeHtml(site.name)}, the event venue of ${escapeHtml(site.parent.name)}<br>
${escapeHtml(fullAddress)}<br>
<a href="tel:${site.contact.phoneE164}" style="color:${PURPLE};text-decoration:none;">${escapeHtml(site.contact.phone)}</a>
&nbsp;&middot;&nbsp;
<a href="mailto:${escapeHtml(site.contact.email)}" style="color:${PURPLE};text-decoration:none;">${escapeHtml(site.contact.email)}</a>
&nbsp;&middot;&nbsp;
<a href="${escapeHtml(opts.origin)}/" style="color:${PURPLE};text-decoration:none;">${escapeHtml(host)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const heading = (text: string) =>
  `<tr><td style="padding:24px 0 8px 0;font-size:24px;line-height:30px;font-weight:700;color:${INK};">${escapeHtml(text)}</td></tr>`;

const paragraph = (html: string) => `<tr><td style="padding:0 0 12px 0;font-size:16px;line-height:24px;color:${INK};">${html}</td></tr>`;

const sectionTitle = (text: string) =>
  `<tr><td style="padding:20px 0 8px 0;font-size:13px;line-height:18px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${PURPLE};">${escapeHtml(text)}</td></tr>`;

function referenceBox(reference: string): string {
  return `<tr><td style="padding:8px 0 12px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:${TINT};border-radius:12px;">
<tr><td style="padding:12px 18px;font-size:14px;line-height:20px;color:${MUTED};">Reference<br>
<span style="font-size:22px;line-height:30px;font-weight:700;letter-spacing:1px;color:${PURPLE};">${escapeHtml(reference)}</span></td></tr>
</table>
</td></tr>`;
}

/** Label/value rows. Values are HTML (already escaped by the caller). */
function detailTable(rows: [string, string][]): string {
  const trs = rows
    .map(
      ([label, value]) =>
        `<tr><td valign="top" style="padding:8px 12px 8px 0;border-bottom:1px solid ${RULE};font-size:14px;line-height:20px;color:${MUTED};width:38%;">${escapeHtml(label)}</td>` +
        `<td valign="top" style="padding:8px 0;border-bottom:1px solid ${RULE};font-size:15px;line-height:22px;color:${INK};">${value}</td></tr>`,
    )
    .join(NL);
  return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${trs}</table></td></tr>`;
}

function estimateTable(est: Estimate): string {
  const line = (label: string, amount: string, strong = false) =>
    `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid ${RULE};font-size:15px;line-height:22px;color:${INK};${strong ? 'font-weight:700;' : ''}">${escapeHtml(label)}</td>` +
    `<td align="right" style="padding:8px 0;border-bottom:1px solid ${RULE};font-size:15px;line-height:22px;color:${INK};white-space:nowrap;${strong ? 'font-weight:700;' : ''}">${escapeHtml(amount)}</td></tr>`;
  const rows = [
    ...est.lines.map((l) => line(l.label, formatUSD(l.amount))),
    line('Estimated total', formatUSD(est.total), true),
    line('Deposit to reserve the date', formatUSD(est.bookingDeposit)),
    line('Refundable damage deposit, returned after the event', formatUSD(est.refundableDeposit)),
  ];
  return `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join(NL)}</table></td></tr>`;
}

function bulletList(items: string[]): string {
  const lis = items.map((t) => `<li style="margin:0 0 6px 0;">${escapeHtml(t)}</li>`).join('');
  return `<tr><td style="padding:4px 0 8px 0;font-size:14px;line-height:21px;color:${MUTED};"><ul style="margin:0;padding:0 0 0 20px;">${lis}</ul></td></tr>`;
}

function button(href: string, label: string): string {
  return `<tr><td style="padding:16px 0 8px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:999px;background:${PURPLE};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a></td>
</tr></table>
</td></tr>`;
}

// ---------------------------------------------------------------- plain text helpers

const textRows = (rows: [string, string][]) => rows.map(([k, v]) => `${k}: ${v}`).join(NL);

function estimateText(est: Estimate): string {
  return [
    ...est.lines.map((l) => `${l.label}: ${formatUSD(l.amount)}`),
    `Estimated total: ${formatUSD(est.total)}`,
    `Deposit to reserve the date: ${formatUSD(est.bookingDeposit)}`,
    `Refundable damage deposit, returned after the event: ${formatUSD(est.refundableDeposit)}`,
  ].join(NL);
}

function footerText(origin: string): string {
  return [
    '--',
    `${site.name}, the event venue of ${site.parent.name}`,
    fullAddress,
    `${site.contact.phone} | ${site.contact.email}`,
    `${origin}/`,
  ].join(NL);
}

// ---------------------------------------------------------------- the two emails

function eventRows(i: Inquiry): [string, string][] {
  const rows: [string, string][] = [
    ['Event', eventLabel(i)],
    ['Date', formatLong(i.date)],
  ];
  if (i.altDate) rows.push(['Alternate date', formatLong(i.altDate)]);
  rows.push(['Time', timeRange(i)], ['Space', spaceLabel(i.space)], ['Guests', String(i.guests)]);
  return rows;
}

/** To the venue team: everything the guest sent, with Reply-To set to the guest. */
export function venueNotificationEmail(i: Inquiry, est: Estimate, ctx: EmailContext & { conflict?: string | null }): RenderedEmail {
  const subject = `New inquiry ${i.reference}: ${eventLabel(i)}, ${formatLong(i.date)}`;
  const detailRows: [string, string][] = [
    ...eventRows(i),
    ['Serving alcohol', yesNo(i.servingAlcohol)],
    ['Wants a visit', yesNo(i.wantsVisit)],
  ];
  if (i.visitNotes) detailRows.push(['Visit notes', i.visitNotes]);
  const contactRows: [string, string][] = [['Name', i.name], ['Email', i.email]];
  if (i.phone) contactRows.push(['Phone', i.phone]);
  contactRows.push(['Prefers', CONTACT_LABEL[i.contactPreference]]);

  const esc = (rows: [string, string][]) => rows.map(([k, v]) => [k, escapeHtml(v)] as [string, string]);
  const contactHtml = contactRows.map(([k, v]): [string, string] => {
    if (k === 'Email') return [k, `<a href="mailto:${escapeHtml(v)}" style="color:${PURPLE};">${escapeHtml(v)}</a>`];
    if (k === 'Phone') return [k, `<a href="tel:${escapeHtml(v.replace(/[^0-9+]/g, ''))}" style="color:${PURPLE};">${escapeHtml(v)}</a>`];
    return [k, escapeHtml(v)];
  });

  const body = [
    heading('New booking inquiry'),
    paragraph(`${escapeHtml(i.name)} sent a request through the website. Reply to this email to answer them directly.`),
    referenceBox(i.reference),
    ctx.conflict
      ? paragraph(`<strong style="color:${PURPLE};">Heads up:</strong> ${escapeHtml(ctx.conflict)}`)
      : '',
    sectionTitle('Event'),
    detailTable(esc(detailRows)),
    sectionTitle('Contact'),
    detailTable(contactHtml),
    i.message ? sectionTitle('Message') : '',
    i.message ? paragraph(multiline(i.message)) : '',
    sectionTitle('Estimate shown to the guest'),
    estimateTable(est),
    button(`${ctx.origin}/admin/`, 'Open Admin'),
  ].join(NL);

  const text = [
    `New booking inquiry ${i.reference}`,
    '',
    `${i.name} sent a request through the website. Reply to this email to answer them directly.`,
    ...(ctx.conflict ? ['', `Heads up: ${ctx.conflict}`] : []),
    '',
    'EVENT',
    textRows(detailRows),
    '',
    'CONTACT',
    textRows(contactRows),
    ...(i.message ? ['', 'MESSAGE', i.message] : []),
    '',
    'ESTIMATE SHOWN TO THE GUEST',
    estimateText(est),
    '',
    `Open the admin: ${ctx.origin}/admin/`,
    '',
    footerText(ctx.origin),
  ].join(NL);

  return {
    subject,
    html: layout({ preheader: `${i.name}, ${formatLong(i.date)}, ${i.guests} guests, ${spaceLabel(i.space)}`, body, origin: ctx.origin }),
    text,
  };
}

/** To the guest: reference, summary, estimate, deposit, and what happens next. */
export function guestConfirmationEmail(i: Inquiry, est: Estimate, ctx: EmailContext): RenderedEmail {
  const subject = `We received your request (${i.reference})`;
  const how = CONTACT_HOW[i.contactPreference];
  const steps = [
    `${site.contact.contactName} from our team will contact you by ${how} to confirm the date and details.`,
    ...(i.wantsVisit ? ['We will find a time for your visit to see the space.'] : []),
    `Your date is reserved once we confirm it with you and receive the ${formatUSD(est.bookingDeposit)} deposit.`,
  ];
  const intro = `We received your request for ${formatLong(i.date)}. Your date is not reserved yet. We will be in touch to confirm it.`;

  const body = [
    heading(`Thank you, ${firstName(i.name)}.`),
    paragraph(escapeHtml(intro)),
    referenceBox(i.reference),
    paragraph(`<span style="color:${MUTED};font-size:14px;">Mention this reference when you call or write to us.</span>`),
    sectionTitle('Your request'),
    detailTable(eventRows(i).map(([k, v]) => [k, escapeHtml(v)])),
    sectionTitle('Your estimate'),
    estimateTable(est),
    bulletList(est.notes),
    sectionTitle('What happens next'),
    `<tr><td style="padding:0 0 8px 0;font-size:16px;line-height:24px;color:${INK};"><ol style="margin:0;padding:0 0 0 22px;">${steps
      .map((s) => `<li style="margin:0 0 8px 0;">${escapeHtml(s)}</li>`)
      .join('')}</ol></td></tr>`,
    sectionTitle('Questions'),
    paragraph(
      `Call <a href="tel:${site.contact.phoneE164}" style="color:${PURPLE};">${escapeHtml(site.contact.phone)}</a> or reply to this email. ` +
        `We are at ${escapeHtml(fullAddress)}.`,
    ),
  ].join(NL);

  const text = [
    `Thank you, ${firstName(i.name)}.`,
    '',
    intro,
    '',
    `Reference: ${i.reference}`,
    'Mention this reference when you call or write to us.',
    '',
    'YOUR REQUEST',
    textRows(eventRows(i)),
    '',
    'YOUR ESTIMATE',
    estimateText(est),
    ...est.notes.map((n) => `* ${n}`),
    '',
    'WHAT HAPPENS NEXT',
    ...steps.map((s, n) => `${n + 1}. ${s}`),
    '',
    'QUESTIONS',
    `Call ${site.contact.phone} or reply to this email. We are at ${fullAddress}.`,
    '',
    footerText(ctx.origin),
  ].join(NL);

  return {
    subject,
    html: layout({ preheader: `Reference ${i.reference}. Here is your estimate and what happens next.`, body, origin: ctx.origin }),
    text,
  };
}
