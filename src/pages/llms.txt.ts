/**
 * /llms.txt: a plain-text summary of the venue for AI assistants and answer engines.
 * Generated from the same data as the site so it never drifts.
 */
import type { APIRoute } from 'astro';
import { site, fullAddress } from '../data/site';
import { events } from '../data/events';
import { publishedFaqs } from '../data/faq';
import { pricing, priceSummary, formatUSD } from '../shared/pricing';

export const GET: APIRoute = () => {
  const u = (path: string) => new URL(path, site.url).href;
  const { fromHourly } = priceSummary();
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `- Address: ${fullAddress}`,
    `- Phone: ${site.contact.phone}`,
    `- Email: ${site.contact.email}`,
    ...site.spaces.map((s) => `- ${s.name}: up to ${s.capacity} guests`),
    '- Open to everyone: membership is not required',
    '- Alcohol: allowed',
    '- Catering: not included; hosts choose their own caterer or bring food',
    '- Parking: included with every booking',
    `- Rates: from ${formatUSD(fromHourly)} per hour; minimums from ${Math.min(...Object.values(pricing.minimumHours))} hours. Full rate card: ${u('/pricing/')}`,
    `- Check availability and request a date: ${u('/book/')}`,
    `- Operated by: ${site.parent.name} (${site.parent.url}), established in Suffolk in ${site.parent.foundingYear}`,
    '',
    '## Events',
    '',
    ...events.map((e) => `- [${e.name}](${u(`/events/${e.slug}/`)}): ${e.summary}`),
    '',
    '## Questions and answers',
    '',
    ...publishedFaqs.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
