/**
 * Venue photos, under one rule (docs/design/brand.md, "Photography"):
 *
 *   Real photographs show the spaces. The home hero, the space cards, The Space, the arrival band, share
 *   images, and structured data use real photos only.
 *   Staged photographs show events. Every event tile and event page hero uses a staged image of that event,
 *   all eight in one décor style, or none of them do (eventsStaged, below). While any staged image is
 *   missing, each event page hero shows the real photo its staged image is made from, with no badge or
 *   caption, and event tiles show no photo at all (EventIndex): eight events cannot map to eight different
 *   real photos, and no image may appear twice on a page. There are no toggles between the two.
 *
 * FILES IN src/assets/venue/ (every file there is published on the site)
 *   <name>.jpg                   3:2 landscape, 2400px wide. One entry in `photos`. The home hero,
 *                                grove-pines.jpg, is the exception: nearly the original's full width (3500px after
 *                                leveling the original by 2.5 degrees, for full-bleed screens) at its own ratio,
 *                                which the hero's frames are fitted to.
 *   <name>-tall.jpg              4:5 portrait, 1600px wide (grove-pines-tall.jpg is 7:10). Attached to
 *                                <name>.jpg as `tall` for art direction on phones. Never listed on its own.
 *   styled-event-<slug>.jpg      The staged photo of one event (virtual staging: furniture, linens, florals,
 *                                and lighting added; architecture, fixtures, and trees unchanged). Its
 *                                photoDetails entry names the real photo it was made from (styledOf) and the
 *                                event (event). Shown only through eventPhoto(), always with its badge.
 *
 * Describe each photo in `photoDetails`: precise, factual alt text that says only what the photo shows,
 * a short caption, tags, and the part of the property it shows. The build warns about files with no entry,
 * real photos listed with no file, and files smaller than 1600px on the long edge.
 *
 * Helpers: photoByName('hall-windows'), photosFor('hall'), photosFor('main'), heroPhoto(), eventPhoto('weddings'), realPhoto(p).
 */
import type { ImageMetadata } from 'astro';
import { eventTypes } from './event-types';

/** Which part of the property a photo shows: The Hall, The Main Hall, The Grove, or the grounds. */
export type PhotoSpace = 'hall' | 'main' | 'grove' | 'grounds';

export interface PhotoDetail {
  /** What the photo shows, for someone who cannot see it. Only what is visible; no claimed features. */
  alt: string;
  /** A short caption, shown only where a page asks for one. */
  caption?: string;
  tags?: string[];
  space?: PhotoSpace;
  /** CSS object-position for frames whose ratio differs from the file, e.g. 'center 70%'. Defaults to 'center'. */
  crop?: string;
  /** For a staged photo only: the file name of the real photo it was made from, e.g. 'hall-windows.jpg'. */
  styledOf?: string;
  /** For a staged photo only: the event it shows, e.g. 'weddings'. */
  event?: string;
}

export interface VenuePhoto {
  /** File name, e.g. 'hall-windows.jpg'. */
  file: string;
  /** File name without its extension, e.g. 'hall-windows'. */
  name: string;
  src: ImageMetadata;
  /** The 4:5 portrait version for phones, when <name>-tall.<ext> exists. */
  tall?: ImageMetadata;
  alt: string;
  caption?: string;
  tags: string[];
  space?: PhotoSpace;
  crop?: string;
  /** Set on a staged photo: the file name of the real photo it was made from. */
  styledOf?: string;
}

/** The one line beside the event tiles, on the home page and /events/, while the event photos are staged. */
export const EVENTS_STYLED_NOTE = 'Event photos show our spaces styled for each occasion. Décor is not included.';
/** The caption under a staged event page hero. Every staged photo carries it. */
export const STYLED_CAPTION = 'Styled concept. Décor is not included.';
const STYLED_ALT_PREFIX = 'Styled concept:';

export const photoDetails: Record<string, PhotoDetail> = {
  'exterior-dusk.jpg': {
    alt: 'The venue building at dusk: tan stucco walls, a lit covered entry, arched windows, and a white cross on the front gable, with tall pines behind',
    caption: 'The building at blue hour',
    tags: ['exterior'],
    space: 'grounds',
  },
  'hall-windows.jpg': {
    alt: 'The Hall: an open room with dark wood-look floors, arched windows along the far wall, a dark fireplace feature wall on the right, double doors on the left, and recessed ceiling lights',
    caption: 'The Hall, with its arched windows and fireplace wall',
    tags: ['indoor', 'space'],
    space: 'hall',
  },
  'hall-fireplace.jpg': {
    alt: 'The Hall toward its arched windows, with the dark fireplace feature wall on the right, double doors on the left, and a wide expanse of dark wood-look floor',
    caption: 'The open floor and the fireplace wall',
    tags: ['indoor'],
    space: 'hall',
  },
  'hall-doors.jpg': {
    alt: 'The Hall toward its white double doors, with a large wall-mounted screen on the left, two arched windows, and recessed ceiling lights',
    caption: 'The double doors and arched windows',
    tags: ['indoor'],
    space: 'hall',
  },
  // The Main Hall, from the owner's photos (IMG_4937 and IMG_4940), leveled and lightly graded.
  'main-hall.jpg': {
    alt: 'The Main Hall: rows of red upholstered chairs on a wood-look floor, facing a raised stage under a vaulted ceiling with recessed lights',
    caption: 'The Main Hall, with stage seating',
    tags: ['indoor', 'space', 'stage'],
    space: 'main',
  },
  'main-hall-stage.jpg': {
    alt: 'The raised stage at the front of The Main Hall, with steps up from the floor, a large wall-mounted screen, and rows of red upholstered chairs in front',
    caption: 'The raised stage',
    tags: ['indoor', 'stage'],
    space: 'main',
  },
  'grove-tables.jpg': {
    alt: 'The Grove: rows of wooden picnic tables on a patio in front of a timber gazebo, under tall pines',
    caption: 'Picnic tables and the gazebo',
    tags: ['outdoor', 'space'],
    space: 'grove',
  },
  'gazebo.jpg': {
    alt: 'The timber gazebo in The Grove, with a dark metal roof and wooden railings, in front of tall trees',
    caption: 'The gazebo',
    tags: ['outdoor'],
    space: 'grove',
  },
  'grove-path.jpg': {
    alt: 'A path through the trees in The Grove, leading past lawn and picnic tables to the timber gazebo',
    caption: 'The path to the gazebo',
    tags: ['outdoor'],
    space: 'grove',
  },
  'approach-dusk.jpg': {
    alt: 'A long paved drive curving past a mown lawn toward the venue building at dusk, with a wall of tall pines behind',
    caption: 'The drive at dusk',
    tags: ['arrival', 'parking'],
    space: 'grounds',
  },
  'driveway.jpg': {
    alt: 'A wide paved drive and parking lot in daylight, with landscaped islands and lawn on both sides, leading to the venue building among tall trees',
    caption: 'On-site parking on the paved lot',
    tags: ['parking'],
    space: 'grounds',
  },
  // The home hero, and so the venue's photo in structured data (heroPhoto). It is another crop of the
  // grove-path original, so it has no `space`: photosFor('grove') would put it beside grove-path in The Space.
  'grove-pines.jpg': {
    alt: 'Tall pines rising above the timber gazebo in The Grove, with picnic tables on a patio and a path across the lawn',
    caption: 'The gazebo under the pines',
    tags: ['hero', 'outdoor'],
  },

  // Staged event photos, one per event, in one décor style (brand.md). Registered ahead of their files:
  // until all eight are in src/assets/venue/, none is shown (eventsStaged). styledOf is also the real photo
  // each event page hero shows meanwhile.
  'styled-event-weddings.jpg': {
    alt: 'Styled concept: white chairs on the lawn facing the timber gazebo in The Grove, with a white aisle runner edged in pink and white rose petals and pink and white rose garlands and white drapes on the gazebo',
    styledOf: 'gazebo.jpg',
    event: 'weddings',
    space: 'grove',
  },
  'styled-event-receptions-banquets.jpg': {
    alt: 'Styled concept: The Hall set for a reception, with round tables in white linens, clear chairs, tall pink and white rose centerpieces, and a white aisle lined with pink roses leading to a sweetheart table under the arched windows',
    styledOf: 'hall-windows.jpg',
    event: 'receptions-banquets',
    space: 'hall',
  },
  'styled-event-baby-bridal-showers.jpg': {
    alt: 'Styled concept: The Hall set for a shower, with round tables in white linens, tall pink and white floral centerpieces, and a dessert table with a pink tiered cake under a floral garland on the fireplace mantel',
    styledOf: 'hall-fireplace.jpg',
    event: 'baby-bridal-showers',
    space: 'hall',
  },
  'styled-event-birthday-parties.jpg': {
    alt: 'Styled concept: The Hall set for a milestone dinner, with a long table in white linen, a runner of pink and white roses and peonies, taper candles, and a pink tiered cake by the fireplace wall',
    styledOf: 'hall-windows.jpg',
    event: 'birthday-parties',
    space: 'hall',
  },
  'styled-event-repasts-memorials.jpg': {
    alt: 'Styled concept: The Hall set for a repast, with round tables in white linens, soft pink and white rose centerpieces with candles, and a guest book table by the double doors',
    styledOf: 'hall-doors.jpg',
    event: 'repasts-memorials',
    space: 'hall',
  },
  'styled-event-meetings-trainings.jpg': {
    alt: 'Styled concept: The Hall set for a workshop, with rows of tables in white linens in the middle of the room facing the wall-mounted screen, and pink and white rose centerpieces',
    styledOf: 'hall-doors.jpg',
    event: 'meetings-trainings',
    space: 'hall',
  },
  'styled-event-graduations-reunions.jpg': {
    alt: 'Styled concept: the picnic tables in The Grove dressed in white with bright pink runners, lanterns, and jars of pink and white roses, with rose garlands on the gazebo and string lights above',
    styledOf: 'grove-tables.jpg',
    event: 'graduations-reunions',
    space: 'grove',
  },
  'styled-event-community-events.jpg': {
    alt: 'Styled concept: a community gathering in The Grove, with picnic tables in white and pink, rows of white chairs on the lawn, a welcome table with pink and white roses, and rose garlands on the gazebo',
    styledOf: 'grove-path.jpg',
    event: 'community-events',
  },
  // An indoor ceremony option for the weddings page, requested by the owner (white and pink flowers, a white
  // runner): The Main Hall, staged.
  // Arrival styled for a wedding day, shown on the weddings page.
  'styled-driveway-petals.jpg': {
    alt: 'Styled concept: the drive to the venue lined on both edges with bright pink and white rose petals and clusters of roses, leading to the building among tall pines',
    styledOf: 'driveway.jpg',
    space: 'grounds',
  },
  'styled-wedding-indoor-ceremony.jpg': {
    alt: 'Styled concept: a wedding ceremony in The Main Hall, with a white aisle runner between the rows of red chairs, pink and white roses on every row end, and a pink and white floral backdrop and arch on the stage',
    styledOf: 'main-hall.jpg',
    space: 'main',
  },
};

/** The staged photo of an event, by file stem. */
const stagedName = (slug: string) => `styled-event-${slug}`;
const EVENT_PHOTO_FALLBACK = 'hall-windows';
/**
 * The real photo of an event while the staged set is incomplete: the one its staged photo is made from
 * (styledOf above), so the event page hero and its share card show the room the staged photo will show.
 * An event with no staged entry gets hall-windows.
 */
const realEventPhotoName = (slug: string) => photoDetails[`${stagedName(slug)}.jpg`]?.styledOf ?? EVENT_PHOTO_FALLBACK;

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/venue/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true },
);

const GENERIC_ALT = 'The Venue @ NCC in Suffolk, Virginia';
const CAMERA_WORDS = new Set(['img', 'dsc', 'dscn', 'dscf', 'pxl', 'mvimg', 'photo', 'image', 'screenshot', 'dcim', 'whatsapp', 'edited', 'copy', 'mp', 'portrait', 'night']);
const TALL_SUFFIX = '-tall';
const STYLED_PREFIX = 'styled-';

const stemOf = (file: string) => file.replace(/\.[a-z0-9]+$/i, '');

/** Alt text from a descriptive filename; generic text when the name is a camera default. */
function altFromFilename(file: string): string {
  const words = stemOf(file)
    .split(/[^a-z]+/i)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 2 && !CAMERA_WORDS.has(w));
  if (words.length < 2) return GENERIC_ALT;
  const base = words.join(' ');
  return `${base.charAt(0).toUpperCase() + base.slice(1)} at The Venue @ NCC in Suffolk, Virginia`;
}

const files = Object.entries(modules).map(([path, mod]) => ({ file: path.split('/').pop() as string, src: mod.default }));

// Portrait versions, keyed by the stem of the photo they belong to.
const tallByStem = new Map<string, ImageMetadata>();
for (const f of files) {
  const stem = stemOf(f.file);
  if (stem.endsWith(TALL_SUFFIX)) tallByStem.set(stem.slice(0, -TALL_SUFFIX.length), f.src);
}

function toPhoto(file: string, src: ImageMetadata): VenuePhoto {
  const name = stemOf(file);
  const detail = photoDetails[file];
  const styledOf = detail?.styledOf;
  let alt = detail?.alt ?? altFromFilename(file);
  if (styledOf && !alt.startsWith(STYLED_ALT_PREFIX)) {
    console.warn(`[photos] ${file} is a staged photo, so its alt text must start with "${STYLED_ALT_PREFIX}". Added it.`);
    alt = `${STYLED_ALT_PREFIX} ${alt.charAt(0).toLowerCase()}${alt.slice(1)}`;
  }
  return {
    file,
    name,
    src,
    tall: tallByStem.get(name),
    alt,
    caption: styledOf ? STYLED_CAPTION : detail?.caption,
    tags: detail?.tags ?? [],
    space: detail?.space,
    crop: detail?.crop,
    styledOf,
  };
}

const detailOrder = Object.keys(photoDetails);
const byDetailOrder = (a: VenuePhoto, b: VenuePhoto) => {
  const ia = detailOrder.indexOf(a.file);
  const ib = detailOrder.indexOf(b.file);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  return a.file.localeCompare(b.file);
};

const all = files.filter((f) => !stemOf(f.file).endsWith(TALL_SUFFIX)).map((f) => toPhoto(f.file, f.src));
const staged = all.filter((p) => p.name.startsWith(STYLED_PREFIX) || p.styledOf !== undefined).sort(byDetailOrder);

/** The real photographs, in photoDetails order. Tall versions are attached; staged photos are never listed. */
export const photos: VenuePhoto[] = all.filter((p) => !staged.includes(p)).sort(byDetailOrder);

for (const s of staged) {
  if (!s.styledOf) {
    console.warn(`[photos] ${s.file} looks like a staged photo but has no styledOf in photoDetails, so it is not shown. Add styledOf: '<base>.jpg'.`);
  } else if (!photos.some((p) => p.file === s.styledOf)) {
    console.warn(`[photos] ${s.file} is a staged photo of ${s.styledOf}, but that photo is not in src/assets/venue/.`);
  }
}

for (const p of [...photos, ...staged]) {
  if (Math.max(p.src.width, p.src.height) < 1600) {
    console.warn(`[photos] ${p.file} is ${p.src.width}x${p.src.height}. Use an original at least 1600px on the long edge or it will look soft.`);
  }
  if (!photoDetails[p.file]) {
    console.warn(`[photos] ${p.file} has no entry in photoDetails, so its alt text is "${p.alt}". Add a description in src/data/photos.ts.`);
  }
}
for (const stem of tallByStem.keys()) {
  if (!all.some((p) => p.name === stem)) console.warn(`[photos] ${stem}${TALL_SUFFIX} has no matching ${stem} photo, so it is not shown.`);
}
// Staged entries are registered before their files exist, so only real photos are checked here.
for (const [file, detail] of Object.entries(photoDetails)) {
  if (!detail.event && !all.some((p) => p.file === file)) console.warn(`[photos] photoDetails lists ${file}, but no such file is in src/assets/venue/.`);
}
for (const e of eventTypes) {
  if (!photoDetails[`${stagedName(e.slug)}.jpg`]?.styledOf) {
    console.warn(`[photos] The event ${e.slug} has no ${stagedName(e.slug)}.jpg entry with styledOf in photoDetails, so its real photo falls back to ${EVENT_PHOTO_FALLBACK}.`);
  }
}

export const hasPhotos = photos.length > 0;

/** A photo by name, with or without its extension: photoByName('gazebo') or photoByName('gazebo.jpg'). */
export function photoByName(name: string): VenuePhoto | null {
  const stem = stemOf(name);
  return photos.find((p) => p.name === stem) ?? staged.find((p) => p.name === stem) ?? null;
}

/**
 * All or nothing: true only when every event type has its staged photo in src/assets/venue/. Then every
 * event tile and event page hero is staged, with its badge; otherwise event page heroes are real photos and
 * event tiles are text.
 */
export const eventsStaged = eventTypes.every((e) => staged.some((p) => p.name === stagedName(e.slug)));

{
  const present = eventTypes.filter((e) => staged.some((p) => p.name === stagedName(e.slug))).length;
  if (present > 0 && !eventsStaged) {
    console.info(`[photos] ${present} of ${eventTypes.length} staged event photos are in src/assets/venue/, so none is shown until the set is complete.`);
  }
}

/** The real photos of one part of the property, in photoDetails order. Never a staged photo. */
export function photosFor(space: PhotoSpace): VenuePhoto[] {
  return photos.filter((p) => p.space === space);
}

export function photosTagged(tag: string): VenuePhoto[] {
  return photos.filter((p) => p.tags.includes(tag));
}

/**
 * The hero photo: the first photo tagged 'hero' (grove-pines, the gazebo under the pines), else the first
 * photo, else null. It is the venue's image in structured data on every page and the fallback share image.
 */
export function heroPhoto(): VenuePhoto | null {
  return photosTagged('hero')[0] ?? photos[0] ?? null;
}

/**
 * The photo that leads an event page (and its tile, when staged): the staged photo of that event when the
 * whole set is staged (eventsStaged), otherwise the real photo it is made from. Use realPhoto() wherever
 * only a real photograph is allowed.
 */
export function eventPhoto(slug: string): VenuePhoto | null {
  const real = () => photoByName(realEventPhotoName(slug)) ?? photoByName(EVENT_PHOTO_FALLBACK);
  return (eventsStaged ? photoByName(stagedName(slug)) : null) ?? real();
}

/** The real photograph behind a photo: the photo itself, or for a staged photo the photo it was made from. */
export function realPhoto(photo: VenuePhoto | null): VenuePhoto | null {
  if (!photo || !photo.styledOf) return photo;
  return photos.find((p) => p.file === photo.styledOf) ?? null;
}
