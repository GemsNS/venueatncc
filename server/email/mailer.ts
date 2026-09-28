/**
 * Outgoing mail. With SMTP configured, messages go out through nodemailer's SMTP transport.
 * Without it, each message is written to OUTBOX_DIR as an .eml file (the full MIME message,
 * openable in any mail app) and an .html file (the HTML part, openable in a browser).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createTransport } from 'nodemailer';
import type { Config } from '../config';

export interface EmailMessage {
  to: string;
  replyTo?: string | { name: string; address: string };
  subject: string;
  html: string;
  text: string;
  /** Short name used for outbox files, e.g. "NCC-7K3QX-guest". */
  tag: string;
}

export interface SendResult {
  status: 'sent' | 'outbox';
  messageId?: string;
  /** Outbox only: the .eml path. */
  location?: string;
}

export interface Mailer {
  readonly transport: 'smtp' | 'outbox';
  send(message: EmailMessage): Promise<SendResult>;
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'message';

export function createMailer(config: Pick<Config, 'smtp' | 'mailFrom' | 'outboxDir'>, now: () => number = Date.now): Mailer {
  if (config.smtp) {
    const smtp = config.smtp;
    const transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass ?? '' } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    return {
      transport: 'smtp',
      async send(m) {
        const info = await transporter.sendMail({ from: config.mailFrom, to: m.to, replyTo: m.replyTo, subject: m.subject, html: m.html, text: m.text });
        return { status: 'sent', messageId: typeof info.messageId === 'string' ? info.messageId : undefined };
      },
    };
  }

  const composer = createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  return {
    transport: 'outbox',
    async send(m) {
      const info = await composer.sendMail({ from: config.mailFrom, to: m.to, replyTo: m.replyTo, subject: m.subject, html: m.html, text: m.text });
      await fs.mkdir(config.outboxDir, { recursive: true });
      const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-');
      const base = path.join(config.outboxDir, `${stamp}-${safeName(m.tag)}-${randomBytes(3).toString('hex')}`);
      const raw = info.message;
      await fs.writeFile(`${base}.eml`, Buffer.isBuffer(raw) ? raw : String(raw));
      await fs.writeFile(`${base}.html`, m.html);
      return { status: 'outbox', messageId: typeof info.messageId === 'string' ? info.messageId : undefined, location: `${base}.eml` };
    },
  };
}
