/**
 * Test harness: a temp database, outbox, and site folder per harness, an injectable clock,
 * and a request helper that sets Origin / X-Requested-With / client IP like a browser would.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../app';
import { loadConfig, type Config } from '../config';
import { iso, type Logger } from '../context';
import { openDatabase, type Db } from '../db';
import { hashPassword, useFastPasswordHashingForTests } from '../security';
import { addDays, dayOfWeek, todayKey } from '../../src/shared/dates';
import type { InquiryInput } from '../../src/shared/types';

export const ADMIN_EMAIL = 'faith@venueatncc.org';
export const ADMIN_PASSWORD = 'correct horse battery staple';
export const ORIGIN = 'https://venueatncc.org';

export const silentLog: Logger & Pick<Console, 'warn'> = { info() {}, warn() {}, error() {} };

export interface Clock {
  now: number;
  advance(ms: number): void;
}

export interface RequestOptions {
  method?: string;
  /** Object bodies are sent as JSON; strings as-is (set content-type yourself). */
  body?: unknown;
  headers?: Record<string, string>;
  /** Client IP via X-Forwarded-For (the harness sets TRUST_PROXY=true). */
  ip?: string;
  /** Origin header for writes. Defaults to the public origin; pass null to omit it. */
  origin?: string | null;
  /** X-Requested-With: fetch on writes (default true). */
  xrw?: boolean;
  cookie?: string;
}

export interface Harness {
  dir: string;
  config: Config;
  db: Db;
  clock: Clock;
  app: ReturnType<typeof createApp>['app'];
  ctx: ReturnType<typeof createApp>['ctx'];
  whenIdle(): Promise<void>;
  request(urlPath: string, opts?: RequestOptions): Promise<Response>;
  close(): Promise<void>;
}

let ipCounter = 0;
/** A distinct client IP per call, so rate limits never leak between tests. */
export const freshIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

/** The home page's one inline script; its hash must be in the page's CSP. */
export const HOME_INLINE_SCRIPT = 'document.documentElement.dataset.js = "1";';

export function writeSite(dir: string): void {
  const files: Record<string, string> = {
    'index.html': `<!doctype html><title>Home</title><script>${HOME_INLINE_SCRIPT}</script><script type="application/ld+json">{"@type":"Place"}</script><h1>Home</h1>`,
    'book/index.html': '<!doctype html><title>Book</title><h1>Book</h1>',
    '404.html': '<!doctype html><title>Not found</title><h1>Page not found</h1>',
    '_astro/app.abc123.js': 'console.log(1);',
    'robots.txt': 'User-agent: *',
  };
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

export async function createHarness(env: Record<string, string> = {}): Promise<Harness> {
  // Production scrypt (N=2^17) costs about half a second a hash; the API tests only need it to work.
  useFastPasswordHashingForTests();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncc-server-test-'));
  const siteDir = path.join(dir, 'site');
  writeSite(siteDir);
  const config = loadConfig(
    {
      NODE_ENV: 'test',
      PUBLIC_ORIGIN: ORIGIN,
      SESSION_SECRET: 's'.repeat(40),
      FORM_TOKEN_SECRET: 'f'.repeat(40),
      DATABASE_PATH: path.join(dir, 'venue.db'),
      OUTBOX_DIR: path.join(dir, 'outbox'),
      SITE_DIR: siteDir,
      TRUST_PROXY: 'true',
      ...env,
    },
    silentLog,
  );
  const db = openDatabase(config.databasePath);
  // 11:00 in Suffolk on Thursday, October 1, 2026.
  const clock: Clock = {
    now: Date.parse('2026-10-01T15:00:00.000Z'),
    advance(ms) {
      this.now += ms;
    },
  };
  const { app, ctx, whenIdle } = createApp({ config, db, now: () => clock.now, log: silentLog });
  ctx.repo.createAdmin(ADMIN_EMAIL, 'Faith', await hashPassword(ADMIN_PASSWORD), iso(clock.now));

  const request = (urlPath: string, opts: RequestOptions = {}) => {
    const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    const writes = method !== 'GET' && method !== 'HEAD';
    if (writes && opts.origin !== null && !('origin' in headers)) headers.origin = opts.origin ?? ORIGIN;
    if (writes && opts.xrw !== false) headers['x-requested-with'] = 'fetch';
    headers['x-forwarded-for'] = opts.ip ?? headers['x-forwarded-for'] ?? '192.0.2.1';
    if (opts.cookie) headers.cookie = opts.cookie;
    let body: string | undefined;
    if (typeof opts.body === 'string') body = opts.body;
    else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers['content-type'] ??= 'application/json';
    }
    return Promise.resolve(app.request(`http://localhost${urlPath}`, { method, headers, body }));
  };

  let closed = false;
  return {
    dir,
    config,
    db,
    clock,
    app,
    ctx,
    whenIdle,
    request,
    async close() {
      if (closed) return;
      closed = true;
      await whenIdle();
      if (db.open) db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** The date itself, or the Monday after when it is a Sunday: the venue is closed on Sundays. */
export function openDay(key: string): string {
  return dayOfWeek(key) === 0 ? addDays(key, 1) : key;
}

/** A valid inquiry for a date 30 days after the harness clock's today. */
export function inquiryBody(h: Harness, token: string, overrides: Partial<InquiryInput> = {}): InquiryInput {
  return {
    eventType: 'weddings',
    date: openDay(addDays(todayKey(new Date(h.clock.now)), 30)),
    startTime: '17:00',
    hours: 5,
    space: 'indoor',
    guests: 80,
    name: 'Jordan Rivers',
    email: 'jordan@example.com',
    phone: '(757) 555-0100',
    contactPreference: 'email',
    message: 'Hoping for a spring reception.',
    wantsVisit: true,
    formToken: token,
    ...overrides,
  };
}

export async function formToken(h: Harness): Promise<string> {
  const res = await h.request('/api/form-token');
  const { token } = (await res.json()) as { token: string };
  return token;
}

/** Get a token, let 4 seconds pass on the injected clock, and submit. */
export async function submitInquiry(h: Harness, overrides: Partial<InquiryInput> = {}, ip = freshIp()): Promise<Response> {
  const token = await formToken(h);
  h.clock.advance(4_000);
  return h.request('/api/inquiries', { body: inquiryBody(h, token, overrides), ip });
}

export async function login(h: Harness, ip = freshIp(), cookie?: string): Promise<string> {
  const res = await h.request('/api/admin/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ip, cookie });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return sessionCookie(res);
}

/** "__Host-ncc_session=<token>" (or "ncc_session=<token>" without HTTPS) from a Set-Cookie header. */
export function sessionCookie(res: Response): string {
  const header = res.headers.get('set-cookie') ?? '';
  const match = /((?:__Host-)?ncc_session)=([^;]+)/.exec(header);
  if (!match) throw new Error(`no session cookie in: ${header}`);
  return `${match[1]}=${match[2]}`;
}
