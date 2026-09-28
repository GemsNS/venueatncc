/**
 * Serves the built Astro site (SITE_DIR). Fingerprinted /_astro/* files are cached for a year,
 * HTML is always revalidated, /path redirects to /path/ when that directory has an index.html,
 * and anything missing gets 404.html with status 404.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Hono, MiddlewareHandler } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { AppContextT, AppEnv } from './context';

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

export function createNotFoundPage(siteDir: string, cache: boolean) {
  let cached: string | null | undefined;
  return (c: AppContextT) => {
    if (cached === undefined || !cache) {
      const file = path.join(siteDir, '404.html');
      cached = isFile(file) ? fs.readFileSync(file, 'utf8') : null;
    }
    c.header('Cache-Control', CACHE.html);
    return cached ? c.html(cached, 404) : c.text('Not found', 404);
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

  app.get('*', trailingSlash, async (c, next) => {
    if (isApi(c.req.path)) return next();
    const res = await files(c, next);
    const file = c.get('staticFile');
    if (res && file) res.headers.set('Cache-Control', cacheControlFor(c.req.path, file));
    return res;
  });
  return true;
}
