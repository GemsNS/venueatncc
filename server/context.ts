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
  limits: { login: RateLimiter; password: RateLimiter };
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
