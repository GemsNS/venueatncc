/**
 * Email templates: table-based HTML with inline styles (renders in Gmail, Outlook, Apple Mail),
 * plus a plain-text version of each. Facts come from src/data/site.ts; prices from the stored
 * estimate, read as estimate() wrote them: bookingDeposit is due to reserve the date and the
 * rest (total minus bookingDeposit) is the balance.
 *
 * Brand (docs/design/brand.md): the email lockup as a PNG header on white (many clients do not
 * render SVG), a thin Venue Purple rule, Georgia for headings in place of Caslon, the system
 * sans stack for body text, and the palette's Ink, Ink 2, and Lilac Mist.
 */
import { fullAddress, site } from '../../src/data/site';
import { eventTypeName } from '../../src/data/event-types';
import { addHours, formatLong, formatTime } from '../../src/shared/dates';
import { formatUSD } from '../../src/shared/pricing';
import { SPACE_NAMES, type ContactPreference, type Estimate, type Inquiry } from '../../src/shared/types';

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
/** Venue Purple: links, the rule under the header, the button. 10.9:1 on white. */
const PURPLE = '#4F2A75';
/** Ink and Ink 2: text and secondary text (7.1:1 on white). */
const INK = '#1C1622';
const MUTED = '#5E5566';
/** Hairlines: the palette's separator over white. */
const RULE = '#E4E1E8';
/** Lilac Mist: the reference box. */
const TINT = '#F4F0F8';
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
/** Headings: Georgia stands in for Libre Caslon, which email clients do not have. */
const SERIF = `Georgia, 'Times New Roman', Times, serif`;
/** The PNG lockup (512 x 96), shown at half size. Always the public site, so every mail client can load it. */
const LOCKUP = { src: `${site.url}/brand/email-lockup.png`, width: 256, height: 48 };

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (m) => ENTITIES[m]);

const CR = String.fromCharCode(13);
const LINE_SEPARATORS = [CR + NL, CR, String.fromCharCode(0x2028), String.fromCharCode(0x2029)];

/** The lines of a text, whatever line endings it uses. */
function linesOf(s: string): string[] {
  let out = s;
  for (const sep of LINE_SEPARATORS) out = out.split(sep).join(NL);
  return out.split(NL);
}

/** Escape, keeping the writer's line breaks. */
const multiline = (s: string) => linesOf(s).map(escapeHtml).join('<br>');

/** One line of text: any line breaks become spaces. */
export const oneLine = (s: string) => linesOf(s).join(' ');

/**
 * Plain-text value that continues on indented lines, so nothing a guest typed can start a line
 * of its own and pass for one of our labels (a forged "Email:" row, for example).
 */
export const continued = (s: string, indent = '    ') => linesOf(s).join(NL + indent);

const CONTACT_LABEL: Record<ContactPreference, string> = { email: 'Email', phone: 'Phone call', text: 'Text message' };
const CONTACT_HOW: Record<ContactPreference, string> = { email: 'email', phone: 'phone', text: 'text message' };

export const spaceLabel = (space: Inquiry['space']) => SPACE_NAMES[space];
export const eventLabel = (i: Pick<Inquiry, 'eventType' | 'eventTypeOther'>) => eventTypeName(i.eventType, i.eventTypeOther);
export const timeRange = (i: Pick<Inquiry, 'startTime' | 'hours'>) =>
  `${formatTime(i.startTime)} to ${formatTime(addHours(i.startTime, i.hours))} (${i.hours} ${i.hours === 1 ? 'hour' : 'hours'})`;
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

/** A dialable number for tel: links, the same rule as the admin's dialable(): +1 for 10-digit US numbers. */
export function dialable(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (phone.trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits;
}

/**
 * The money rows under an estimate. estimate() already sets bookingDeposit to the whole total
 * when the event is inside the balance window, so these rows only read it, never recompute it.
 */
export function paymentRows(est: Estimate): [string, string][] {
  const balance = Math.max(0, est.total - est.bookingDeposit);
  const rows: [string, string][] = [['Due to reserve the date', formatUSD(est.bookingDeposit)]];
  if (balance > 0) rows.push(['Balance', formatUSD(balance)]);
  rows.push(['Refundable damage deposit, returned if there is no damage', formatUSD(est.refundableDeposit)]);
  return rows;
}

/** The last step in the guest email, in the site's wording: we confirm availability, then the deposit reserves the date. */
export function reserveStep(est: Estimate): string {
  const full = est.total > 0 && est.bookingDeposit >= est.total;
  return full
    ? `We confirm availability, then your payment of ${formatUSD(est.bookingDeposit)}, the full amount, reserves the date.`
    : `We confirm availability, then your booking deposit of ${formatUSD(est.bookingDeposit)} reserves the date.`;
}

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
<tr><td style="padding:0 0 20px 0;">
<a href="${escapeHtml(opts.origin)}/" style="text-decoration:none;"><img src="${LOCKUP.src}" width="${LOCKUP.width}" height="${LOCKUP.height}" alt="${escapeHtml(site.name)}" style="display:block;width:${LOCKUP.width}px;height:${LOCKUP.height}px;border:0;outline:none;text-decoration:none;font-family:${SERIF};font-size:22px;line-height:48px;color:${PURPLE};"></a>
</td></tr>
<tr><td height="1" style="height:1px;padding:0;background:${PURPLE};font-size:1px;line-height:1px;">&nbsp;</td></tr>
${opts.body}
<tr><td style="padding:24px 0 0 0;border-top:1px solid ${RULE};font-size:13px;line-height:20px;color:${MUTED};">
${escapeHtml(site.name)} is operated by ${escapeHtml(site.parent.name)}.<br>
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

/** The page title: Georgia, regular weight, like the site's Caslon titles (never bold). */
const heading = (text: string) =>
  `<tr><td style="padding:28px 0 10px 0;font-family:${SERIF};font-size:28px;line-height:34px;font-weight:400;color:${INK};">${escapeHtml(text)}</td></tr>`;

const paragraph = (html: string) => `<tr><td style="padding:0 0 12px 0;font-size:16px;line-height:24px;color:${INK};">${html}</td></tr>`;

/** Section headings in sentence case, never all caps. */
const sectionTitle = (text: string) =>
  `<tr><td style="padding:24px 0 8px 0;font-family:${SERIF};font-size:19px;line-height:26px;font-weight:400;color:${INK};">${escapeHtml(text)}</td></tr>`;

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
    ...paymentRows(est).map(([label, amount]) => line(label, amount)),
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

const textRows = (rows: [string, string][]) => rows.map(([k, v]) => `${k}: ${continued(v)}`).join(NL);

function estimateText(est: Estimate): string {
  return [
    ...est.lines.map((l) => `${l.label}: ${formatUSD(l.amount)}`),
    `Estimated total: ${formatUSD(est.total)}`,
    ...paymentRows(est).map(([label, amount]) => `${label}: ${amount}`),
  ].join(NL);
}

function footerText(origin: string): string {
  return [
    '--',
    `${site.name} is operated by ${site.parent.name}.`,
    fullAddress,
    `${site.contact.phone} | ${site.contact.email}`,
    `${origin}/`,
  ].join(NL);
}

// ---------------------------------------------------------------- the two emails

/**
 * The request summary. The guest's copy names the event type from our list only: the form
 * sends the confirmation to whatever address was typed in, so it never repeats free text.
 */
function eventRows(i: Inquiry, audience: 'venue' | 'guest'): [string, string][] {
  const rows: [string, string][] = [
    ['Event', audience === 'venue' ? eventLabel(i) : eventTypeName(i.eventType)],
    ['Date', formatLong(i.date)],
  ];
  if (i.altDate) rows.push(['Alternate date', formatLong(i.altDate)]);
  rows.push(['Time', timeRange(i)], ['Space', spaceLabel(i.space)], ['Guests', String(i.guests)]);
  return rows;
}

/** To the venue team: everything the guest sent, with Reply-To set to the guest. */
export function venueNotificationEmail(i: Inquiry, est: Estimate, ctx: EmailContext & { conflict?: string | null }): RenderedEmail {
  const name = oneLine(i.name);
  const subject = `New inquiry ${i.reference}: ${oneLine(eventLabel(i))}, ${formatLong(i.date)}`;
  const detailRows: [string, string][] = [
    ...eventRows(i, 'venue'),
    ['Wants a visit', yesNo(i.wantsVisit)],
  ];
  if (i.visitNotes) detailRows.push(['Visit notes', i.visitNotes]);
  const contactRows: [string, string][] = [['Name', i.name], ['Email', i.email]];
  if (i.phone) contactRows.push(['Phone', i.phone]);
  contactRows.push(['Prefers', CONTACT_LABEL[i.contactPreference]]);

  const esc = (rows: [string, string][]) => rows.map(([k, v]) => [k, multiline(v)] as [string, string]);
  const contactHtml = contactRows.map(([k, v]): [string, string] => {
    if (k === 'Email') return [k, `<a href="mailto:${escapeHtml(v)}" style="color:${PURPLE};">${escapeHtml(v)}</a>`];
    if (k === 'Phone') return [k, `<a href="tel:${escapeHtml(dialable(v))}" style="color:${PURPLE};">${escapeHtml(v)}</a>`];
    return [k, multiline(v)];
  });

  const body = [
    heading('New booking inquiry'),
    paragraph(`${escapeHtml(name)} sent a request through the website. Reply to this email to answer them directly.`),
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
    bulletList(est.notes),
    button(`${ctx.origin}/admin/`, 'Open Admin'),
  ].join(NL);

  const text = [
    `New booking inquiry ${i.reference}`,
    '',
    `${name} sent a request through the website. Reply to this email to answer them directly.`,
    ...(ctx.conflict ? ['', `Heads up: ${ctx.conflict}`] : []),
    '',
    'EVENT',
    textRows(detailRows),
    '',
    'CONTACT',
    textRows(contactRows),
    // The guest's own words, indented so no line can pass for one of ours.
    ...(i.message ? ['', 'MESSAGE', `    ${continued(i.message)}`] : []),
    '',
    'ESTIMATE SHOWN TO THE GUEST',
    estimateText(est),
    ...est.notes.map((n) => `* ${n}`),
    '',
    `Open the admin: ${ctx.origin}/admin/`,
    '',
    footerText(ctx.origin),
  ].join(NL);

  return {
    subject,
    html: layout({ preheader: `${name}, ${formatLong(i.date)}, ${i.guests} guests, ${spaceLabel(i.space)}`, body, origin: ctx.origin }),
    text,
  };
}

/**
 * To the guest: reference, summary, estimate, deposit, and what happens next. The form sends
 * this to whatever address was typed in, so it repeats nothing the sender wrote: no name, and
 * the event type only as named in our own list.
 */
export function guestConfirmationEmail(i: Inquiry, est: Estimate, ctx: EmailContext): RenderedEmail {
  const subject = `We received your request (${i.reference})`;
  const how = CONTACT_HOW[i.contactPreference];
  const steps = [
    `${site.contact.contactName} from our team will contact you by ${how} about your date and details.`,
    ...(i.wantsVisit ? ['We will find a time for your visit to see the space.'] : []),
    reserveStep(est),
  ];
  const intro = `We received your request for ${formatLong(i.date)}. Your date is not reserved yet. We will be in touch to confirm availability.`;
  const thanks = 'Thank you for your request.';

  const body = [
    heading(thanks),
    paragraph(escapeHtml(intro)),
    referenceBox(i.reference),
    paragraph(`<span style="color:${MUTED};font-size:14px;">Mention this reference when you call or write to us.</span>`),
    sectionTitle('Your request'),
    detailTable(eventRows(i, 'guest').map(([k, v]) => [k, escapeHtml(v)])),
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
    thanks,
    '',
    intro,
    '',
    `Reference: ${i.reference}`,
    'Mention this reference when you call or write to us.',
    '',
    'YOUR REQUEST',
    textRows(eventRows(i, 'guest')),
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
