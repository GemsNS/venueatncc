/**
 * Crypto primitives: password hashing (scrypt), session tokens, signed form tokens, IP hashing,
 * and a small in-memory rate limiter.
 */
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------- passwords

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

function scryptAsync(password: string, salt: Buffer, keylen: number, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** "scrypt$N$r$p$saltB64$hashB64" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT.N, SCRYPT.r, SCRYPT.p);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length === 0) return false;
  const actual = await scryptAsync(password, salt, expected.length, N, r, p);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash of a random password, so a login for an unknown email costs the same as a real one. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64url'));
  return dummyHash;
}

// ---------------------------------------------------------------- sessions

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** An opaque token for the cookie; only its SHA-256 is stored. */
export function newSessionToken(): { token: string; id: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, id: sha256(token) };
}

// ---------------------------------------------------------------- form tokens

export const FORM_TOKEN_MIN_AGE_MS = 3_000;
export const FORM_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');

/** "v1.<issuedAtMs>.<nonce>.<hmac>" */
export function issueFormToken(secret: string, now: number): string {
  const payload = `v1.${now}.${randomBytes(9).toString('base64url')}`;
  return `${payload}.${sign(secret, payload)}`;
}

export type FormTokenCheck = { ok: true; issuedAt: number } | { ok: false; reason: 'invalid' | 'too-fast' | 'expired' };

export function checkFormToken(secret: string, token: string, now: number): FormTokenCheck {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !/^[0-9]{1,16}$/.test(parts[1])) return { ok: false, reason: 'invalid' };
  const payload = parts.slice(0, 3).join('.');
  const expected = Buffer.from(sign(secret, payload));
  const actual = Buffer.from(parts[3]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { ok: false, reason: 'invalid' };
  const issuedAt = Number(parts[1]);
  const age = now - issuedAt;
  if (age < 0) return { ok: false, reason: 'invalid' };
  if (age < FORM_TOKEN_MIN_AGE_MS) return { ok: false, reason: 'too-fast' };
  if (age >= FORM_TOKEN_MAX_AGE_MS) return { ok: false, reason: 'expired' };
  return { ok: true, issuedAt };
}

// ---------------------------------------------------------------- IP hashing

/** A salted, one-way hash of the client IP. Stable for a given secret, so it can drive rate limits. */
export function ipHasher(secret: string): (ip: string) => string {
  const salt = createHmac('sha256', secret).update('ncc-ip-hash-v1').digest();
  return (ip: string) => createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------- rate limiting

/** Sliding-window counter kept in memory. Fine for the single-process server. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (list.length > 0) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** True when the key has used up its allowance in the window. */
  blocked(key: string, now: number): boolean {
    return this.recent(key, now).length >= this.limit;
  }

  /** Milliseconds until the oldest hit leaves the window. */
  retryAfterMs(key: string, now: number): number {
    const list = this.recent(key, now);
    return list.length === 0 ? 0 : Math.max(0, list[0] + this.windowMs - now);
  }

  hit(key: string, now: number): void {
    const list = this.recent(key, now);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune(now);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  prune(now: number): void {
    for (const key of [...this.hits.keys()]) this.recent(key, now);
  }
}
