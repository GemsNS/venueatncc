/**
 * /llms.txt: a plain-text summary of the venue for AI assistants and answer engines.
 * Generated from the same data as the site so it never drifts. Written in the brand voice of
 * docs/design/brand.md: first person plural, brief and precise. It never mentions alcohol or catering, so
 * the one catering FAQ stays on /faq/ only.
 * The demo build does not publish this file (astro.config.mjs); the real one lives on venueatncc.org.
 */
import type { APIRoute } from 'astro';
import { site, fullAddress } from '../data/site';
import { events } from '../data/events';
import { publishedFaqs } from '../data/faq';
import { mentionsCatering, offBrandPhrase, spaceName } from '../lib/schema';
import { pricing, priceSummary, formatUSD, type DayType } from '../shared/pricing';
import { todayKey } from '../shared/dates';
import type { SpaceChoice } from '../shared/types';

/** Leaves out an FAQ or event whose copy the brand keeps out of public text, with a build warning. */
function onBrand<T>(items: T[], text: (item: T) => string, label: (item: T) => string): T[] {
  return items.filter((item) => {
    const phrase = offBrandPhrase(text(item));
    if (phrase) console.warn(`[llms.txt] Left out "${label(item)}" because it says "${phrase}". Rewrite it to follow docs/design/brand.md.`);
    return !phrase;
  });
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const andList = (items: string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;

export const GET: APIRoute = () => {
  const u = (path: string) => new URL(path, site.url).href;
  const { fromHourly } = priceSummary();
  const offer = pricing.introOffer && pricing.introOffer.percent > 0 && todayKey() <= pricing.introOffer.validUntil ? pricing.introOffer : null;
  const days = Object.keys(pricing.dayTypes) as DayType[];
  const spaces = Object.keys(pricing.hourly) as SpaceChoice[];
  const minHours = Math.min(...Object.values(pricing.minimumHours));
  const balanceDays = pricing.bookingDeposit.balanceDueDaysBefore;
  const deposit =
    pricing.bookingDeposit.type === 'percent' ? `${pricing.bookingDeposit.value}% of the total` : formatUSD(pricing.bookingDeposit.value);
  const specialRates = pricing.discounts.filter((d) => d.percent > 0);
  const eventList = onBrand(events, (e) => `${e.name} ${e.summary}`, (e) => e.name);
  const faqs = onBrand(publishedFaqs, (f) => `${f.q} ${f.a}`, (f) => f.q).filter((f) => !mentionsCatering(`${f.q} ${f.a}`));

  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `${site.name} is operated by ${site.parent.name}. We rent two distinct spaces by the hour in a wooded setting minutes from downtown ${site.address.city}, and we confirm every booking personally.`,
    '',
    '## The spaces',
    '',
    ...site.spaces.map((s) => `- ${s.name}: ${s.description} Up to ${s.capacity} guests.`),
    `- ${spaceName('both')}: request both for one event, and we confirm availability for each.`,
    `- Every rental includes ${andList(site.included.map(lowerFirst))}.`,
    '',
    '## Rates',
    '',
    `- From ${formatUSD(fromHourly)} per hour, with minimums from ${minHours} hours. Full rate card and an instant estimate: ${u('/pricing/')}`,
    ...spaces.map(
      (s) => `- ${spaceName(s)}: ${days.map((d) => `${pricing.dayTypes[d].label} ${formatUSD(pricing.hourly[s][d])}`).join(', ')} per hour`,
    ),
    `- Minimum hours: ${days.map((d) => `${pricing.dayTypes[d].label} ${pricing.minimumHours[d]}`).join(', ')}`,
    ...(pricing.fees.cleaning > 0 ? [`- Cleaning fee: ${formatUSD(pricing.fees.cleaning)} per event, on every booking`] : []),
    ...(pricing.fees.damageDepositRefundable > 0
      ? [`- Refundable damage deposit: ${formatUSD(pricing.fees.damageDepositRefundable)}, returned after the event if there is no damage`]
      : []),
    ...(offer
      ? [`- ${offer.name}: ${offer.percent}% off the rental ${offer.terms}. Discounts do not combine; the estimate uses the best one that applies.`]
      : []),
    '',
    ...(pricing.packages.length > 0
      ? ['## Packages', '', ...pricing.packages.map((p) => `- ${p.name}: ${formatUSD(p.price)} for ${p.hours} hours`), '']
      : []),
    ...(specialRates.length > 0
      ? [
          '## Special rates',
          '',
          ...specialRates.map(
            (d) => `- ${d.label}: ${d.percent}% off the rental, ${d.appliesTo === 'manual' ? 'mention it in your request' : 'applied automatically'}`,
          ),
          '- Discounts do not combine; the estimate uses the best one that applies.',
          '',
        ]
      : []),
    '## Booking',
    '',
    `- Booking is open to the public. Membership in ${site.parent.name} is not required.`,
    `- How it works: choose a date and a space, send a request, and we confirm availability. The booking deposit of ${deposit} then reserves the date.`,
    ...(balanceDays > 0
      ? [`- Balance: due ${balanceDays} days before the event. For an event within ${balanceDays} days, the full amount is due when you reserve.`]
      : []),
    `- Visits: ask for a visit when you send your request, or call ${site.contact.phone}.`,
    `- Check availability and request a date: ${u('/book/')}`,
    '',
    '## Contact and location',
    '',
    `- Address: ${fullAddress}`,
    `- Directions: ${site.address.directionsUrl}`,
    `- Phone: ${site.contact.phone}`,
    `- Email: ${site.contact.email}`,
    `- Operator: ${site.parent.name}, ${site.parent.url}, part of the ${site.address.city} community since ${site.parent.foundingYear}`,
    '',
    '## Events we host',
    '',
    ...eventList.map((e) => `- [${e.name}](${u(`/events/${e.slug}/`)}): ${e.summary}`),
    '',
    '## Questions and answers',
    '',
    ...faqs.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
  ];

  const body = lines.join('\n');
  const stray = offBrandPhrase(body);
  if (stray) console.warn(`[llms.txt] The output still says "${stray}". Check the venue data against docs/design/brand.md.`);
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
