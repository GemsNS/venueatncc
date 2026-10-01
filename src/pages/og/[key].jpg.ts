/**
 * Share images (Open Graph and Twitter cards), one per page, rendered at build time with satori and resvg.
 * 1200 x 630 JPEG in the shape of the site's inner-page hero (redesign-spec.md, "Emails and share images"):
 * a real photo of the property, full bleed with no scrim (brand.md, version 6: bright and white-first); a
 * near-solid White caption panel bottom-left with a Rose Mist hairline (the earlier hero caption box; a
 * share image has no backdrop blur, so the panel stays near-solid for small previews) holding the Plum and
 * Cerise lockup, the page title in Libre Caslon Display in Plum, and one short line in Libre Caslon Text in
 * Mauve (at least 12.4:1 and 6.7:1 on the panel even over black). What each
 * card shows lives in _cards.ts. JPEG keeps each card well under 300 KB: some messengers skip link previews
 * for images much over that, which a lossless PNG of a photo always is.
 *
 * The home card uses the 'still' layout instead (stillTree below): a still life of roses with no scrim and
 * a White panel on its plain left side that mirrors the home welcome: "Welcome to" in italic over the
 * lockup's own words, so the name is set once, the way the page the link opens sets it.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { shareCards, type ShareCard } from './_cards';
import { site } from '../../data/site';
import { NAME_BOX } from '../../lib/lockup';

export const getStaticPaths = (() =>
  Object.entries(shareCards).map(([key, card]) => ({ params: { key }, props: { card } }))) satisfies GetStaticPaths;

const W = 1200;
const H = 630;
/** The card's margin, the panel's padding, and the panel's radius (20px, scaled). */
const PAD = 56;
const PANEL_PAD = 40;
const PANEL_RADIUS = 24;
const PANEL_MAX_W = 780;
/** The lockup's height inside the panel. Its viewBox is 534 by 100. */
const LOCKUP_H = 40;
const LOCKUP_W = Math.round((LOCKUP_H * 534) / 100);

/** The palette (brand.md, Color). Plum as channels for the panel's shadow. */
const PLUM_RGB = '59, 36, 48';
const plum = (alpha: number) => `rgba(${PLUM_RGB}, ${alpha})`;
const PLUM = '#3B2430';
const MAUVE = '#6A4B57';
const BLUSH = '#FFF4F7';
/** The caption panel: White at 0.94 over the photo (Plum keeps 12.4:1 and Mauve 6.7:1 even over black). */
const PANEL_BG = 'rgba(255, 255, 255, 0.94)';

const root = process.cwd();
const fromRoot = (...p: string[]) => path.join(root, ...p);
const fontFile = (p: string) => fs.readFile(fromRoot('node_modules', p));
const dataUri = (type: string, b: Buffer | Uint8Array) => `data:${type};base64,${Buffer.from(b).toString('base64')}`;

interface Shared {
  caslonDisplay: Buffer;
  caslonText: Buffer;
  caslonItalic: Buffer;
  lockup: string;
  /** The lockup's words alone (no ring), cut to NAME_BOX as Logo.astro's 'lockup-name' is. */
  name: string;
}
let shared: Promise<Shared> | undefined;
function loadShared(): Promise<Shared> {
  shared ??= (async () => {
    // satori reads woff and ttf, not woff2.
    const [caslonDisplay, caslonText, caslonItalic, lockupSvg] = await Promise.all([
      fontFile('@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff'),
      fontFile('@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff'),
      fontFile('@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-italic.woff'),
      fs.readFile(fromRoot('src/assets/brand/venue-lockup.svg'), 'utf8'),
    ]);
    // The lockup is outlined paths, so resvg draws it without fonts. Rendered at twice its size for a crisp edge.
    const lockupPng = new Resvg(lockupSvg, { fitTo: { mode: 'height', value: LOCKUP_H * 2 } }).render().asPng();
    const nameSvg = lockupSvg
      .replace(/<circle\b[^>]*\/>/g, '')
      .replace(/<path\b(?![^>]*data-part)[^>]*\/>/g, '')
      .replace(/viewBox="[^"]*"/, `viewBox="${NAME_BOX.x} ${NAME_BOX.y} ${NAME_BOX.width} ${NAME_BOX.height}"`);
    const namePng = new Resvg(nameSvg, { fitTo: { mode: 'width', value: STILL_NAME_W * 2 } }).render().asPng();
    return { caslonDisplay, caslonText, caslonItalic, lockup: dataUri('image/png', lockupPng), name: dataUri('image/png', namePng) };
  })();
  return shared;
}

/** Several cards share a photo, so each one (and each region of it) is resized once per build. */
const photos = new Map<string, Promise<string>>();
async function cropped(p: ShareCard['photo']) {
  const img = sharp(fromRoot('src/assets/venue', p.file));
  if (!p.region) return img;
  const { width = 0, height = 0 } = await img.metadata();
  const r = p.region;
  return img.extract({
    left: Math.round(r.left * width),
    top: Math.round(r.top * height),
    width: Math.round(r.width * width),
    height: Math.round(r.height * height),
  });
}
function loadPhoto(p: ShareCard['photo']): Promise<string> {
  const key = JSON.stringify([p.file, p.region ?? null]);
  let photo = photos.get(key);
  if (!photo) {
    photo = cropped(p)
      .then((img) => img.resize(W, H, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer())
      .then((b) => dataUri('image/jpeg', b));
    photos.set(key, photo);
  }
  return photo;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});
const layer = { position: 'absolute', top: 0, left: 0, width: W, height: H } as const;

/** The width inside the panel's padding, where the title wraps. */
const TITLE_W = PANEL_MAX_W - PANEL_PAD * 2;

/**
 * The title's size: 64px when it fits on one line, else 56px so that a page title of up to about 50
 * characters takes two lines. Libre Caslon Display averages about 0.42em a character; 0.44 leaves room.
 */
function titleSize(title: string): number {
  return title.length * 0.44 * 64 <= TITLE_W ? 64 : 56;
}

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: ShareCard };
  const [a, photo] = await Promise.all([loadShared(), loadPhoto(card.photo)]);
  const size = titleSize(card.title);

  const tree = card.layout === 'still' ? stillTree(card, a, photo) : photoTree(card, a, photo, size);

  const svg = await satori(tree as never, {
    width: W,
    height: H,
    fonts: [
      { name: 'Libre Caslon Display', data: a.caslonDisplay, weight: 400, style: 'normal' },
      { name: 'Libre Caslon Text', data: a.caslonText, weight: 400, style: 'normal' },
      { name: 'Libre Caslon Text', data: a.caslonItalic, weight: 400, style: 'italic' },
    ],
  });
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  // Full-resolution color (4:4:4) keeps the serif edges crisp on the White panel.
  const jpeg = await sharp(rendered).removeAlpha().jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg' } });
};

/**
 * The still life layout (the home card): the photo full bleed with no scrim, since a light still life needs
 * none, and a White panel centred on the plain left side, ending well before the subject (STILL_PANEL_W
 * from STILL_LEFT stays left of the bouquet's first leaves at about x 605). It mirrors the home welcome:
 * the words before the business name ("Welcome to") in Caslon Text italic, Mauve, then the name as the
 * lockup's own words (Plum, with the Cerise italic "@ NCC") across the panel's inner width on one line, then
 * the line. The name is set once; a Rose Mist hairline and a soft Plum shadow lift the panel off the wall.
 */
const STILL_LEFT = 72;
const STILL_PANEL_W = 488;
const STILL_PAD = 40;
// The panel's inner width, less its 1px hairline on each side.
const STILL_NAME_W = STILL_PANEL_W - 2 * STILL_PAD - 2;
const STILL_NAME_H = Math.round((STILL_NAME_W * NAME_BOX.height) / NAME_BOX.width);
const ROSE_MIST = '#F9C6D7';
function stillTree(card: ShareCard, a: Shared, photo: string): Node {
  const nameAt = card.title.indexOf(site.name);
  // The name as the lockup's words when the title ends with it (after a lead such as "Welcome to"), else
  // the title as text.
  const asLockup = nameAt >= 0 && card.title.endsWith(site.name);
  const lead = asLockup ? card.title.slice(0, nameAt).trim() : '';
  const title = asLockup
    ? h('img', { width: STILL_NAME_W, height: STILL_NAME_H, marginTop: lead ? 14 : 0 }, undefined, { src: a.name, width: STILL_NAME_W, height: STILL_NAME_H })
    : h('div', { fontFamily: 'Libre Caslon Display', fontSize: 50, lineHeight: 1.1, color: PLUM }, card.title);
  return h('div', { display: 'flex', position: 'relative', width: W, height: H, backgroundColor: BLUSH, fontFamily: 'Libre Caslon Text', color: PLUM }, [
    h('img', { ...layer, objectFit: 'cover' }, undefined, { src: photo, width: W, height: H }),
    h('div', { ...layer, display: 'flex', alignItems: 'center', paddingLeft: STILL_LEFT }, [
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: STILL_PANEL_W,
          padding: STILL_PAD,
          borderRadius: PANEL_RADIUS,
          backgroundColor: PANEL_BG,
          border: `1px solid ${ROSE_MIST}`,
          boxShadow: `0 18px 48px ${plum(0.1)}`,
        },
        [
          ...(lead
            ? [h('div', { fontStyle: 'italic', fontSize: 32, lineHeight: 1.2, color: MAUVE }, lead)]
            : []),
          title,
          h('div', { fontSize: 22, lineHeight: 1.35, color: MAUVE, marginTop: 22 }, card.line),
        ],
      ),
    ]),
  ]);
}

/** The default layout: a real photo full bleed with no scrim, the White panel bottom left. */
function photoTree(card: ShareCard, a: Shared, photo: string, size: number): Node {
  return h('div', { display: 'flex', position: 'relative', width: W, height: H, backgroundColor: BLUSH, fontFamily: 'Libre Caslon Text', color: PLUM }, [
    h('img', { ...layer, objectFit: 'cover' }, undefined, { src: photo, width: W, height: H }),
    h('div', { ...layer, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', padding: PAD }, [
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 18,
          maxWidth: PANEL_MAX_W,
          padding: PANEL_PAD,
          borderRadius: PANEL_RADIUS,
          backgroundColor: PANEL_BG,
          border: `1px solid ${ROSE_MIST}`,
          boxShadow: `0 18px 48px ${plum(0.12)}`,
        },
        [
          h('img', { width: LOCKUP_W, height: LOCKUP_H, marginBottom: 6 }, undefined, { src: a.lockup, width: LOCKUP_W, height: LOCKUP_H }),
          h('div', { fontFamily: 'Libre Caslon Display', fontSize: size, lineHeight: 1.08, letterSpacing: -0.01 * size, color: PLUM }, card.title),
          h('div', { fontSize: 24, lineHeight: 1.35, color: MAUVE }, card.line),
        ],
      ),
    ]),
  ]);
}
