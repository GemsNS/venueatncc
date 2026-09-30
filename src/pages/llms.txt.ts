/**
 * /llms.txt: a plain-text summary of the venue for AI assistants and answer engines.
 * Generated from the same data as the site so it never drifts. Written in the brand voice of
 * docs/design/brand.md: first person plural, brief and precise. It never mentions alcohol or catering, so
 * the one catering FAQ stays on /faq/ only. Each fact is stated once: the questions and answers section
 * carries only FAQs whose answers the sections above do not already give (COVERED_QUESTIONS).
 * The demo build does not publish this file (astro.config.mjs); the real one lives on venueatncc.org.
 */
import type { APIRoute } from 'astro';
import { site, fullAddress } from '../data/site';
import { events } from '../data/events';
import { publishedFaqs, RATES_WORDING } from '../data/faq';
import { mentionsCatering, offBrandPhrase, spaceName } from '../lib/schema';
import { OPEN_DAY_TYPES, dayTypes, minimumHours } from '../shared/booking-rules';

/**
 * Minimum hours are a booking rule, not a price, so they are stated, for the days the building is open
 * (never Sunday). The venue publishes no prices.
 */
const DAY_TYPES = OPEN_DAY_TYPES;

/** Leaves out an FAQ or event whose copy the brand keeps out of public text, with a build warning. */
function onBrand<T>(items: T[], text: (item: T) => string, label: (item: T) => string): T[] {
  return items.filter((item) => {
    const phrase = offBrandPhrase(text(item));
    if (phrase) console.warn(`[llms.txt] Left out "${label(item)}" because it says "${phrase}". Rewrite it to follow docs/design/brand.md.`);
    return !phrase;
  });
}

/**
 * Published FAQs, word for word, whose answers the sections of this file already state (brand.md, Redundancy
 * rules). They stay on /faq/ and in its structured data. A question reworded in src/data/faq.ts no longer
 * matches and appears under questions and answers again, which repeats a fact but never drops one.
 */
const COVERED_QUESTIONS = new Set([
  'How do I check if my date is available?', // Booking
  'Who can book the venue?', // Booking
  'Can I see the venue before I book?', // Booking
  'How many guests can the venue hold?', // The spaces
  `Can I book ${spaceName('both')} together?`, // The spaces
  'Is parking included?', // The spaces
  'What is included in the rental?', // The spaces and Rates
  'How much does it cost to rent the venue?', // Rates
  'How do deposits and payments work?', // Rates and Booking
  'What days and hours can I book?', // Booking
  `Where is ${site.name}?`, // Contact and location
  'What kinds of events can I host?', // Events we host
]);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const andList = (items: string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;

export const GET: APIRoute = () => {
  const u = (path: string) => new URL(path, site.url).href;
  const eventList = onBrand(events, (e) => `${e.name} ${e.summary}`, (e) => e.name);
  const faqs = onBrand(publishedFaqs, (f) => `${f.q} ${f.a}`, (f) => f.q).filter(
    (f) => !mentionsCatering(`${f.q} ${f.a}`) && !COVERED_QUESTIONS.has(f.q),
  );

  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `We rent three distinct spaces by the hour on fully renovated grounds on Godwin Boulevard in north ${site.address.city}, for weddings, receptions, conferences, banquets, memorials, and community gatherings, and we confirm every booking personally.`,
    '',
    '## The spaces',
    '',
    ...site.spaces.map((s) => `- ${s.name}: ${s.description} Up to ${s.capacity} guests.`),
    `- ${spaceName('both')}: request both for one event, and we confirm availability for each.`,
    `- Every rental includes ${andList(site.included.map(lowerFirst))}.`,
    '',
    '## Amenities',
    '',
    ...site.amenities.map((a) => `- ${a.name}: ${a.detail}`),
    '',
    '## Rates',
    '',
    `- ${RATES_WORDING}`,
    `- Deposits: ${site.depositPolicy}`,
    `- Ask about rates for your date: ${u('/pricing/')}`,
    `- Minimum hours: ${DAY_TYPES.map((d) => `${dayTypes[d].label} ${minimumHours[d]}`).join(', ')}`,
    '',
    '## Booking',
    '',
    '- Booking is open to the public.',
    `- Hours of operation: building access ${site.access.days}, ${site.access.hours}. Closed on Sundays.`,
    '- How it works: choose a date and a space and send a request. We confirm availability and send your quote personally, with the payment terms for your date.',
    '- Visits: ask for a personal tour when you send your request, or call us.',
    `- Check availability and request a date: ${u('/book/')}`,
    '',
    '## Contact and location',
    '',
    `- Contact: ${site.contact.contactName}`,
    `- Address: ${fullAddress}`,
    `- Directions: ${site.address.directionsUrl}`,
    `- Phone: ${site.contact.phone}`,
    `- Email: ${site.contact.email}`,
    '',
    '## Events we host',
    '',
    ...eventList.map((e) => `- [${e.name}](${u(`/events/${e.slug}/`)}): ${e.summary}`),
    '- Another kind of event: describe it in your request, and we will confirm which space suits it.',
    '',
    ...(faqs.length > 0 ? ['## Questions and answers', '', ...faqs.flatMap((f) => [`### ${f.q}`, '', f.a, ''])] : []),
  ];

  const body = lines.join('\n');
  const stray = offBrandPhrase(body);
  if (stray) console.warn(`[llms.txt] The output still says "${stray}". Check the venue data against docs/design/brand.md.`);
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
