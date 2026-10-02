/**
 * What each share card (/og/<key>.jpg) shows: a photo, the page title, and one short line. Kept apart from
 * the renderer so pages can describe the same card in og:image:alt (BaseLayout.astro). The underscore keeps
 * Astro from routing this file.
 *
 * The home card is the one exception to the photo rule (brand.md, Photography): a still life of pink and
 * white roses (share-rose-bouquet.jpg, generated, see design-archive/generated-scenes/share-bouquet/), with
 * the welcome in a white panel over the plain blush wall to its left, set as the home page sets it. It shows no part of the property, so it
 * is not described as one and is not used in structured data (schema.ts).
 *
 * Every other card uses a real photograph of the property, chosen by pick(). A staged event photo is never a
 * share image, so pick() uses the real photo it was made from (realPhoto), and the hero photo when there is
 * none. pick() never returns a share still. Version 8 has five public pages and so five cards: the event
 * pages, the FAQ page, and their cards are gone.
 */
import { site } from '../../data/site';
import { events } from '../../data/events';
import { photoByName, eventPhoto, heroPhoto, realPhoto, type VenuePhoto } from '../../data/photos';

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
  /**
   * 'photo' (the default): a real photo full bleed, a near-solid White panel bottom left.
   * 'still': a light still life with plain space on its left; no scrim, a narrower White panel centred on
   * the left, clear of the subject.
   */
  layout?: 'photo' | 'still';
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

// Each page's card carries that page's H1, so the preview matches the page it opens; an event card carries the
// event's name. Keep them in step when a heading changes.
export const shareCards: Record<string, ShareCard> = {
  // The still life of roses, not a photo of the property (see above). The bouquet stands whole in the right
  // half; the panel sits on the plain wall to its left and never covers it.
  home: {
    title: `Welcome to ${site.name}`,
    line: `Event venue in ${site.address.city}, ${site.address.regionName}`,
    photo: {
      file: 'share-rose-bouquet.jpg',
      caption:
        'A hand-tied bouquet of blush, pink, and ivory roses tied with a white ribbon, on a blush table against a pale blush wall (illustrative still life).',
    },
    layout: 'still',
  },
  'the-space': { title: 'The Space', line: spacesLine, photo: byName('hall-windows') },
  pricing: {
    title: 'Rates & FAQ',
    line: 'Rates vary with the season and the day of the week. Call us for pricing',
    photo: byName('hall-fireplace'),
  },
  // The events index leads with the photo of the first event on the list.
  events: {
    title: 'Events we host',
    line: 'Celebrations, gatherings, and meetings, and the spaces that suit each one',
    photo: pick(eventPhoto(events[0]?.slug ?? '')),
  },
  book: { title: 'Check availability', line: 'Choose a date and a space, and send your request', photo: byName('approach-dusk') },
};
/** og:image:alt for a card: what the image shows, in reading order. */
export function shareCardAlt(key: string): string | undefined {
  const card = shareCards[key];
  if (!card) return undefined;
  const sentence = (s: string) => (/[.?]$/.test(s) ? s : `${s}.`);
  const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  // A still life is an image, not a photo of the venue.
  const label = card.layout === 'still' ? 'Image' : 'Photo';
  const photo = card.photo.caption ? ` ${label}: ${sentence(card.photo.caption)}` : '';
  // A title that already names the business (the home card's "Welcome to The Venue @ NCC") is not preceded by the name again.
  if (card.title.includes(site.name)) return `${card.title}, ${lowerFirst(sentence(card.line))}${photo}`;
  return `${site.name}. ${sentence(card.title)} ${sentence(card.line)}${photo}`;
}

/**
 * The pixel size of a card's file. Cards are 1200 x 630, except the still life: its bouquet is a 1024 x 572
 * generated image, and a 1200 x 630 card would draw it 1.17 times larger than its real detail (brand.md, "No
 * photo larger than its detail"). The still card is laid out at 1200 x 630 and written at 1024 x 538, the same
 * 1.91:1 shape, so the bouquet is shown at its own scale.
 */
export function shareCardSize(key: string): { width: number; height: number } {
  return shareCards[key]?.layout === 'still' ? { width: 1024, height: 538 } : { width: 1200, height: 630 };
}
