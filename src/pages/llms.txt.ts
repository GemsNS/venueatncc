/**
 * /llms.txt: a plain-text summary of the venue for AI assistants and answer engines.
 * Generated from the same data as the site so it never drifts.
 */
import type { APIRoute } from 'astro';
import { site, fullAddress } from '../data/site';
import { events } from '../data/events';
import { publishedFaqs } from '../data/faq';

export const GET: APIRoute = () => {
  const u = (path: string) => new URL(path, site.url).href;
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `- Address: ${fullAddress}`,
    `- Phone: ${site.contact.phone}`,
    ...(site.contact.email ? [`- Email: ${site.contact.email}`] : []),
    `- Operated by: ${site.parent.name} (${site.parent.url}), established in Suffolk in ${site.parent.foundingYear}`,
    `- Book or check a date: ${u('/book/')}`,
    '',
    '## Events',
    '',
    ...events.map((e) => `- [${e.name}](${u(`/events/${e.slug}/`)}): ${e.summary}`),
    '',
    '## Pages',
    '',
    `- [The space](${u('/the-space/')})`,
    `- [Questions and answers](${u('/faq/')})`,
    `- [About](${u('/about/')})`,
    '',
    '## Questions and answers',
    '',
    ...publishedFaqs.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
