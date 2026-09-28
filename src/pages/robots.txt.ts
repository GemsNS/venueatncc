import type { APIRoute } from 'astro';
import { isDemo } from '../lib/env';
import { site } from '../data/site';

export const GET: APIRoute = () => {
  // The GitHub Pages demo must never compete with the real site in search. On a Pages project site
  // this file is informational only: crawlers read robots.txt at the origin root, never under
  // /venueatncc/. The demo's real protection is the noindex meta tag on every page (BaseLayout),
  // which works because crawling is allowed. The demo build also drops llms.txt (astro.config.mjs).
  const body = isDemo
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : ['User-agent: *', 'Allow: /', 'Disallow: /admin/', 'Disallow: /api/', '', `Sitemap: ${site.url}/sitemap-index.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
