/**
 * /llms.txt: a plain-text summary of the venue for AI assistants and answer engines.
 * Generated from the same data as the site so it never drifts.
 */
import type { APIRoute } from 'astro';
import { site, fullAddress } from '../data/site';
import { events } from '../data/events';
import { publishedFaqs } from '../data/faq';
import { pricing, priceSummary, formatUSD, type DayType } from '../shared/pricing';
import { todayKey } from '../shared/dates';
import type { SpaceChoice } from '../shared/types';

export const GET: APIRoute = () => {
  const u = (path: string) => new URL(path, site.url).href;
  const { fromHourly } = priceSummary();
  const offer = pricing.introOffer && pricing.introOffer.percent > 0 && todayKey() <= pricing.introOffer.validUntil ? pricing.introOffer : null;
  const days = Object.keys(pricing.dayTypes) as DayType[];
  const spaces = Object.keys(pricing.hourly) as SpaceChoice[];
  const balanceDays = pricing.bookingDeposit.balanceDueDaysBefore;
  const depositShare =
    pricing.bookingDeposit.type === 'percent' ? `${pricing.bookingDeposit.value}% of the total` : formatUSD(pricing.bookingDeposit.value);
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
    '- Alcohol: allowed; Virginia ABC may require a banquet license',
    '- Catering: not included; hosts choose their own caterer or bring food',
    '- Parking: included with every booking',
    `- Rates: from ${formatUSD(fromHourly)} per hour; minimums from ${Math.min(...Object.values(pricing.minimumHours))} hours. Full rate card: ${u('/pricing/')}`,
    ...(pricing.fees.cleaning > 0 ? [`- Cleaning fee: ${formatUSD(pricing.fees.cleaning)} per event, on every booking`] : []),
    `- Reserving: send a request, we confirm availability, then the booking deposit (${depositShare}) reserves the date`,
    ...(balanceDays > 0
      ? [`- Balance: due ${balanceDays} days before the event; for an event within ${balanceDays} days, the full amount is due when you reserve`]
      : []),
    ...(pricing.fees.damageDepositRefundable > 0
      ? [`- Refundable damage deposit: ${formatUSD(pricing.fees.damageDepositRefundable)}, returned after the event if there is no damage`]
      : []),
    ...(offer ? [`- ${offer.label}. Discounts do not combine; the estimate uses the best one that applies.`] : []),
    `- Check availability and request a date: ${u('/book/')}`,
    `- Operated by: ${site.parent.name} (${site.parent.url}), established in Suffolk in ${site.parent.foundingYear}`,
    '',
    '## Hourly rates',
    '',
    ...spaces.map(
      (s) => `- ${pricing.spaces[s].label}: ${days.map((d) => `${pricing.dayTypes[d].label} ${formatUSD(pricing.hourly[s][d])}`).join(', ')} per hour`,
    ),
    `- Minimum hours: ${days.map((d) => `${pricing.dayTypes[d].label} ${pricing.minimumHours[d]}`).join(', ')}`,
    '',
    ...(pricing.packages.length > 0
      ? ['## Packages', '', ...pricing.packages.map((p) => `- ${p.name}: ${formatUSD(p.price)} for ${p.hours} hours`), '']
      : []),
    ...(pricing.discounts.some((d) => d.percent > 0)
      ? [
          '## Special rates',
          '',
          ...pricing.discounts
            .filter((d) => d.percent > 0)
            .map((d) => `- ${d.label}: ${d.percent}% off the rental, ${d.appliesTo === 'manual' ? 'mention it in your request' : 'applied automatically'}`),
          '- Discounts do not combine; the estimate uses the best one that applies.',
          '',
        ]
      : []),
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
