/**
 * Outgoing mail. With SMTP configured, messages go out through nodemailer's SMTP transport.
 * Without it, each message is written to OUTBOX_DIR as an .eml file (the full MIME message,
 * openable in any mail app) and an .html file (the HTML part, openable in a browser).
 *
 * Every message is built once as raw MIME and that exact message is sent (or saved), so the admin's mail
 * can copy what went out into the mailbox's sent folder.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createTransport } from 'nodemailer';
import type { Config } from '../config';
import { createTokenSource, type TokenSource } from '../mail/m365';

export interface EmailMessage {
  to: string | string[];
  cc?: string[];
  replyTo?: string | { name: string; address: string };
  subject: string;
  html: string;
  text: string;
  /** Short name used for outbox files, e.g. "NCC-7K3QX-guest". */
  tag: string;
  /** Set to thread a reply: "<id@host>" forms. */
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface SendResult {
  status: 'sent' | 'outbox';
  messageId?: string;
  /** Outbox only: the .eml path. */
  location?: string;
  /** The message exactly as sent. */
  raw: Buffer;
}

export interface Mailer {
  readonly transport: 'smtp' | 'outbox';
  send(message: EmailMessage): Promise<SendResult>;
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'message';

/** A header value as nodemailer takes it: the message's own fields, from config.mailFrom. */
function mailOptions(from: string, m: EmailMessage) {
  return {
    from,
    to: m.to,
    cc: m.cc,
    replyTo: m.replyTo,
    subject: m.subject,
    html: m.html,
    text: m.text,
    messageId: m.messageId,
    inReplyTo: m.inReplyTo,
    references: m.references,
    headers: m.headers,
  };
}

const asBuffer = (raw: unknown): Buffer => (Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw)));

export function createMailer(config: Pick<Config, 'smtp' | 'mailFrom' | 'outboxDir'>, now: () => number = Date.now, tokens?: TokenSource): Mailer {
  // Builds the raw message (no network).
  const composer = createTransport({ streamTransport: true, buffer: true, newline: config.smtp ? 'windows' : 'unix' });
  const compose = async (m: EmailMessage) => {
    const info = await composer.sendMail(mailOptions(config.mailFrom, m));
    return { raw: asBuffer(info.message), messageId: typeof info.messageId === 'string' ? info.messageId : undefined, envelope: info.envelope };
  };

  if (config.smtp) {
    const smtp = config.smtp;
    const settings = { host: smtp.host, port: smtp.port, secure: smtp.secure, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 };
    const transporter = smtp.oauth ? null : createTransport({ ...settings, auth: smtp.user ? { user: smtp.user, pass: smtp.pass ?? '' } : undefined });
    const getToken = tokens ?? createTokenSource(fetch, now);
    return {
      transport: 'smtp',
      async send(m) {
        const built = await compose(m);
        // Microsoft 365: a fresh connection with the current token (tokens last an hour).
        const via =
          transporter ??
          createTransport({ ...settings, auth: { type: 'OAuth2', user: smtp.user ?? '', accessToken: await getToken(smtp.oauth!) } });
        await via.sendMail({ envelope: built.envelope, raw: built.raw });
        return { status: 'sent', messageId: built.messageId, raw: built.raw };
      },
    };
  }

  return {
    transport: 'outbox',
    async send(m) {
      const built = await compose(m);
      await fs.mkdir(config.outboxDir, { recursive: true, mode: 0o700 });
      const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-');
      const base = path.join(config.outboxDir, `${stamp}-${safeName(m.tag)}-${randomBytes(3).toString('hex')}`);
      // Guests' names, emails, and phone numbers: readable by the app's user only.
      await fs.writeFile(`${base}.eml`, built.raw, { mode: 0o600 });
      await fs.writeFile(`${base}.html`, m.html, { mode: 0o600 });
      return { status: 'outbox', messageId: built.messageId, location: `${base}.eml`, raw: built.raw };
    },
  };
}

/**
 * Delete outbox .eml and .html files last changed more than `days` days before `now`.
 * Only runs when OUTBOX_RETENTION_DAYS is set: while SMTP is not set up, the outbox is how the
 * team reads mail, so nothing is deleted by default. Returns how many files were deleted.
 */
export async function pruneOutbox(dir: string, days: number, now: number = Date.now()): Promise<number> {
  if (!(days > 0)) return 0;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    if (!name.endsWith('.eml') && !name.endsWith('.html')) continue;
    const file = path.join(dir, name);
    try {
      const st = await fs.stat(file);
      if (st.isFile() && st.mtimeMs < cutoff) {
        await fs.unlink(file);
        removed++;
      }
    } catch {
      // Gone already, or not ours to delete.
    }
  }
  return removed;
}
