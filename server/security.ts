/**
 * Crypto primitives: password hashing (scrypt), session tokens, signed form tokens, IP hashing,
 * and a small in-memory rate limiter.
 */
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------- concurrency gate

/** Thrown when a gate's queue is full. Routes turn it into a 503. */
export class BusyError extends Error {
  constructor() {
    super('The server is busy. Try again in a moment.');
    this.name = 'BusyError';
  }
}

export type Gate = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Run at most `maxRunning` tasks at once and queue up to `maxQueue` more; beyond that, reject
 * with BusyError instead of piling up work.
 */
export function createGate(maxRunning: number, maxQueue: number): Gate {
  let running = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= maxRunning) {
      if (waiting.length >= maxQueue) throw new BusyError();
      // The slot is handed over by release(), so `running` stays the same.
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      running++;
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
}

// ---------------------------------------------------------------- passwords

/** OWASP's minimum for scrypt: N=2^17, r=8, p=1 (128 MB per hash). */
export const SCRYPT_DEFAULTS = { N: 131072, r: 8, p: 1, keylen: 64 } as const;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

let scryptCost: { N: number; r: number; p: number; keylen: number } = { ...SCRYPT_DEFAULTS };

/**
 * scrypt runs on libuv's small thread pool, which static file serving also needs. At most two
 * hashes run at once (256 MB at most) and a short queue waits; anything more gets BusyError.
 */
const scryptGate = createGate(2, 20);

/** Tests only: hash new passwords with a tiny N so the suite stays fast. */
export function useFastPasswordHashingForTests(N = 1024): void {
  scryptCost = { ...SCRYPT_DEFAULTS, N };
  dummyHash = null;
}

function scryptAsync(password: string, salt: Buffer, keylen: number, N: number, r: number, p: number): Promise<Buffer> {
  return scryptGate(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password.normalize('NFKC'), salt, keylen, { N, r, p, maxmem: SCRYPT_MAXMEM }, (err, key) => (err ? reject(err) : resolve(key)));
      }),
  );
}

/** "scrypt$N$r$p$saltB64$hashB64" */
export async function hashPassword(password: string): Promise<string> {
  const { N, r, p, keylen } = scryptCost;
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, keylen, N, r, p);
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

function storedParams(stored: string): { N: number; r: number; p: number } | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  return { N, r, p };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const params = storedParams(stored);
  if (!params) return false;
  const parts = stored.split('$');
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length === 0) return false;
  const actual = await scryptAsync(password, salt, expected.length, params.N, params.r, params.p);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when a stored hash is weaker than what hashPassword makes today, so it should be replaced at the next sign-in. */
export function needsRehash(stored: string): boolean {
  const params = storedParams(stored);
  return !params || params.N < scryptCost.N || params.r < scryptCost.r;
}

/** A real hash of a random password, so a login for an unknown email costs the same as a real one. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64url')).catch((err: unknown) => {
    // A busy gate must not poison the cache: try again next time.
    dummyHash = null;
    throw err;
  });
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

export type FormTokenCheck = { ok: true; issuedAt: number; nonce: string } | { ok: false; reason: 'invalid' | 'too-fast' | 'expired' };

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
  return { ok: true, issuedAt, nonce: parts[2] };
}

// ---------------------------------------------------------------- IP hashing

/** A salted, one-way hash of the client IP. Stable for a given secret, so it can drive rate limits. */
export function ipHasher(secret: string): (ip: string) => string {
  const salt = createHmac('sha256', secret).update('ncc-ip-hash-v1').digest();
  return (ip: string) => createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------- rate limiting

/**
 * Sliding-window counter kept in memory. Fine for the single-process server.
 * The map is kept in least-recently-used order and never holds more than `maxKeys` keys.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
  ) {}

  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (list.length > 0) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  private record(key: string, list: number[], now: number): void {
    list.push(now);
    // Re-insert so the map's order is least recently used first.
    this.hits.delete(key);
    this.hits.set(key, list);
    let excess = this.hits.size - this.maxKeys;
    if (excess <= 0) return;
    for (const oldest of this.hits.keys()) {
      if (excess-- <= 0) break;
      this.hits.delete(oldest);
    }
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

  /**
   * Check and count in one synchronous step: false when the allowance is used up, otherwise the
   * attempt is recorded and true is returned. Call it before any await, so concurrent requests
   * cannot all pass the check before one of them is counted.
   */
  consume(key: string, now: number): boolean {
    const list = this.recent(key, now);
    if (list.length >= this.limit) return false;
    this.record(key, list, now);
    return true;
  }

  hit(key: string, now: number): void {
    this.record(key, this.recent(key, now), now);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Number of keys held, for tests and diagnostics. */
  get size(): number {
    return this.hits.size;
  }

  prune(now: number): void {
    for (const key of [...this.hits.keys()]) this.recent(key, now);
  }
}
