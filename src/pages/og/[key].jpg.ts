/**
 * Share images (Open Graph and Twitter cards), one per page, rendered at build time with satori and resvg.
 * 1200 x 630 JPEG in the shape of the site's inner-page hero (redesign-spec.md, "Emails and share images"):
 * a real photo of the property, full bleed, under a soft Plum bottom scrim; a Blush caption panel bottom-left
 * (the hero's caption box, on the page surface) holding the Plum lockup, the page title in Libre Caslon
 * Display in Plum, and one short line in Libre Caslon Text in Mauve (12.8:1 and 6.9:1 on Blush). What each
 * card shows lives in _cards.ts. JPEG keeps each card well under 300 KB: some messengers skip link previews
 * for images much over that, which a lossless PNG of a photo always is.
 *
 * The home card uses the 'still' layout instead (stillTree below): a still life of roses with no scrim and
 * a White panel on its plain left side.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { shareCards, type ShareCard } from './_cards';
import { site } from '../../data/site';

export const getStaticPaths = (() =>
  Object.entries(shareCards).map(([key, card]) => ({ params: { key }, props: { card } }))) satisfies GetStaticPaths;

const W = 1200;
const H = 630;
/** The card's margin, the panel's padding, and the panel's radius (the hero caption panel's 20px, scaled). */
const PAD = 56;
const PANEL_PAD = 40;
const PANEL_RADIUS = 24;
const PANEL_MAX_W = 780;
/** The lockup's height inside the panel. Its viewBox is 534 by 100. */
const LOCKUP_H = 40;
const LOCKUP_W = Math.round((LOCKUP_H * 534) / 100);

/** The palette (brand.md, Color). Plum as channels for the scrim's stops. */
const PLUM_RGB = '59, 36, 48';
const plum = (alpha: number) => `rgba(${PLUM_RGB}, ${alpha})`;
const PLUM = '#3B2430';
const MAUVE = '#6A4B57';
const BLUSH = '#FBF1F3';

const root = process.cwd();
const fromRoot = (...p: string[]) => path.join(root, ...p);
const fontFile = (p: string) => fs.readFile(fromRoot('node_modules', p));
const dataUri = (type: string, b: Buffer | Uint8Array) => `data:${type};base64,${Buffer.from(b).toString('base64')}`;

interface Shared {
  caslonDisplay: Buffer;
  caslonText: Buffer;
  lockup: string;
}
let shared: Promise<Shared> | undefined;
function loadShared(): Promise<Shared> {
  shared ??= (async () => {
    // satori reads woff and ttf, not woff2.
    const [caslonDisplay, caslonText, lockupSvg] = await Promise.all([
      fontFile('@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff'),
      fontFile('@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff'),
      fs.readFile(fromRoot('src/assets/brand/venue-lockup.svg'), 'utf8'),
    ]);
    // The lockup is outlined paths, so resvg draws it without fonts. Rendered at twice its size for a crisp edge.
    const lockupPng = new Resvg(lockupSvg, { fitTo: { mode: 'height', value: LOCKUP_H * 2 } }).render().asPng();
    return { caslonDisplay, caslonText, lockup: dataUri('image/png', lockupPng) };
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
    ],
  });
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  // Full-resolution color (4:4:4) keeps the serif edges crisp on the Blush panel.
  const jpeg = await sharp(rendered).removeAlpha().jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg' } });
};

/**
 * The still life layout (the home card): the photo full bleed with no scrim, since a light still life needs
 * none, and a White panel centred on the plain left side, ending well before the subject (STILL_PANEL_W
 * from STILL_LEFT stays left of the bouquet's first leaves at about x 605). The title breaks before the
 * business name so the name is never split. A short Rose rule between the lockup and the title, a Rose
 * Mist hairline, and a soft Plum shadow lift the panel off the blush wall.
 */
const STILL_LEFT = 72;
const STILL_PANEL_W = 488;
const STILL_PAD = 40;
const ROSE = '#B5456E';
const ROSE_MIST = '#EFC5D0';
function stillTree(card: ShareCard, a: Shared, photo: string): Node {
  const nameAt = card.title.indexOf(site.name);
  const lines = nameAt > 0 ? [card.title.slice(0, nameAt).trim(), card.title.slice(nameAt)] : [card.title];
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
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          border: `1px solid ${ROSE_MIST}`,
          boxShadow: `0 18px 48px ${plum(0.1)}`,
        },
        [
          h('img', { width: LOCKUP_W, height: LOCKUP_H }, undefined, { src: a.lockup, width: LOCKUP_W, height: LOCKUP_H }),
          h('div', { width: 48, height: 2, backgroundColor: ROSE, marginTop: 26, marginBottom: 24 }),
          h(
            'div',
            { display: 'flex', flexDirection: 'column', fontFamily: 'Libre Caslon Display', fontSize: 50, lineHeight: 1.1, letterSpacing: -0.5, color: PLUM, whiteSpace: 'nowrap' },
            lines.map((l) => h('div', {}, l)),
          ),
          h('div', { fontSize: 22, lineHeight: 1.35, color: MAUVE, marginTop: 18 }, card.line),
        ],
      ),
    ]),
  ]);
}

/** The default layout: a real photo under the hero's Plum bottom scrim, the Blush panel bottom left. */
function photoTree(card: ShareCard, a: Shared, photo: string, size: number): Node {
  return h('div', { display: 'flex', position: 'relative', width: W, height: H, backgroundColor: PLUM, fontFamily: 'Libre Caslon Text', color: PLUM }, [
    h('img', { ...layer, objectFit: 'cover' }, undefined, { src: photo, width: W, height: H }),
    // The hero's bottom scrim: the panel sits on it, and the photo's lower edge settles under the type.
    h('div', { ...layer, backgroundImage: `linear-gradient(180deg, ${plum(0)} 0%, ${plum(0)} 42%, ${plum(0.22)} 70%, ${plum(0.5)} 100%)` }),
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
          backgroundColor: BLUSH,
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
