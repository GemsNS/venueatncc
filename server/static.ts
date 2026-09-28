/**
 * Serves the built Astro site (SITE_DIR). Fingerprinted /_astro/* files are cached for a year,
 * HTML is always revalidated, /path redirects to /path/ when that directory has an index.html,
 * and anything missing gets 404.html with status 404. Each HTML page gets a Content-Security-Policy
 * that allows exactly its own inline scripts, by hash.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Hono, MiddlewareHandler } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { AppContextT, AppEnv } from './context';
import { buildCsp, CONTENT_SECURITY_POLICY } from './middleware';

const BACKSLASH = String.fromCharCode(92);
const NUL = String.fromCharCode(0);

export const CACHE = {
  immutable: 'public, max-age=31536000, immutable',
  html: 'no-cache',
  asset: 'public, max-age=3600',
} as const;

export function cacheControlFor(urlPath: string, filePath: string): string {
  if (urlPath.startsWith('/_astro/')) return CACHE.immutable;
  if (filePath.endsWith('.html') || urlPath.endsWith('/')) return CACHE.html;
  return CACHE.asset;
}

const isApi = (p: string) => p === '/api' || p.startsWith('/api/');

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Resolve a URL path inside root, or null if it would escape it or is malformed. */
function resolveInside(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes(NUL) || decoded.includes(BACKSLASH) || decoded.includes('//') || decoded.split('/').includes('..')) return null;
  const full = path.join(root, decoded);
  const rel = path.relative(root, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return full;
}

// ---------------------------------------------------------------- inline script hashes

const SCRIPT_ELEMENT = /<script([^>]*)>([^]*?)<[/]script\s*>/gi;
const SRC_ATTRIBUTE = /(^|\s)src\s*=/i;
const TYPE_ATTRIBUTE = /(^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const SCRIPT_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript']);

/**
 * CSP hashes ("sha256-<base64>") of the inline scripts a page runs: <script> elements without
 * src whose type is empty, module, or JavaScript. Data blocks such as application/ld+json never
 * run, so they need no hash.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(SCRIPT_ELEMENT)) {
    const attrs = match[1] ?? '';
    if (SRC_ATTRIBUTE.test(attrs)) continue;
    const type = TYPE_ATTRIBUTE.exec(attrs);
    const value = (type ? (type[2] ?? type[3] ?? type[4] ?? '') : '').trim().toLowerCase();
    if (!SCRIPT_TYPES.has(value)) continue;
    hashes.add(`sha256-${createHash('sha256').update(match[2], 'utf8').digest('base64')}`);
  }
  return [...hashes].sort();
}

/** The CSP for an HTML file, recomputed only when the file changes (a rebuild needs no restart). */
function htmlPolicy(): (file: string) => string {
  const cache = new Map<string, { key: string; policy: string }>();
  return (file) => {
    let key = '';
    try {
      const st = fs.statSync(file);
      key = `${st.mtimeMs}:${st.size}`;
    } catch {
      return CONTENT_SECURITY_POLICY;
    }
    const hit = cache.get(file);
    if (hit && hit.key === key) return hit.policy;
    let policy = CONTENT_SECURITY_POLICY;
    try {
      policy = buildCsp(inlineScriptHashes(fs.readFileSync(file, 'utf8')));
    } catch {
      // Unreadable: fall back to the policy without inline scripts.
    }
    cache.set(file, { key, policy });
    return policy;
  };
}

export function createNotFoundPage(siteDir: string, cache: boolean) {
  let cached: { html: string; policy: string } | null | undefined;
  return (c: AppContextT) => {
    if (cached === undefined || !cache) {
      const file = path.join(siteDir, '404.html');
      if (isFile(file)) {
        const html = fs.readFileSync(file, 'utf8');
        cached = { html, policy: buildCsp(inlineScriptHashes(html)) };
      } else {
        cached = null;
      }
    }
    c.header('Cache-Control', CACHE.html);
    if (!cached) return c.text('Not found', 404);
    c.header('Content-Security-Policy', cached.policy);
    return c.html(cached.html, 404);
  };
}

/** Returns false (and serves nothing) when the folder does not exist, e.g. under astro dev. */
export function mountStatic(app: Hono<AppEnv>, siteDir: string): boolean {
  const root = path.resolve(siteDir);
  if (!fs.existsSync(root)) return false;

  const trailingSlash: MiddlewareHandler<AppEnv> = async (c, next) => {
    const p = c.req.path;
    if (isApi(p) || p.endsWith('/')) return next();
    const dir = resolveInside(root, p);
    if (dir && isFile(path.join(dir, 'index.html'))) {
      const search = new URL(c.req.url).search;
      return c.redirect(`${p}/${search}`, 301);
    }
    return next();
  };

  // serveStatic builds its Response before onFound runs, so remember the file and set caching after.
  const files = serveStatic<AppEnv>({
    root,
    onFound: (filePath, c) => {
      c.set('staticFile', filePath);
    },
  });

  const policyFor = htmlPolicy();
  app.get('*', trailingSlash, async (c, next) => {
    if (isApi(c.req.path)) return next();
    const res = await files(c, next);
    const file = c.get('staticFile');
    if (res && file) {
      res.headers.set('Cache-Control', cacheControlFor(c.req.path, file));
      if (file.endsWith('.html')) res.headers.set('Content-Security-Policy', policyFor(file));
    }
    return res;
  });
  return true;
}
