/**
 * What each share card (/og/<key>.png) shows: a real photo of the property, the page title, and one short
 * line. Kept apart from the renderer so pages can describe the same card in og:image:alt (BaseLayout.astro).
 * The underscore keeps Astro from routing this file.
 *
 * Only real photographs. A styled concept is never a share image, so pick() falls back to the hero photo.
 */
import { site } from '../../data/site';
import { events } from '../../data/events';
import { photoByName, eventPhoto, heroPhoto, type VenuePhoto } from '../../data/photos';
import { priceSummary, formatUSD } from '../../shared/pricing';
import { offBrandPhrase } from '../../lib/schema';

export interface ShareCard {
  /** The page title, set in Libre Caslon Display. Sentence case. */
  title: string;
  /** One short line under the title, set in Inter. No trailing period. */
  line: string;
  /** The photo behind the text: a file in src/assets/venue/ and its caption. */
  photo: { file: string; caption?: string };
}

function pick(photo: VenuePhoto | null): ShareCard['photo'] {
  const real = photo && !photo.styledOf ? photo : heroPhoto();
  if (!real) throw new Error('[og] No venue photo is available for the share cards. Add photos to src/assets/venue/.');
  return { file: real.file, caption: real.caption };
}

const byName = (name: string) => pick(photoByName(name));
const capacity = (id: 'indoor' | 'outdoor') => site.spaces.find((s) => s.id === id)?.capacity;
const hall = site.spaces.find((s) => s.id === 'indoor')?.name ?? 'The Hall';
const grove = site.spaces.find((s) => s.id === 'outdoor')?.name ?? 'The Grove';
const bothSpaces = `${hall} up to ${capacity('indoor')} guests, ${grove} up to ${capacity('outdoor')}`;
const withoutPeriod = (s: string) => s.trim().replace(/[.]+$/, '');

const { fromHourly } = priceSummary();

// Each page's card carries that page's H1, so the preview matches the page it opens. Keep them in step.
export const shareCards: Record<string, ShareCard> = {
  home: { title: 'Celebrate among the pines.', line: `Event venue in ${site.address.city}, ${site.address.regionName}`, photo: byName('exterior-dusk') },
  'the-space': { title: 'Two spaces, indoors and out.', line: bothSpaces, photo: byName('hall-windows') },
  pricing: {
    title: 'Transparent rates for every event.',
    line: `From ${formatUSD(fromHourly)} an hour, with an instant estimate for your date`,
    photo: byName('hall-fireplace'),
  },
  // The events index leads with the photo of the first event on the list.
  events: {
    title: `Weddings, celebrations, and gatherings in ${site.address.city}`,
    line: 'A planning guide and a checklist for each occasion',
    photo: pick(eventPhoto(events[0]?.slug ?? '')),
  },
  about: {
    title: `A venue of ${site.parent.name}.`,
    line: `Part of the ${site.address.city} community since ${site.parent.foundingYear}`,
    photo: byName('gable'),
  },
  faq: { title: 'Frequently asked questions.', line: 'Booking, the spaces, rates, and visits', photo: byName('grove-tables') },
  book: { title: 'Check availability.', line: 'Choose a date, see an instant estimate, and send a request', photo: byName('approach-dusk') },
};
// Each event card: its name and its one-line summary, or the capacities if the summary is off-brand.
for (const e of events) {
  const line = offBrandPhrase(e.summary) ? bothSpaces : withoutPeriod(e.summary);
  shareCards[e.slug] = { title: e.name, line, photo: pick(eventPhoto(e.slug)) };
}

/** og:image:alt for a card: what the image shows, in reading order. */
export function shareCardAlt(key: string): string | undefined {
  const card = shareCards[key];
  if (!card) return undefined;
  const sentence = (s: string) => (/[.?]$/.test(s) ? s : `${s}.`);
  const photo = card.photo.caption ? ` Photo: ${sentence(card.photo.caption)}` : '';
  return `${site.name}. ${sentence(card.title)} ${sentence(card.line)}${photo}`;
}
