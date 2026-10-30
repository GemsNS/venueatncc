/**
 * The demo backend's mailbox: the API server's mail (server/mail, server/routes/mail.ts) in this
 * browser's storage. Nothing is sent or received; replies are kept as if sent. Old demo data without
 * a mailbox gets the seed mail on first use.
 */
import { site } from '../../data/site';
import { formatLong } from '../../shared/dates';
import { replySubject, signature, snippetOf, subjectKey } from '../../shared/mail-text';
import type { InquiryDetail, MailAddress, MailBox, MailInquiryLink, MailMessage, MailStatus, MailThread, MailThreadSummary } from '../../shared/types';

export interface DemoMailMessage extends MailMessage {
  archived: boolean;
}

export interface DemoMail {
  nextId: number;
  messages: DemoMailMessage[];
}

export const DEMO_MAIL_STATUS: MailStatus = { address: site.contact.email, sending: 'demo', receiving: 'demo', lastSyncAt: null };

const venue = (name = ''): MailAddress => ({ name, address: site.contact.email });
const HOUR = 3600 * 1000;

/** The seed mailbox: a guest's reply to their confirmation, a question from someone without a request, and an answered thread. */
export function seedMail(inquiries: InquiryDetail[], nowMs: number): DemoMail {
  const mail: DemoMail = { nextId: 1, messages: [] };
  const at = (hoursAgo: number) => new Date(nowMs - hoursAgo * HOUR).toISOString();
  const add = (m: Omit<DemoMailMessage, 'id' | 'threadId' | 'archived' | 'attachments' | 'cc'> & { threadId?: number }) => {
    const id = mail.nextId++;
    mail.messages.push({ cc: [], attachments: [], archived: false, ...m, id, threadId: m.threadId ?? id });
    return id;
  };
  const guest = (i: InquiryDetail): MailAddress => ({ name: i.name, address: i.email });
  const confirmation = (i: InquiryDetail, hoursAgo: number) =>
    add({
      direction: 'out',
      from: venue(),
      to: [guest(i)],
      subject: `Your request to ${site.name} (${i.reference})`,
      sentAt: at(hoursAgo),
      text: `Thank you, ${i.name.split(' ')[0]}. We received your request for ${formatLong(i.date)} and will be in touch soon.`,
      read: true,
      status: 'sent',
      inquiryId: i.id,
    });

  const tanya = inquiries.find((i) => i.reference === 'NCC-7K3QX');
  if (tanya) {
    const t = confirmation(tanya, 3);
    add({
      threadId: t,
      direction: 'in',
      from: guest(tanya),
      to: [venue()],
      subject: `Re: Your request to ${site.name} (${tanya.reference})`,
      sentAt: at(1),
      text: 'Hi Faith,\n\nCould we bring in our own balloon arch? And is there somewhere to hide the guests before he walks in?\n\nThank you,\nTanya',
      read: false,
      status: 'received',
      inquiryId: tanya.id,
    });
  }

  add({
    direction: 'in',
    from: { name: 'Gloria Simmons', address: 'gloria.simmons@example.com' },
    to: [venue()],
    subject: 'Repast for my father',
    sentAt: at(5),
    text: 'Good morning,\n\nOur family is planning a repast after a service in Suffolk. About 80 people. Is The Fireside Room available on a weekday afternoon in two weeks?\n\nGloria Simmons',
    read: false,
    status: 'received',
    inquiryId: null,
  });

  const andre = inquiries.find((i) => i.reference === 'NCC-C2MHV');
  if (andre) {
    const t = confirmation(andre, 8);
    add({
      threadId: t,
      direction: 'in',
      from: guest(andre),
      to: [venue()],
      subject: `Re: Your request to ${site.name} (${andre.reference})`,
      sentAt: at(7),
      text: 'Does The Stage Hall have a projector screen we could use for the morning sessions?',
      read: true,
      status: 'received',
      inquiryId: andre.id,
    });
    add({
      threadId: t,
      direction: 'out',
      from: venue('Faith VanDyke'),
      to: [guest(andre)],
      subject: `Re: Your request to ${site.name} (${andre.reference})`,
      sentAt: at(6),
      text: `Good question. Let me check with the team and call you this afternoon.\n\n${signature('Faith VanDyke')}`,
      read: true,
      status: 'sent',
      sentBy: 'Faith VanDyke',
      inquiryId: andre.id,
    });
  }
  return mail;
}

const byTime = (a: MailMessage, b: MailMessage) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : a.id - b.id);

function link(inquiries: InquiryDetail[], id: number | null): MailInquiryLink | null {
  const i = id === null ? undefined : inquiries.find((x) => x.id === id);
  return i ? { id: i.id, reference: i.reference, name: i.name } : null;
}

const strip = (m: DemoMailMessage): MailMessage => {
  const copy: Partial<DemoMailMessage> = { ...m };
  delete copy.archived;
  return JSON.parse(JSON.stringify(copy)) as MailMessage;
};

const counterpartOf = (m: MailMessage): MailAddress => (m.direction === 'in' ? m.from : m.to[0]);

export function threadOf(mail: DemoMail, inquiries: InquiryDetail[], id: number): MailThread | null {
  const list = mail.messages.filter((m) => m.threadId === id).sort(byTime);
  if (list.length === 0) return null;
  const last = list[list.length - 1];
  const inquiryId = list.reduce<number | null>((acc, m) => m.inquiryId ?? acc, null);
  return {
    id,
    subject: list[0].subject,
    counterpart: list.find((m) => m.direction === 'in')?.from ?? counterpartOf(last),
    archived: list.every((m) => m.archived),
    inquiry: link(inquiries, inquiryId),
    messages: list.map(strip),
  };
}

export function threadList(mail: DemoMail, inquiries: InquiryDetail[], box: MailBox, q: string): MailThreadSummary[] {
  const needle = q.trim().toLowerCase();
  const ids = [...new Set(mail.messages.map((m) => m.threadId))];
  const out: MailThreadSummary[] = [];
  for (const id of ids) {
    const t = threadOf(mail, inquiries, id)!;
    if (t.archived !== (box === 'archived')) continue;
    if (needle) {
      const hay = t.messages.flatMap((m) => [m.subject, m.text, m.from.address, m.from.name, ...m.to.map((a) => `${a.name} ${a.address}`)]);
      if (!hay.some((v) => v.toLowerCase().includes(needle))) continue;
    }
    const last = t.messages[t.messages.length - 1];
    out.push({
      id,
      subject: t.subject,
      counterpart: counterpartOf(last),
      // Without the signature, as the server stores it.
      snippet: snippetOf(last.sentBy ? last.text.replace(`\n\n${signature(last.sentBy)}`, '') : last.text),
      lastAt: last.sentAt,
      count: t.messages.length,
      unread: t.messages.filter((m) => m.direction === 'in' && !m.read).length,
      lastDirection: last.direction,
      archived: t.archived,
      hasAttachments: t.messages.some((m) => m.attachments.length > 0),
      inquiry: t.inquiry,
    });
  }
  return out.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : b.id - a.id));
}

export function unreadCount(mail: DemoMail): number {
  return mail.messages.filter((m) => m.direction === 'in' && !m.read && !m.archived).length;
}

/** Keep an email as sent: in a thread (a reply), or a new thread. Returns the thread id. */
export function addSent(
  mail: DemoMail,
  input: { to: MailAddress[]; subject: string; body: string; adminName: string; threadId?: number | null; inquiryId: number | null },
): number {
  const id = mail.nextId++;
  let threadId = input.threadId ?? null;
  if (threadId === null) {
    const key = subjectKey(input.subject);
    threadId = mail.messages.find((m) => counterpartOf(m).address === input.to[0].address && subjectKey(m.subject) === key)?.threadId ?? id;
  }
  for (const m of mail.messages) if (m.threadId === threadId) m.archived = false;
  mail.messages.push({
    id,
    threadId,
    direction: 'out',
    from: venue(input.adminName),
    to: input.to,
    cc: [],
    subject: input.subject,
    sentAt: new Date().toISOString(),
    text: `${input.body.trim()}\n\n${signature(input.adminName)}`,
    read: true,
    status: 'sent',
    sentBy: input.adminName,
    attachments: [],
    inquiryId: input.inquiryId,
    archived: false,
  });
  return threadId;
}

/** Who a reply in a thread goes to: whoever wrote last, or the person a venue thread went to. */
export function replyTo(thread: MailThread): MailAddress {
  const lastIn = [...thread.messages].reverse().find((m) => m.direction === 'in');
  return lastIn ? lastIn.from : thread.counterpart;
}

export { replySubject };
