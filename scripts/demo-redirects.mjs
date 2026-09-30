// @ts-check
/**
 * Redirect pages for the GitHub Pages demo.
 *
 * In production the API server answers a moved page's old address with a 301 (MOVED_PAGES in
 * server/static.ts). GitHub Pages cannot redirect, so the demo build writes a small page at each old
 * address instead: a meta refresh to the new address, a canonical link to it, robots noindex, and a
 * visible link for anyone whose browser does not follow the refresh. The page names only the new address.
 */
import { mkdir, writeFile } from 'node:fs/promises';

/** @param {string} s */
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The redirect page. Its colors are the site's page colors (White and Plum, or the dark page and its
 * label color), so it does not flash a different color in either appearance.
 * @param {string} to The new address as served, with the base, e.g. '/venueatncc/the-space/'.
 * @param {string} canonical The new address in full.
 */
export function redirectPage(to, canonical) {
  const url = escapeHtml(to);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${url}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<title>This page has moved</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0; padding: 24px 16px; font: 17px/1.5 system-ui, sans-serif; background: #ffffff; color: #3b2430; }
a { color: #9e2b52; }
@media (prefers-color-scheme: dark) {
  body { background: #2a151f; color: #fbeff2; }
  a { color: #f5a8bd; }
}
</style>
</head>
<body>
<p>This page has moved. <a href="${url}">Go to the new page</a>.</p>
</body>
</html>
`;
}

/**
 * Writes one redirect page per moved page when the build is done. A real page at an old address is an
 * error: the build stops rather than overwrite it.
 * @param {{ moved: ReadonlyMap<string, string>, base: string, site: string }} options
 *   moved: old path to new path, both base-relative with slashes at each end, e.g. '/about/' to '/the-space/'.
 * @returns {import('astro').AstroIntegration}
 */
export function demoRedirects({ moved, base, site }) {
  const root = base.endsWith('/') ? base : `${base}/`;
  const trim = (/** @type {string} */ p) => p.replace(/^[/]+/, '');
  return {
    name: 'venue:demo-redirects',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await Promise.all(
          [...moved].map(async ([from, to]) => {
            const served = `${root}${trim(to)}`;
            const folder = new URL(trim(from), dir);
            await mkdir(folder, { recursive: true });
            await writeFile(new URL('index.html', folder), redirectPage(served, new URL(served, site).href), { flag: 'wx' });
          }),
        );
      },
    },
  };
}
