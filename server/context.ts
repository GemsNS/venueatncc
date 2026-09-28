/**
 * Shared server context and small HTTP helpers used by the routes.
 */
import type { Context } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import type { Config } from './config';
import type { Mailer } from './email/mailer';
import type { Repo, SessionRecord } from './repo';
import type { RateLimiter } from './security';
import type { ApiError } from '../src/shared/types';

export type AppEnv = {
  Bindings: Partial<HttpBindings>;
  Variables: { session: SessionRecord; staticFile?: string };
};

export type AppContextT = Context<AppEnv>;

export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/** Background work (emails) that must finish before shutdown; tests await it too. */
export class Tasks {
  private pending = new Set<Promise<void>>();

  constructor(private readonly log: Logger) {}

  run(label: string, fn: () => Promise<void>): void {
    const p: Promise<void> = fn()
      .catch((err) => this.log.error(`[tasks] ${label} failed:`, err))
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }
}

export interface ServerContext {
  config: Config;
  repo: Repo;
  mailer: Mailer;
  /** Milliseconds since the epoch. Injectable so tests can move time. */
  now: () => number;
  log: Logger;
  tasks: Tasks;
  hashIp: (ip: string) => string;
  limits: {
    /** Sign-in attempts per client network and account. */
    login: RateLimiter;
    /** Sign-in attempts per client network, whatever email is tried. */
    loginIp: RateLimiter;
    /** Current-password checks per admin. */
    password: RateLimiter;
  };
}

export const iso = (ms: number) => new Date(ms).toISOString();

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function apiError(c: AppContextT, status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 503, error: string, fields?: Record<string, string>) {
  const body: ApiError = fields && Object.keys(fields).length > 0 ? { ok: false, error, fields } : { ok: false, error };
  return c.json(body, status);
}

/**
 * The client's IP. With TRUST_PROXY=true, the right-most X-Forwarded-For entry (the address the
 * trusted reverse proxy saw); otherwise the socket address.
 */
export function clientIp(c: AppContextT, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = c.req.header('x-forwarded-for');
    if (xff) {
      const parts = xff
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
    }
  }
  return c.env?.incoming?.socket?.remoteAddress ?? 'unknown';
}

const DOTTED_QUAD = /^([0-9]{1,3})[.]([0-9]{1,3})[.]([0-9]{1,3})[.]([0-9]{1,3})$/;
const HEXTET = /^[0-9a-f]{1,4}$/;

/** The eight 16-bit groups of an IPv6 address, or null when it does not parse. */
function ipv6Groups(address: string): number[] | null {
  let ip = address;
  // A trailing dotted quad (::ffff:192.0.2.1, 64:ff9b::192.0.2.1) is the last two groups.
  const lastColon = ip.lastIndexOf(':');
  const quad = DOTTED_QUAD.exec(ip.slice(lastColon + 1));
  if (quad) {
    const [a, b, c, d] = quad.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return null;
    ip = `${ip.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? fill !== 0 : fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  if (!groups.every((g) => HEXTET.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * The rate-limit bucket for a client address. IPv4 (including IPv4-mapped IPv6) is kept as is;
 * IPv6 is cut to its /64, because one home or server usually holds a whole /64 and could
 * otherwise rotate addresses to get a fresh allowance on every request.
 */
export function ipBucket(address: string): string {
  let ip = address.trim().toLowerCase();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  const zone = ip.indexOf('%');
  if (zone >= 0) ip = ip.slice(0, zone);
  if (!ip.includes(':')) return ip || 'unknown';
  const groups = ipv6Groups(ip);
  if (!groups) return ip;
  // ::ffff:a.b.c.d is an IPv4 client on a dual-stack socket.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.');
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}::/64`;
}

/** clientIp() reduced to its rate-limit bucket (see ipBucket). */
export const clientBucket = (c: AppContextT, trustProxy: boolean): string => ipBucket(clientIp(c, trustProxy));

/** Parse a JSON or form-encoded body into a plain object; null when it cannot be read. */
export async function readBody(c: AppContextT, allowForm: boolean): Promise<Record<string, unknown> | null> {
  const type = (c.req.header('content-type') ?? '').toLowerCase();
  try {
    if (type.includes('application/json')) {
      const value: unknown = await c.req.json();
      return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
    }
    if (allowForm && (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data'))) {
      const form = await c.req.parseBody();
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) if (typeof v === 'string') out[k] = v;
      return out;
    }
  } catch {
    return null;
  }
  return null;
}
