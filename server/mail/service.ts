/**
 * The venue's mailbox in the admin.
 *
 * Receiving: every MAIL_POLL_SECONDS (and on "Check for Mail") the server signs in to the mailbox over
 * IMAP and copies new messages from the inbox and, when IMAP_SENT is set, the sent folder into SQLite.
 * Only venue mail is copied when the mailbox also holds other mail (ImapConfig.copyAll). Nothing is ever
 * deleted or moved in the mailbox; reading a thread here marks it read there too.
 *
 * Sending: replies and new emails go out through the same mailer as the booking emails (SMTP, or the
 * outbox while SMTP is not set up), From MAIL_FROM, threaded with In-Reply-To and References, and a copy
 * goes into the sent folder so the mailbox's own mail apps show it.
 *
 * Mail bodies are kept as plain text. HTML is never shown in the admin, so a message cannot run script
 * or load remote images there.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import type { Config, ImapConfig } from '../config';
import { iso, type Logger, type Tasks } from '../context';
import type { Mailer } from '../email/mailer';
import type { MailRow, MailUid, NewMail, Repo } from '../repo';
import type { AdminUser, MailAddress, MailStatus } from '../../src/shared/types';
import { cleanMessageId, formatAddress, messageIds, newMessageId, replyHtml, replyText, signature, snippetOf, subjectKey } from './text';

const DAY = 24 * 60 * 60 * 1000;
/** The first sync copies this much history. */
export const INITIAL_SYNC_DAYS = 30;
export const INITIAL_SYNC_MAX = 300;
/** Messages copied per folder per sync; the rest follow on the next one. */
export const SYNC_BATCH = 200;
/** Larger messages are listed with their headers only. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;
const MAX_TEXT = 200_000;
/** A reply with no In-Reply-To joins the latest thread with the same person and subject this recent. */
const THREAD_BY_SUBJECT_DAYS = 120;
/** The header on every email the app sends; the venue's own notifications are not copied back in. */
export const APP_HEADER = 'X-Venue-Mail';

/** The part of ImapFlow this module uses, so tests can stand in a fake mailbox. */
export interface ImapClient {
  connect(): Promise<void>;
  logout(): Promise<void>;
  close(): void;
  on(event: 'error', listener: (err: Error) => void): unknown;
  readonly mailbox: { uidValidity: bigint; uidNext: number; exists: number } | false;
  getMailboxLock(path: string): Promise<{ release(): void }>;
  search(query: { since?: Date; uid?: string }, options: { uid: true }): Promise<number[] | false | undefined>;
  fetchOne(
    uid: string,
    query: { uid: true; size?: true; flags?: true; internalDate?: true; envelope?: true; source?: true },
    options: { uid: true },
  ): Promise<ImapMessage | false | undefined>;
  messageFlagsAdd(range: number[], flags: string[], options: { uid: true }): Promise<boolean>;
  messageFlagsRemove(range: number[], flags: string[], options: { uid: true }): Promise<boolean>;
  append(path: string, content: Buffer, flags?: string[]): Promise<unknown>;
}

export interface ImapMessage {
  uid: number;
  size?: number;
  flags?: Set<string>;
  internalDate?: Date | string;
  source?: Buffer;
  envelope?: {
    date?: Date | string;
    subject?: string;
    messageId?: string;
    inReplyTo?: string;
    from?: { name?: string; address?: string }[];
    to?: { name?: string; address?: string }[];
    cc?: { name?: string; address?: string }[];
  };
}

export type ImapAuth = { user: string; pass: string } | { user: string; accessToken: string };
export type ImapFactory = (config: ImapConfig, auth: ImapAuth) => ImapClient;

export const realImap: ImapFactory = (config, auth) =>
  new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth,
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 120_000,
  }) as unknown as ImapClient;

export interface SendInput {
  to: MailAddress[];
  subject: string;
  body: string;
  admin: AdminUser;
  /** Reply in this thread (answering its latest message). */
  threadId?: number | null;
  inquiryId?: number | null;
}

export interface MailService {
  readonly address: string;
  status(): MailStatus;
  /** Copy new mail in. Runs one at a time; a call while one runs waits for it. */
  sync(): Promise<void>;
  send(input: SendInput): Promise<{ id: number; threadId: number; status: 'sent' | 'outbox' }>;
  /** Store an email the app already sent (the guest's confirmation), so the guest's reply joins its thread. */
  record(input: {
    to: MailAddress;
    subject: string;
    text: string;
    messageId?: string;
    status: 'sent' | 'outbox';
    inquiryId: number | null;
  }): void;
  /** Mark mailbox copies read or unread there too (in the background). */
  markInMailbox(uids: MailUid[], read: boolean): void;
  /** Where an attachment's file is. */
  filePath(file: string): string;
}

/** The person's display name and address from a parsed header. */
function addressList(value: AddressObject | AddressObject[] | undefined): MailAddress[] {
  const groups = Array.isArray(value) ? value : value ? [value] : [];
  const out: MailAddress[] = [];
  for (const g of groups) {
    for (const v of g.value) {
      if (v.address) out.push({ name: (v.name ?? '').trim().slice(0, 200), address: v.address.trim().toLowerCase().slice(0, 320) });
      for (const member of v.group ?? []) {
        if (member.address) out.push({ name: (member.name ?? '').trim().slice(0, 200), address: member.address.trim().toLowerCase().slice(0, 320) });
      }
    }
  }
  return out.slice(0, 100);
}

const envelopeList = (list: { name?: string; address?: string }[] | undefined): MailAddress[] =>
  (list ?? []).filter((a) => a.address).map((a) => ({ name: (a.name ?? '').trim().slice(0, 200), address: a.address!.trim().toLowerCase().slice(0, 320) }));

/** A safe file name to show and download as. */
function displayName(name: string | undefined, contentType: string): string {
  const cleaned = (name ?? '').replace(/[\\/\r\n\t"]+/g, '_').replace(/[^\x20-\x7e -￿]/g, '').trim().slice(0, 150);
  if (cleaned) return cleaned;
  const ext = contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '').slice(0, 10);
  return ext ? `attachment.${ext}` : 'attachment';
}

/** A plain-language reason a mailbox step failed, without anything secret. */
function reasonOf(err: unknown): string {
  const e = err as { responseText?: string; message?: string; code?: string; authenticationFailed?: boolean };
  if (e?.authenticationFailed) return 'The mailbox refused the sign-in. Check IMAP_USER and IMAP_PASS (or the Microsoft 365 app).';
  const text = e?.responseText || e?.message || String(err);
  return text.replace(/\s+/g, ' ').slice(0, 300);
}

/** When a message is dated: its Date header, unless missing or far in the future, else when the server got it. */
function sentAtOf(header: Date | string | undefined, internal: Date | string | undefined, nowMs: number): string {
  for (const v of [header, internal]) {
    const t = v ? new Date(v).getTime() : NaN;
    if (Number.isFinite(t) && t < nowMs + DAY && t > Date.UTC(1990, 0, 1)) return new Date(t).toISOString();
  }
  return new Date(nowMs).toISOString();
}

export function createMailService(deps: {
  config: Pick<Config, 'imap' | 'mailAddress' | 'mailFilesDir'>;
  repo: Repo;
  mailer: Mailer;
  tasks: Tasks;
  log: Logger;
  now: () => number;
  imapFactory?: ImapFactory;
  fetchToken?: typeof fetch;
}): MailService {
  const { config, repo, mailer, tasks, log, now } = deps;
  const imap = config.imap;
  const address = config.mailAddress;
  const factory = deps.imapFactory ?? realImap;
  let running: Promise<void> | null = null;
  let lastError: string | undefined;
  let lastOk: string | null = imap ? (repo.getMailSync(imap.inbox)?.syncedAt ?? null) : null;
  let token: { value: string; expires: number } | null = null;

  /** A Microsoft 365 app's token (client credentials), cached until a minute before it expires. */
  async function auth(cfg: ImapConfig): Promise<ImapAuth> {
    if (!cfg.oauth) return { user: cfg.user, pass: cfg.pass ?? '' };
    if (token && token.expires > now() + 60_000) return { user: cfg.user, accessToken: token.value };
    const res = await (deps.fetchToken ?? fetch)(`https://login.microsoftonline.com/${encodeURIComponent(cfg.oauth.tenant)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.oauth.clientId,
        client_secret: cfg.oauth.clientSecret,
        scope: 'https://outlook.office365.com/.default',
        grant_type: 'client_credentials',
      }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !body.access_token) {
      throw new Error(`Microsoft 365 did not give the app a mailbox token: ${(body.error_description ?? `HTTP ${res.status}`).split('\n')[0].slice(0, 200)}`);
    }
    token = { value: body.access_token, expires: now() + (body.expires_in ?? 3600) * 1000 };
    return { user: cfg.user, accessToken: token.value };
  }

  async function withClient<T>(cfg: ImapConfig, fn: (client: ImapClient) => Promise<T>): Promise<T> {
    const client = factory(cfg, await auth(cfg));
    // ImapFlow reports socket problems as 'error' events; without a listener they would end the process.
    client.on('error', (err) => log.warn('[mail] mailbox connection error:', reasonOf(err)));
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout().catch(() => client.close());
    }
  }

  async function saveAttachments(parsed: ParsedMail): Promise<NonNullable<NewMail['attachments']>> {
    const out: NonNullable<NewMail['attachments']> = [];
    const files = parsed.attachments.filter((a) => !a.related && a.content && a.size <= MAX_ATTACHMENT_BYTES).slice(0, MAX_ATTACHMENTS);
    if (files.length === 0) return out;
    await fs.mkdir(config.mailFilesDir, { recursive: true, mode: 0o700 });
    for (const a of files) {
      const file = randomUUID();
      await fs.writeFile(path.join(config.mailFilesDir, file), a.content, { mode: 0o600 });
      const contentType = (a.contentType || 'application/octet-stream').toLowerCase().slice(0, 100);
      out.push({ filename: displayName(a.filename, contentType), contentType, size: a.size, file });
    }
    return out;
  }

  /** Copy one message in, if it is venue mail not already stored. */
  async function importOne(client: ImapClient, cfg: ImapConfig, folder: string, kind: 'inbox' | 'sent', validity: string, uid: number): Promise<void> {
    const head = await client.fetchOne(String(uid), { uid: true, size: true, flags: true, internalDate: true, envelope: true }, { uid: true });
    if (!head) return;
    const nowMs = now();
    let parsed: ParsedMail | null = null;
    if ((head.size ?? 0) <= MAX_SOURCE_BYTES) {
      const full = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
      if (full && full.source) parsed = await simpleParser(full.source, { skipImageLinks: true, skipTextToHtml: true, maxHtmlLengthToParse: 2_000_000 });
    }
    const env = head.envelope ?? {};
    const messageId = cleanMessageId(parsed?.messageId ?? env.messageId);
    if (messageId && repo.mailHasMessageId(messageId)) return;
    if (parsed && String(parsed.headers.get(APP_HEADER.toLowerCase()) ?? '').toLowerCase() === 'notification') return;

    const from = (parsed ? addressList(parsed.from) : envelopeList(env.from))[0] ?? { name: '', address: 'unknown' };
    const to = parsed ? addressList(parsed.to) : envelopeList(env.to);
    const cc = parsed ? addressList(parsed.cc) : envelopeList(env.cc);
    const inReplyTo = cleanMessageId(parsed?.inReplyTo ?? env.inReplyTo);
    const refs = [...messageIds(parsed?.references), ...(inReplyTo ? [inReplyTo] : [])];
    const fromUs = from.address === address;

    if (!cfg.copyAll) {
      if (kind === 'sent' && !fromUs) return;
      if (kind === 'inbox') {
        const lines = parsed?.headerLines ?? [];
        const addressed =
          [...to, ...cc].some((a) => a.address === address) ||
          lines.some((l) => ['to', 'cc', 'delivered-to', 'x-original-to', 'envelope-to', 'resent-to'].includes(l.key) && l.line.toLowerCase().includes(address));
        if (!addressed && !repo.mailKnowsAny(refs)) return;
      }
    }

    const direction: 'in' | 'out' = kind === 'sent' || fromUs ? 'out' : 'in';
    const counterpart = direction === 'in' ? from : (to.find((a) => a.address !== address) ?? to[0] ?? from);
    const subject = (parsed?.subject ?? env.subject ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    const key = subjectKey(subject);
    let text = parsed ? (parsed.text ?? '') : '';
    if (!parsed) text = 'This email is too large to show here. Open it in the mailbox’s own mail app.';
    text = text.replace(/\r\n/g, '\n').slice(0, MAX_TEXT);
    const inquiryId = repo.inquiryForMail(counterpart.address, subject);
    const attachments = parsed ? await saveAttachments(parsed) : [];
    const stamp = iso(nowMs);
    const id = repo.insertMail(
      {
        threadId: repo.mailThreadFor(refs, counterpart.address, key, iso(nowMs - THREAD_BY_SUBJECT_DAYS * DAY)),
        direction,
        status: direction === 'in' ? 'received' : 'sent',
        mailbox: folder,
        uidValidity: validity,
        uid,
        messageId,
        inReplyTo,
        refs: messageIds(parsed?.references),
        from,
        to,
        cc,
        counterpart,
        subject,
        subjectKey: key,
        sentAt: sentAtOf(parsed?.date ?? env.date, head.internalDate, nowMs),
        text,
        snippet: snippetOf(text),
        read: direction === 'out' || (head.flags?.has('\\Seen') ?? false),
        inquiryId,
        attachments,
      },
      stamp,
    );
    if (inquiryId !== null && direction === 'in') {
      repo.addEvent(inquiryId, 'email', `Email received from ${from.name || from.address}: ${subject || '(no subject)'}`.slice(0, 300), stamp);
    }
    void id;
  }

  async function syncFolder(client: ImapClient, cfg: ImapConfig, folder: string, kind: 'inbox' | 'sent'): Promise<void> {
    const lock = await client.getMailboxLock(folder);
    try {
      const box = client.mailbox;
      if (!box) return;
      const validity = String(box.uidValidity);
      const state = repo.getMailSync(folder);
      const fresh = !state || state.uidValidity !== validity;
      let uids: number[];
      if (fresh) {
        const found = (await client.search({ since: new Date(now() - INITIAL_SYNC_DAYS * DAY) }, { uid: true })) || [];
        uids = found.sort((a, b) => a - b).slice(-INITIAL_SYNC_MAX);
      } else if (box.exists === 0 || box.uidNext <= state.lastUid + 1) {
        uids = [];
      } else {
        const found = (await client.search({ uid: `${state.lastUid + 1}:*` }, { uid: true })) || [];
        uids = found.filter((u) => u > state.lastUid).sort((a, b) => a - b);
      }
      const batch = uids.slice(0, SYNC_BATCH);
      let last = fresh ? 0 : state.lastUid;
      for (const uid of batch) {
        await importOne(client, cfg, folder, kind, validity, uid);
        last = Math.max(last, uid);
        repo.setMailSync(folder, validity, last, iso(now()));
      }
      // A first sync starts after everything already in the folder, so older mail is never fetched later.
      if (fresh && batch.length === uids.length) last = Math.max(last, box.uidNext - 1);
      repo.setMailSync(folder, validity, last, iso(now()));
    } finally {
      lock.release();
    }
  }

  async function runSync(cfg: ImapConfig): Promise<void> {
    try {
      await withClient(cfg, async (client) => {
        await syncFolder(client, cfg, cfg.inbox, 'inbox');
        if (cfg.sent) await syncFolder(client, cfg, cfg.sent, 'sent');
      });
      lastError = undefined;
      lastOk = iso(now());
    } catch (err) {
      lastError = reasonOf(err);
      log.warn('[mail] checking the mailbox failed:', lastError);
    }
  }

  const service: MailService = {
    address,

    status() {
      return {
        address,
        sending: mailer.transport,
        receiving: !imap ? 'off' : lastError ? 'error' : 'ok',
        lastSyncAt: lastOk,
        ...(lastError ? { error: lastError } : {}),
      };
    },

    sync() {
      if (!imap) return Promise.resolve();
      running ??= runSync(imap).finally(() => {
        running = null;
      });
      return running;
    },

    async send(input) {
      const target: MailRow | null = input.threadId ? repo.mailReplyTarget(input.threadId) : null;
      const refs = target ? [...target.refs.split(' ').filter(Boolean), ...(target.message_id ? [target.message_id] : [])].slice(-20) : [];
      const quoted = target ? { from: { name: target.from_name, address: target.from_address }, sentAt: target.sent_at, text: target.body_text } : undefined;
      const messageId = newMessageId(randomUUID(), address);
      const counterpart = input.to[0];
      const result = await mailer.send({
        to: input.to.map(formatAddress),
        subject: input.subject,
        text: replyText(input.body, input.admin.name, quoted),
        html: replyHtml(input.body, input.admin.name, quoted),
        tag: `mail-${counterpart.address}`,
        messageId,
        inReplyTo: target?.message_id ? `<${target.message_id}>` : undefined,
        references: refs.length ? refs.map((r) => `<${r}>`) : undefined,
        headers: { [APP_HEADER]: 'reply' },
      });
      const nowMs = now();
      const stamp = iso(nowMs);
      const key = subjectKey(input.subject);
      const inquiryId = input.inquiryId ?? target?.inquiry_id ?? repo.inquiryForMail(counterpart.address, input.subject);
      const text = `${input.body.trim()}\n\n${signature(input.admin.name)}`;
      const threadId = input.threadId ?? repo.mailThreadFor([], counterpart.address, key, iso(nowMs - THREAD_BY_SUBJECT_DAYS * DAY));
      const id = repo.insertMail(
        {
          threadId,
          direction: 'out',
          status: result.status,
          messageId: cleanMessageId(result.messageId ?? messageId),
          inReplyTo: target?.message_id ?? null,
          refs,
          from: { name: input.admin.name, address },
          to: input.to,
          cc: [],
          counterpart,
          subject: input.subject,
          subjectKey: key,
          sentAt: stamp,
          text,
          snippet: snippetOf(input.body),
          read: true,
          inquiryId,
          sentBy: input.admin,
        },
        stamp,
      );
      const recipients = input.to.map((a) => a.address).join(', ');
      repo.logEmail(
        { inquiryId, kind: 'mail', to: recipients, subject: input.subject, status: result.status, transport: mailer.transport, messageId: result.messageId, location: result.location },
        stamp,
      );
      if (inquiryId !== null) {
        repo.addEvent(
          inquiryId,
          'email',
          result.status === 'sent'
            ? `Email sent to ${recipients} by ${input.admin.name}: ${input.subject}`.slice(0, 300)
            : `Email to ${recipients} by ${input.admin.name} saved to the outbox (email sending is not set up): ${input.subject}`.slice(0, 300),
          stamp,
        );
        repo.touchInquiry(inquiryId, stamp);
      }
      if (result.status === 'sent' && imap?.sent && imap.appendSent) {
        const sent = imap.sent;
        tasks.run('mail: copy to the sent folder', async () => {
          try {
            await withClient(imap, (client) => client.append(sent, result.raw, ['\\Seen']));
          } catch (err) {
            log.warn('[mail] could not copy a sent email to the sent folder:', reasonOf(err));
          }
        });
      }
      const row = repo.mailThread(threadId ?? id);
      return { id, threadId: row?.id ?? id, status: result.status };
    },

    record(input) {
      const nowMs = now();
      const stamp = iso(nowMs);
      const key = subjectKey(input.subject);
      repo.insertMail(
        {
          threadId: null,
          direction: 'out',
          status: input.status,
          messageId: cleanMessageId(input.messageId),
          inReplyTo: null,
          refs: [],
          from: { name: '', address },
          to: [input.to],
          cc: [],
          counterpart: input.to,
          subject: input.subject,
          subjectKey: key,
          sentAt: stamp,
          text: input.text.replace(/\r\n/g, '\n').slice(0, MAX_TEXT),
          snippet: snippetOf(input.text),
          read: true,
          inquiryId: input.inquiryId,
        },
        stamp,
      );
    },

    markInMailbox(uids, read) {
      if (!imap || uids.length === 0) return;
      tasks.run('mail: update read state', async () => {
        try {
          await withClient(imap, async (client) => {
            for (const folder of [...new Set(uids.map((u) => u.mailbox))]) {
              const lock = await client.getMailboxLock(folder);
              try {
                const box = client.mailbox;
                const list = uids.filter((u) => u.mailbox === folder && box && u.uidValidity === String(box.uidValidity)).map((u) => u.uid);
                if (list.length === 0) continue;
                if (read) await client.messageFlagsAdd(list, ['\\Seen'], { uid: true });
                else await client.messageFlagsRemove(list, ['\\Seen'], { uid: true });
              } finally {
                lock.release();
              }
            }
          });
        } catch (err) {
          log.warn('[mail] could not update the read state in the mailbox:', reasonOf(err));
        }
      });
    },

    filePath(file) {
      return path.join(config.mailFilesDir, path.basename(file));
    },
  };
  return service;
}
