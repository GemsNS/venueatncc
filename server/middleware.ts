/**
 * Cross-cutting middleware: security headers on every response, and the same-origin check
 * for requests that change data.
 */
import type { MiddlewareHandler } from 'hono';
import type { Config } from './config';
import { apiError, MUTATING_METHODS, type AppEnv } from './context';

/**
 * The Content-Security-Policy. No inline script runs unless its SHA-256 is listed: HTML pages
 * from the built site pass the hashes of their own inline scripts (see server/static.ts), and
 * every other response gets none. Inline styles stay allowed; the pages use style attributes.
 */
export function buildCsp(scriptHashes: readonly string[] = []): string {
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    ["script-src 'self'", ...scriptHashes.map((h) => `'${h}'`)].join(' '),
    "connect-src 'self'",
    'frame-src https://www.google.com',
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** The policy for responses without inline script (API, assets, errors). */
export const CONTENT_SECURITY_POLICY = buildCsp();

export function securityHeaders(config: Pick<Config, 'hsts'>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    const h = c.res.headers;
    // An HTML page may already carry a policy with its own script hashes.
    if (!h.has('Content-Security-Policy')) h.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('X-Frame-Options', 'DENY');
    h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.hsts) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const p = c.req.path;
    if (p === '/api' || p.startsWith('/api/') || p === '/admin' || p.startsWith('/admin/')) h.set('X-Robots-Tag', 'noindex, nofollow');
  };
}

/** Origin of a Referer URL, or undefined. */
function refererOrigin(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/** True when the request's Origin is the public site or the host the request was sent to. */
export function originAllowed(source: string, host: string | undefined, publicOrigin: string): boolean {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.origin === publicOrigin) return true;
  return !!host && url.host.toLowerCase() === host.toLowerCase();
}

/**
 * Requests that change data must carry an Origin (or Referer) from this site. Stops cross-site
 * form posts and fetches from other origins, on top of SameSite cookies.
 */
export function sameOrigin(config: Pick<Config, 'publicOrigin'>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!MUTATING_METHODS.has(c.req.method)) return next();
    const source = c.req.header('origin') || refererOrigin(c.req.header('referer'));
    const host = c.req.header('host') || new URL(c.req.url).host;
    if (!source || source === 'null' || !originAllowed(source, host, config.publicOrigin)) {
      return apiError(c, 403, 'This request was blocked because it did not come from this website. Reload the page and try again.');
    }
    return next();
  };
}

/** API responses are never cached by browsers or proxies. */
export const noStore: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
};
