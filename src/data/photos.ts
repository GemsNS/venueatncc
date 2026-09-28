/**
 * Venue photos.
 *
 * HOW TO ADD PHOTOS
 * 1. Drop image files (jpg, jpeg, png, webp, avif) into `src/assets/venue/`.
 *    Every file in that folder is PUBLISHED on the site. Keep reference-only images elsewhere.
 *    Use originals at least 1600px on the long edge; smaller files look soft in the arches.
 * 2. Describe each photo below in `photoDetails`. Photos without an entry still appear in
 *    the gallery, with alt text built from the filename (or a generic description when the
 *    filename is a camera name like IMG_1234.jpg), so descriptive entries are strongly preferred.
 * 3. Tag a photo to place it:
 *      'hero'         the arched photo at the top of the home page (first match wins)
 *      'space'        featured in the home page "the space" row
 *      'about'        the arched photo on the About page
 *      '<event slug>' used on that event page, e.g. 'weddings', 'repasts-memorials'
 *    Photos are cropped to the arch shape and converted to AVIF and WebP at build time.
 *    Use `crop` to choose which part of the photo stays in frame.
 */
import type { ImageMetadata } from 'astro';

/** Where to anchor the crop inside the arch. 'attention' lets the image library pick the most interesting region. */
export type CropPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'left top'
  | 'right top'
  | 'left bottom'
  | 'right bottom'
  | 'attention'
  | 'entropy';

export interface PhotoDetail {
  /** Describe what is in the photo for someone who cannot see it. Required for good SEO and accessibility. */
  alt: string;
  caption?: string;
  tags?: string[];
  /** Which part of the photo to keep when it is cropped to the arch. Defaults to 'center'. */
  crop?: CropPosition;
}

export const photoDetails: Record<string, PhotoDetail> = {
  // 'fellowship-hall-reception-tables.jpg': {
  //   alt: 'Round tables set for a reception in the fellowship hall at The Venue at NCC',
  //   caption: 'Reception setup in the fellowship hall',
  //   tags: ['hero', 'weddings', 'receptions-banquets'],
  //   crop: 'center',
  // },
};

export interface VenuePhoto extends PhotoDetail {
  file: string;
  src: ImageMetadata;
  tags: string[];
}

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/venue/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true },
);

const GENERIC_ALT = 'The Venue at NCC in Suffolk, Virginia';
const CAMERA_WORDS = new Set(['img', 'dsc', 'dscn', 'dscf', 'pxl', 'mvimg', 'photo', 'image', 'screenshot', 'dcim', 'whatsapp', 'edited', 'copy', 'mp', 'portrait', 'night']);

/** Alt text from a descriptive filename; generic text when the name is a camera default. */
function altFromFilename(file: string): string {
  const words = file
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[^a-z]+/i)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 2 && !CAMERA_WORDS.has(w));
  if (words.length < 2) return GENERIC_ALT;
  const base = words.join(' ');
  return `${base.charAt(0).toUpperCase() + base.slice(1)} at The Venue at NCC in Suffolk, Virginia`;
}

const detailOrder = Object.keys(photoDetails);

export const photos: VenuePhoto[] = Object.entries(modules)
  .map(([path, mod]) => {
    const file = path.split('/').pop() as string;
    const detail = photoDetails[file];
    return {
      file,
      src: mod.default,
      alt: detail?.alt ?? altFromFilename(file),
      caption: detail?.caption,
      crop: detail?.crop,
      tags: detail?.tags ?? [],
    };
  })
  .sort((a, b) => {
    const ia = detailOrder.indexOf(a.file);
    const ib = detailOrder.indexOf(b.file);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    return a.file.localeCompare(b.file);
  });

for (const p of photos) {
  if (Math.max(p.src.width, p.src.height) < 1600) {
    console.warn(
      `[photos] ${p.file} is ${p.src.width}x${p.src.height}. Use an original at least 1600px on the long edge or it will look soft in the arches.`,
    );
  }
  if (!photoDetails[p.file]) {
    console.warn(`[photos] ${p.file} has no entry in photoDetails, so its alt text is "${p.alt}". Add a description in src/data/photos.ts.`);
  }
}
for (const name of detailOrder) {
  if (!photos.some((p) => p.file === name)) console.warn(`[photos] photoDetails lists ${name}, but no such file is in src/assets/venue/.`);
}

export const hasPhotos = photos.length > 0;

export function photosTagged(tag: string): VenuePhoto[] {
  return photos.filter((p) => p.tags.includes(tag));
}

/** The home hero photo: the first photo tagged 'hero', else the first photo, else null. */
export function heroPhoto(): VenuePhoto | null {
  return photosTagged('hero')[0] ?? photos[0] ?? null;
}

/** A photo for an event page: tagged with the slug, else null (the page then shows the illustrated arch). */
export function eventPhoto(slug: string): VenuePhoto | null {
  return photosTagged(slug)[0] ?? null;
}
