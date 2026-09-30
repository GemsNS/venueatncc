// @ts-check
import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import { site } from './src/data/site.ts';
import { MOVED_PAGES } from './server/static.ts';
import { demoRedirects } from './scripts/demo-redirects.mjs';

/**
 * Two targets, one codebase. Astro always builds a static site; interactivity lives in Preact islands.
 *
 *   npm run build        production: static site in dist/, served with the API by server/ (Node)
 *   npm run build:demo   GitHub Pages demo: PUBLIC_DEMO=true, base /venueatncc/, in-browser demo backend,
 *                        noindex everywhere, no sitemap, and a redirect page at each moved page's old
 *                        address (production answers those with a 301 from server/static.ts)
 */
const isDemo = process.env.PUBLIC_DEMO === 'true';
const demoBase = process.env.DEMO_BASE ?? '/venueatncc/';
const demoSite = process.env.DEMO_SITE ?? 'https://gemsns.github.io';

/**
 * The source files behind each public page: the page itself plus the data it shows.
 * Every page shows the venue facts from site.ts (the contact details in the footer).
 * @param {string} pathname e.g. '/', '/pricing/', '/events/weddings/'
 */
function pageSources(pathname) {
  const p = pathname.replace(/^[/]+|[/]+$/g, '');
  const facts = 'src/data/site.ts';
  if (p === '') return ['src/pages/index.astro', facts, 'src/data/events.ts', 'src/shared/pricing.ts'];
  if (p === 'events') return ['src/pages/events/index.astro', facts, 'src/data/events.ts'];
  if (p.startsWith('events/')) return ['src/pages/events/[slug].astro', facts, 'src/data/events.ts', 'src/shared/pricing.ts'];
  if (p === 'pricing') return ['src/pages/pricing.astro', facts, 'src/shared/pricing.ts'];
  if (p === 'faq') return ['src/pages/faq.astro', facts, 'src/data/faq.ts', 'src/shared/pricing.ts'];
  if (p === 'the-space') return ['src/pages/the-space.astro', facts, 'src/data/photos.ts', 'src/shared/pricing.ts'];
  return [`src/pages/${p}.astro`, facts];
}

/**
 * lastmod for the sitemap: the last commit that touched a page's sources. Only when the full git
 * history is at hand; a shallow clone or a Docker build (no .git) would give a wrong date, and a
 * build-time date would change on every deploy, so then lastmod is left out.
 * @param {string} pageUrl
 * @returns {string | undefined}
 */
function lastCommitDate(pageUrl) {
  try {
    const git = (/** @type {string[]} */ args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (git(['rev-parse', '--is-shallow-repository']) !== 'false') return undefined;
    return git(['log', '-1', '--format=%cI', '--', ...pageSources(new URL(pageUrl).pathname)]) || undefined;
  } catch {
    return undefined;
  }
}

export default defineConfig({
  site: isDemo ? demoSite : site.url,
  base: isDemo ? demoBase : '/',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  integrations: [
    preact({ compat: false }),
    ...(isDemo
      ? [
          {
            // The demo lives under a project path on GitHub Pages, where crawlers never read its robots.txt
            // and Pages ignores _headers. Pages carry noindex, but plain files cannot, so the demo does not
            // publish its copy of llms.txt (the real one is on venueatncc.org) or the unused _headers file.
            name: 'venue:demo-cleanup',
            hooks: {
              /** @param {{ dir: URL }} options */
              'astro:build:done': async ({ dir }) => {
                await Promise.all(['llms.txt', '_headers'].map((f) => rm(new URL(f, dir), { force: true })));
              },
            },
          },
          // GitHub Pages cannot redirect, so moved pages get a small redirect page each (scripts/demo-redirects.mjs).
          demoRedirects({ moved: MOVED_PAGES, base: demoBase, site: demoSite }),
        ]
      : [
          // Google ignores changefreq and priority, so they are not set. lastmod is set only when it is real.
          sitemap({
            filter: (page) => !page.includes('/404') && !page.includes('/admin'),
            serialize(item) {
              const lastmod = lastCommitDate(item.url);
              if (lastmod) item.lastmod = lastmod;
              return item;
            },
          }),
        ]),
  ],
  vite: {
    plugins: [
      {
        // Outside the demo build, src/lib/api/index.ts gets a stub for ./demo. The demo backend imports
        // the internal rate card, and a static edge from every island to it would ship the card in a
        // shared public chunk. With the stub, only the admin bundle carries it.
        name: 'venue:demo-off',
        enforce: 'pre',
        resolveId(source, importer) {
          if (isDemo || source !== './demo' || !importer) return null;
          if (!/[\\/]src[\\/]lib[\\/]api[\\/]index\.ts$/.test(importer)) return null;
          return fileURLToPath(new URL('./src/lib/api/demo-off.ts', import.meta.url));
        },
      },
      {
        // With trailingSlash 'always', Astro's dev server would answer /api/* with its 404 page
        // before Vite's proxy runs. Move the proxy middleware to the front of the stack.
        name: 'venue:api-proxy-first',
        configureServer(server) {
          return () => {
            const stack = server.middlewares.stack;
            const i = stack.findIndex((layer) => /** @type {{ name?: string }} */ (/** @type {unknown} */ (layer.handle))?.name === 'viteProxyMiddleware');
            if (i > 0) stack.unshift(...stack.splice(i, 1));
          };
        },
      },
    ],
    server: {
      // In development the API server runs separately (npm run dev starts both).
      proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
      watch: { ignored: ['**/data/**', '**/.tmp/**'] },
    },
  },
});
