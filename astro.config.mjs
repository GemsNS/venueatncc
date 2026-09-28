// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import fs from 'node:fs';
import { site } from './src/data/site.ts';

/**
 * Two targets, one codebase. Astro always builds a static site; interactivity lives in Preact islands.
 *
 *   npm run build        production: static site in dist/, served with the API by server/ (Node)
 *   npm run build:demo   GitHub Pages demo: PUBLIC_DEMO=true, base /venueatncc/, in-browser demo backend,
 *                        noindex everywhere, no sitemap
 */
const isDemo = process.env.PUBLIC_DEMO === 'true';
const demoBase = process.env.DEMO_BASE ?? '/venueatncc/';
const demoSite = process.env.DEMO_SITE ?? 'https://gemsns.github.io';

// /the-space/ is noindexed until it has photos (see src/pages/the-space.astro); mirror that here.
const venuePhotoCount = fs.existsSync('./src/assets/venue')
  ? fs.readdirSync('./src/assets/venue').filter((f) => /\.(jpe?g|png|webp|avif|JPE?G|PNG|WEBP|AVIF)$/.test(f)).length
  : 0;

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
      ? []
      : [
          sitemap({
            filter: (page) =>
              !page.includes('/404') && !page.includes('/admin') && (venuePhotoCount > 0 || !page.endsWith('/the-space/')),
            changefreq: 'monthly',
            priority: 0.7,
            serialize(item) {
              if (item.url === `${site.url}/`) item.priority = 1.0;
              if (item.url.endsWith('/book/') || item.url.endsWith('/pricing/')) item.priority = 0.9;
              return item;
            },
          }),
        ]),
  ],
  vite: {
    server: {
      // In development the API server runs separately (npm run dev starts both).
      proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
    },
  },
});
