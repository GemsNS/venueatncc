import type { APIRoute } from 'astro';
import { isDemo } from '../lib/env';
import { site } from '../data/site';

export const GET: APIRoute = () => {
  // The GitHub Pages demo must never compete with the real site in search.
  const body = isDemo
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : ['User-agent: *', 'Allow: /', 'Disallow: /admin/', 'Disallow: /api/', '', `Sitemap: ${site.url}/sitemap-index.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
