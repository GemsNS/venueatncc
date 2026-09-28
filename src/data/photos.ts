/**
 * Venue photos: real photographs of the property, and nothing else.
 *
 * FILES IN src/assets/venue/ (every file there is published on the site)
 *   <name>.jpg                  3:2 landscape, 2400px wide. One entry in `photos`.
 *   <name>-tall.jpg             4:5 portrait, 1600px wide. Attached to <name>.jpg as `tall` for art
 *                               direction on phones. Never listed on its own.
 *   styled-<base>-<scene>.jpg   A styled concept of a real photo (virtual staging: furniture, linens,
 *                               florals and lighting added, architecture unchanged). Needs a photoDetails
 *                               entry with styledOf: '<base>.jpg'. Attached to that photo as `styled`.
 *                               Never listed on its own. It may illustrate an event tile or an event
 *                               page (always with its badge, and its caption on the event page), but it
 *                               is never the home hero, a share image, structured data, or the only
 *                               image of a space. realPhoto() gives the photo it was made from.
 *
 * Describe each photo in `photoDetails`: precise, factual alt text that says only what the photo shows,
 * a short caption, tags, and the space it belongs to. The build warns about files with no entry, entries
 * with no file, and files smaller than 1600px on the long edge.
 *
 * Helpers: photoByName('hall-windows'), photosFor('hall'), heroPhoto(), eventPhoto('weddings'), realPhoto(p).
 */
import type { ImageMetadata } from 'astro';

/** Which part of the property a photo shows. */
export type PhotoSpace = 'hall' | 'grove' | 'campus';

export interface PhotoDetail {
  /** What the photo shows, for someone who cannot see it. Only what is visible; no claimed features. */
  alt: string;
  /** A short caption, shown only where a page asks for one. */
  caption?: string;
  tags?: string[];
  space?: PhotoSpace;
  /** CSS object-position for frames whose ratio differs from the file, e.g. 'center 70%'. Defaults to 'center'. */
  crop?: string;
  /** For a styled concept only: the file name of the real photo it was made from, e.g. 'hall-windows.jpg'. */
  styledOf?: string;
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
  /** Set on a styled concept: the file name of the real photo it was made from. */
  styledOf?: string;
  /** Styled concepts of this photo, if any. Always empty on a styled concept itself. */
  styled: VenuePhoto[];
}

/** Every styled concept carries this caption, and its alt text starts with "Styled concept:". */
export const STYLED_CAPTION = 'Styled concept. Décor shown is not included with the rental.';
const STYLED_ALT_PREFIX = 'Styled concept:';

export const photoDetails: Record<string, PhotoDetail> = {
  'exterior-dusk.jpg': {
    alt: 'The venue building at dusk: tan stucco walls, a lit covered entry, arched windows, and a white cross on the front gable, with tall pines behind',
    caption: 'The building at blue hour',
    tags: ['hero', 'exterior'],
    space: 'campus',
  },
  'hall-windows.jpg': {
    alt: 'The Hall: an open room with dark wood-look floors, arched windows along the far wall, a dark fireplace feature wall on the right, double doors on the left, and recessed ceiling lights',
    caption: 'The Hall, with its arched windows and fireplace wall',
    tags: ['indoor', 'space'],
    space: 'hall',
  },
  'hall-fireplace.jpg': {
    alt: 'The Hall toward its arched windows, with the dark fireplace feature wall on the right, double doors on the left, and a wide expanse of dark wood-look floor',
    caption: 'The open floor of The Hall',
    tags: ['indoor'],
    space: 'hall',
  },
  'hall-doors.jpg': {
    alt: 'The Hall toward its white double doors, with a large wall-mounted screen on the left, two arched windows, and recessed ceiling lights',
    caption: 'The double doors in The Hall',
    tags: ['indoor'],
    space: 'hall',
  },
  'grove-tables.jpg': {
    alt: 'The Grove: rows of wooden picnic tables on a paved patio in front of a timber gazebo, under tall pines',
    caption: 'Picnic tables and the gazebo in The Grove',
    tags: ['outdoor', 'space'],
    space: 'grove',
  },
  'gazebo.jpg': {
    alt: 'The timber gazebo in The Grove, with a dark metal roof and wooden railings, in front of tall trees',
    caption: 'The gazebo in The Grove',
    tags: ['outdoor'],
    space: 'grove',
  },
  'grove-path.jpg': {
    alt: 'A paved path through the trees in The Grove, leading past lawn and picnic tables to the timber gazebo',
    caption: 'The path to the gazebo',
    tags: ['outdoor'],
    space: 'grove',
  },
  'approach-dusk.jpg': {
    alt: 'A long paved drive curving past a mown lawn toward the venue building at dusk, with a wall of tall pines behind',
    caption: 'The drive and lot at dusk',
    tags: ['arrival', 'parking'],
    space: 'campus',
  },
  'driveway.jpg': {
    alt: 'A wide paved drive and parking lot in daylight, with landscaped islands and lawn on both sides, leading to the venue building among tall trees',
    caption: 'On-site parking on the paved lot',
    tags: ['parking'],
    space: 'campus',
  },
  'gable.jpg': {
    alt: 'The stucco front gable with a tall white cross between two narrow arched windows of leaded glass, under a blue sky',
    caption: 'The front gable, with its white cross',
    tags: ['about', 'church'],
    space: 'campus',
  },
  // Styled concepts: generated from the real photo above them, with furniture, linens, flowers, and lighting added.
  'styled-hall-windows-reception.jpg': {
    alt: 'Styled concept: The Hall set for a reception, with round tables in white floor-length linens, gold chiavari chairs, white and lavender centerpieces, and a head table under the arched windows',
    styledOf: 'hall-windows.jpg',
    space: 'hall',
  },
  'styled-hall-fireplace-dinner.jpg': {
    alt: 'Styled concept: The Hall set for a milestone dinner, with two long banquet tables in white linens and lavender runners, white chairs, candles, and a cake table by the fireplace wall',
    styledOf: 'hall-fireplace.jpg',
    space: 'hall',
  },
  'styled-gazebo-ceremony.jpg': {
    alt: 'Styled concept: white ceremony chairs in two sections on the lawn facing the gazebo, with a white aisle runner and white and lavender flowers on the gazebo posts',
    styledOf: 'gazebo.jpg',
    space: 'grove',
  },
  'styled-grove-tables-reunion.jpg': {
    alt: 'Styled concept: the picnic tables in The Grove dressed in white linens with lavender runners, lanterns, and small flower jars, with string lights above the patio',
    styledOf: 'grove-tables.jpg',
    space: 'grove',
  },
};

/**
 * Which photo leads each event page and its tile. Every slug in src/data/events.ts is listed, each with a
 * different image; any other slug gets hall-windows. Styled concepts are allowed here, with their badge
 * (Photo.astro adds it), and their caption on the event page. Share images and structured data use the
 * real photo instead (realPhoto).
 */
const EVENT_PHOTOS: Record<string, string> = {
  weddings: 'styled-gazebo-ceremony',
  'receptions-banquets': 'styled-hall-windows-reception',
  'birthday-parties': 'styled-hall-fireplace-dinner',
  'graduations-reunions': 'styled-grove-tables-reunion',
  'baby-bridal-showers': 'hall-windows',
  'meetings-trainings': 'hall-doors',
  'repasts-memorials': 'gable',
  'church-community-events': 'grove-path',
};
const EVENT_PHOTO_FALLBACK = 'hall-windows';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/venue/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true },
);

const GENERIC_ALT = 'The Venue at NCC in Suffolk, Virginia';
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
  return `${base.charAt(0).toUpperCase() + base.slice(1)} at The Venue at NCC in Suffolk, Virginia`;
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
    console.warn(`[photos] ${file} is a styled concept, so its alt text must start with "${STYLED_ALT_PREFIX}". Added it.`);
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
    styled: [],
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
const styledConcepts = all.filter((p) => p.name.startsWith(STYLED_PREFIX) || p.styledOf !== undefined).sort(byDetailOrder);

/** The real photographs, in photoDetails order. Tall versions and styled concepts are attached, not listed. */
export const photos: VenuePhoto[] = all.filter((p) => !styledConcepts.includes(p)).sort(byDetailOrder);

for (const s of styledConcepts) {
  const base = s.styledOf ? photos.find((p) => p.file === s.styledOf) : undefined;
  if (!s.styledOf) {
    console.warn(`[photos] ${s.file} looks like a styled concept but has no styledOf in photoDetails, so it is not shown. Add styledOf: '<base>.jpg'.`);
  } else if (!base) {
    console.warn(`[photos] ${s.file} is a styled concept of ${s.styledOf}, but that photo is not in src/assets/venue/, so it is not shown.`);
  } else {
    base.styled.push(s);
  }
}

for (const p of [...photos, ...styledConcepts]) {
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
for (const file of detailOrder) {
  if (!all.some((p) => p.file === file)) console.warn(`[photos] photoDetails lists ${file}, but no such file is in src/assets/venue/.`);
}

export const hasPhotos = photos.length > 0;

/** A photo by name, with or without its extension: photoByName('gazebo') or photoByName('gazebo.jpg'). */
export function photoByName(name: string): VenuePhoto | null {
  const stem = stemOf(name);
  return photos.find((p) => p.name === stem) ?? styledConcepts.find((p) => p.name === stem) ?? null;
}

/** The real photos of one part of the property, in photoDetails order. */
export function photosFor(space: PhotoSpace): VenuePhoto[] {
  return photos.filter((p) => p.space === space);
}

export function photosTagged(tag: string): VenuePhoto[] {
  return photos.filter((p) => p.tags.includes(tag));
}

/** The home hero photo: the first photo tagged 'hero' (the building at dusk), else the first photo, else null. */
export function heroPhoto(): VenuePhoto | null {
  return photosTagged('hero')[0] ?? photos[0] ?? null;
}

/**
 * The photo that leads an event page and its tile, from the event photo map; hall-windows when the slug is
 * not mapped. It may be a styled concept: use realPhoto() wherever only a real photograph is allowed.
 */
export function eventPhoto(slug: string): VenuePhoto | null {
  return photoByName(EVENT_PHOTOS[slug] ?? EVENT_PHOTO_FALLBACK) ?? photoByName(EVENT_PHOTO_FALLBACK);
}

/** The real photograph behind a photo: the photo itself, or for a styled concept the photo it was made from. */
export function realPhoto(photo: VenuePhoto | null): VenuePhoto | null {
  if (!photo || !photo.styledOf) return photo;
  return photos.find((p) => p.file === photo.styledOf) ?? null;
}
