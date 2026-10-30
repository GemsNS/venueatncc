/**
 * Server configuration, read once from environment variables.
 * Every variable is documented in .env.example.
 */
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { site } from '../src/data/site';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

/** The mailbox the admin reads (server/mail/imap.ts). Password, or a Microsoft 365 app (OAuth client credentials). */
export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  oauth?: { tenant: string; clientId: string; clientSecret: string };
  inbox: string;
  /** The sent folder, to copy the admin's emails into and read replies sent from other mail apps. */
  sent: string | null;
  /**
   * Copy every message in the folders. When false (the mailbox also holds someone else's mail, as when
   * the venue address is an alias), only mail to or from the venue address, or in its threads, is copied.
   */
  copyAll: boolean;
  /** Copy emails sent from the admin into the sent folder. Off for Gmail, which files what it sends itself. */
  appendSent: boolean;
}

/**
 * The venue's mailbox: faith@venueatncc.org on Google Workspace. With MAIL_APP_PASSWORD set (a Google
 * app password for that account) and no SMTP_HOST or IMAP_HOST, the server sends and receives through it
 * with these settings; nothing else needs configuring (docs/deploy-gcloud-apache.md, section 11).
 */
export const GOOGLE_MAIL = {
  smtp: { host: 'smtp.gmail.com', port: 587, secure: false },
  imap: { host: 'imap.gmail.com', port: 993, secure: true, inbox: 'INBOX', sent: '[Gmail]/Sent Mail' },
} as const;

export interface Config {
  nodeEnv: string;
  production: boolean;
  port: number;
  host: string;
  databasePath: string;
  siteDir: string;
  /** Normalised origin, for example "https://venueatncc.org" (no trailing slash). */
  publicOrigin: string;
  sessionSecret: string;
  formTokenSecret: string;
  trustProxy: boolean;
  /** Secure cookie flag: on when PUBLIC_ORIGIN is https or NODE_ENV=production. */
  secureCookies: boolean;
  /** Send HSTS: on when PUBLIC_ORIGIN is https. */
  hsts: boolean;
  smtp: SmtpConfig | null;
  mailFrom: string;
  notifyTo: string;
  outboxDir: string;
  /** Delete outbox files after this many days; null keeps them (the default). */
  outboxRetentionDays: number | null;
  /** The address in MAIL_FROM: the venue's own address, as the admin's mail shows it. */
  mailAddress: string;
  imap: ImapConfig | null;
  /** How often the server checks the mailbox. */
  mailPollSeconds: number;
  /** Where received attachments are kept. */
  mailFilesDir: string;
  admin: { email: string; password: string; name: string } | null;
}

type Env = Record<string, string | undefined>;
type Logger = Pick<Console, 'warn'>;

const MIN_SECRET_LENGTH = 32;

function str(env: Env, key: string, fallback: string): string {
  const v = env[key];
  return v === undefined || v.trim() === '' ? fallback : v.trim();
}

function optional(env: Env, key: string): string | undefined {
  const v = env[key];
  return v === undefined || v.trim() === '' ? undefined : v.trim();
}

function bool(env: Env, key: string, fallback: boolean): boolean {
  const v = optional(env, key);
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function int(env: Env, key: string, fallback: number): number {
  const v = optional(env, key);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`${key} must be a whole number, got "${v}".`);
  return n;
}

function origin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`PUBLIC_ORIGIN must be a full URL such as https://venueatncc.org, got "${value}".`);
  }
}

function secret(env: Env, key: string, production: boolean, log: Logger): string {
  const v = optional(env, key);
  if (v && v.length >= MIN_SECRET_LENGTH) return v;
  if (production) {
    throw new Error(
      v
        ? `${key} must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
        : `${key} is required when NODE_ENV=production. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`,
    );
  }
  log.warn(`[config] ${key} is ${v ? 'too short' : 'not set'}; using an ephemeral secret. Sessions and form tokens reset when the server restarts.`);
  return randomBytes(32).toString('base64url');
}

/** The address part of "Name <address>", lower case. */
export function addressOf(from: string): string {
  return (/<([^<>]+)>s*$/.exec(from)?.[1] ?? from).trim().toLowerCase();
}

/** Where the database lives. Split out so the CLI tools do not need the web secrets. */
export function databasePathFrom(env: Env = process.env): string {
  return path.resolve(str(env, 'DATABASE_PATH', './data/venue.db'));
}

export function loadConfig(env: Env = process.env, log: Logger = console): Config {
  const nodeEnv = str(env, 'NODE_ENV', 'development');
  const production = nodeEnv === 'production';
  const publicOrigin = origin(str(env, 'PUBLIC_ORIGIN', site.url));
  const https = publicOrigin.startsWith('https:');

  const mailFrom = str(env, 'MAIL_FROM', `${site.name} <${site.contact.email}>`);
  const mailAddress = addressOf(mailFrom);
  // Google shows app passwords in groups of four; the spaces are not part of it.
  const appPassword = optional(env, 'MAIL_APP_PASSWORD')?.replace(/\s+/g, '');

  const smtpHost = optional(env, 'SMTP_HOST');
  const smtpUser = optional(env, 'SMTP_USER');
  const smtp: SmtpConfig | null = smtpHost
    ? {
        host: smtpHost,
        port: int(env, 'SMTP_PORT', 587),
        secure: bool(env, 'SMTP_SECURE', false),
        user: smtpUser,
        pass: smtpUser ? (env.SMTP_PASS ?? '') : undefined,
      }
    : appPassword
      ? { ...GOOGLE_MAIL.smtp, user: mailAddress, pass: appPassword }
      : null;

  const imapHost = optional(env, 'IMAP_HOST');
  const imapUser = optional(env, 'IMAP_USER') ?? mailAddress;
  const tenant = optional(env, 'IMAP_OAUTH_TENANT');
  const clientId = optional(env, 'IMAP_OAUTH_CLIENT_ID');
  const clientSecret = optional(env, 'IMAP_OAUTH_CLIENT_SECRET');
  if (imapHost && !(tenant && clientId && clientSecret) && !env.IMAP_PASS) {
    throw new Error('IMAP_HOST is set, so IMAP_PASS (or IMAP_OAUTH_TENANT, IMAP_OAUTH_CLIENT_ID and IMAP_OAUTH_CLIENT_SECRET) is required.');
  }
  const imap: ImapConfig | null = imapHost
    ? {
        host: imapHost,
        port: int(env, 'IMAP_PORT', 993),
        secure: bool(env, 'IMAP_SECURE', true),
        user: imapUser,
        pass: tenant && clientId && clientSecret ? undefined : env.IMAP_PASS,
        oauth: tenant && clientId && clientSecret ? { tenant, clientId, clientSecret } : undefined,
        inbox: str(env, 'IMAP_INBOX', 'INBOX'),
        sent: optional(env, 'IMAP_SENT') ?? null,
        // A mailbox of its own (signing in as the venue address) is all venue mail.
        copyAll: bool(env, 'IMAP_COPY_ALL', imapUser.toLowerCase() === mailAddress),
        appendSent: !/(^|\.)gmail\.com$/i.test(imapHost),
      }
    : appPassword
      ? { ...GOOGLE_MAIL.imap, user: mailAddress, pass: appPassword, copyAll: true, appendSent: false }
      : null;
  const dataDir = path.dirname(databasePathFrom(env));

  const adminEmail = optional(env, 'ADMIN_EMAIL');
  const adminPassword = env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length > 0 ? env.ADMIN_PASSWORD : undefined;

  return {
    nodeEnv,
    production,
    port: int(env, 'PORT', 8787),
    host: str(env, 'HOST', '0.0.0.0'),
    databasePath: databasePathFrom(env),
    siteDir: path.resolve(str(env, 'SITE_DIR', './dist')),
    publicOrigin,
    sessionSecret: secret(env, 'SESSION_SECRET', production, log),
    formTokenSecret: secret(env, 'FORM_TOKEN_SECRET', production, log),
    trustProxy: bool(env, 'TRUST_PROXY', false),
    secureCookies: https || production,
    hsts: https,
    smtp,
    mailFrom,
    notifyTo: str(env, 'NOTIFY_TO', site.contact.email),
    outboxDir: path.resolve(str(env, 'OUTBOX_DIR', './data/outbox')),
    outboxRetentionDays: int(env, 'OUTBOX_RETENTION_DAYS', 0) || null,
    mailAddress,
    imap,
    mailPollSeconds: Math.max(30, int(env, 'MAIL_POLL_SECONDS', 120)),
    mailFilesDir: path.resolve(str(env, 'MAIL_FILES_DIR', path.join(dataDir, 'mail-files'))),
    admin:
      adminEmail && adminPassword
        ? { email: adminEmail.toLowerCase(), password: adminPassword, name: str(env, 'ADMIN_NAME', site.contact.contactName) }
        : null,
  };
}
