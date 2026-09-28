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

/** Where the database lives. Split out so the CLI tools do not need the web secrets. */
export function databasePathFrom(env: Env = process.env): string {
  return path.resolve(str(env, 'DATABASE_PATH', './data/venue.db'));
}

export function loadConfig(env: Env = process.env, log: Logger = console): Config {
  const nodeEnv = str(env, 'NODE_ENV', 'development');
  const production = nodeEnv === 'production';
  const publicOrigin = origin(str(env, 'PUBLIC_ORIGIN', site.url));
  const https = publicOrigin.startsWith('https:');

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
    : null;

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
    mailFrom: str(env, 'MAIL_FROM', `${site.name} <${site.contact.email}>`),
    notifyTo: str(env, 'NOTIFY_TO', site.contact.email),
    outboxDir: path.resolve(str(env, 'OUTBOX_DIR', './data/outbox')),
    admin:
      adminEmail && adminPassword
        ? { email: adminEmail.toLowerCase(), password: adminPassword, name: str(env, 'ADMIN_NAME', site.contact.contactName) }
        : null,
  };
}
