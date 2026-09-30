/**
 * What each share card (/og/<key>.jpg) shows: a real photo of the property, the page title, and one short
 * line. Kept apart from the renderer so pages can describe the same card in og:image:alt (BaseLayout.astro).
 * The underscore keeps Astro from routing this file.
 *
 * Only real photographs (brand.md, Photography). A staged event photo is never a share image, so pick() uses
 * the real photo it was made from (realPhoto), and the hero photo when there is none. An event card therefore
 * shows the real base of its staged hero, or the page's own real hero while the event photos are not staged.
 */
import { site } from '../../data/site';
import { events } from '../../data/events';
import { photoByName, eventPhoto, heroPhoto, realPhoto, type VenuePhoto } from '../../data/photos';
import { offBrandPhrase } from '../../lib/schema';

export interface ShareCard {
  /** The page title, set in Libre Caslon Display. Sentence case. */
  title: string;
  /** One short line under the title, set in Libre Caslon Text. No trailing period. */
  line: string;
  /**
   * The photo behind the text: a file in src/assets/venue/ and its caption. `region` crops the file first,
   * as fractions of its width and height, before it is fitted to the card.
   */
  photo: { file: string; caption?: string; region?: { left: number; top: number; width: number; height: number } };
}

function pick(photo: VenuePhoto | null): ShareCard['photo'] {
  const real = realPhoto(photo) ?? heroPhoto();
  if (!real) throw new Error('[og] No venue photo is available for the share cards. Add photos to src/assets/venue/.');
  return { file: real.file, caption: real.caption };
}

const byName = (name: string) => pick(photoByName(name));
const capacity = (id: 'indoor' | 'main' | 'outdoor') => site.spaces.find((s) => s.id === id)?.capacity;
const hall = site.spaces.find((s) => s.id === 'indoor')?.name ?? 'The Hall';
const mainHall = site.spaces.find((s) => s.id === 'main')?.name ?? 'The Main Hall';
const grove = site.spaces.find((s) => s.id === 'outdoor')?.name ?? 'The Grove';
const spacesLine = `${hall} and ${mainHall} up to ${capacity('indoor')} guests each, ${grove} up to ${capacity('outdoor')}`;
const withoutPeriod = (s: string) => s.trim().replace(/[.]+$/, '');

// Each page's card carries that page's H1, so the preview matches the page it opens; an event card carries the
// event's name. Keep them in step when a heading changes.
export const shareCards: Record<string, ShareCard> = {
  // The building at blue hour without its gable: the cross may appear in photos of the building, but never
  // beside the headline as a subject (brand.md, Separation). The left 80% keeps the lit entry and the pines.
  home: {
    title: `Welcome to ${site.name}`,
    line: `Event venue in ${site.address.city}, ${site.address.regionName}`,
    photo: { ...byName('exterior-dusk'), region: { left: 0, top: 0, width: 0.8, height: 1 } },
  },
  'the-space': { title: 'Three spaces, indoors and out', line: spacesLine, photo: byName('hall-windows') },
  pricing: {
    title: 'Rates and inquiries',
    line: 'Rates vary with the season and the day of the week. Call or send an inquiry for pricing',
    photo: byName('hall-fireplace'),
  },
  // The events index leads with the photo of the first event on the list.
  events: {
    title: `Weddings, celebrations, and gatherings in ${site.address.city}`,
    line: 'A planning guide and a checklist for each occasion',
    photo: pick(eventPhoto(events[0]?.slug ?? '')),
  },
  faq: { title: 'Frequently asked questions', line: 'Booking, the spaces, rates, and visits', photo: byName('grove-tables') },
  book: { title: 'Check availability', line: 'Choose a date and a space, and send your request', photo: byName('approach-dusk') },
};
// Each event card: its name and its one-line summary, or the capacities if the summary is off-brand.
for (const e of events) {
  const line = offBrandPhrase(e.summary) ? spacesLine : withoutPeriod(e.summary);
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
