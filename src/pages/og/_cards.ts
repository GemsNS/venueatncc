/**
 * The text on each share card (/og/<key>.png), kept apart from the renderer so pages can describe
 * the same card in og:image:alt (BaseLayout.astro). The underscore keeps Astro from routing this file.
 */
import { site } from '../../data/site';
import { events } from '../../data/events';
import { priceSummary, formatUSD } from '../../shared/pricing';

export interface ShareCard {
  kicker: string;
  title: string;
}

const indoor = site.spaces.find((s) => s.id === 'indoor');
const outdoor = site.spaces.find((s) => s.id === 'outdoor');

/** The fact pills along the bottom of every card. */
export const sharePills: string[] = [`Indoors up to ${indoor?.capacity}`, `Outdoors up to ${outdoor?.capacity}`, 'Parking included'];

const { fromHourly } = priceSummary();
export const shareCards: Record<string, ShareCard> = {
  home: { kicker: 'Event venue in Suffolk, Virginia', title: 'Unforgettable events await you.' },
  events: { kicker: 'Events', title: 'Every kind of event, one welcoming venue.' },
  'the-space': { kicker: 'The space', title: `A hall for ${indoor?.capacity}. The open air for ${outdoor?.capacity}.` },
  pricing: { kicker: 'Pricing', title: `Upfront rates from ${formatUSD(fromHourly)} an hour.` },
  book: { kicker: 'Check availability', title: 'Find your date.' },
  faq: { kicker: 'FAQ', title: 'Questions, answered.' },
  about: { kicker: 'About', title: 'A place for the moments people remember.' },
};
for (const e of events) shareCards[e.slug] = { kicker: e.name, title: e.h1 };

/** og:image:alt for a card: what the image shows, in reading order. */
export function shareCardAlt(key: string): string | undefined {
  const card = shareCards[key];
  if (!card) return undefined;
  const pills = sharePills.map((p, i) => (i === 0 ? p : p.charAt(0).toLowerCase() + p.slice(1))).join(', ');
  return `${site.name}. ${card.kicker}: ${card.title} ${pills}.`;
}
