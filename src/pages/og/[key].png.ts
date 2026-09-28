/**
 * Share images (Open Graph and Twitter cards), one per page, rendered at build time with satori and resvg.
 * 1200 x 630 PNG: a real photo of the property, a Deep Plum scrim for legibility, the white lockup, the page
 * title in Libre Caslon Display, and one short line in Inter. What each card shows lives in _cards.ts.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { shareCards, type ShareCard } from './_cards';

export const getStaticPaths = (() =>
  Object.entries(shareCards).map(([key, card]) => ({ params: { key }, props: { card } }))) satisfies GetStaticPaths;

const W = 1200;
const H = 630;
const PAD = 64;
/** The lockup's height on the card. Its viewBox is 534 by 100. */
const LOCKUP_H = 60;
const LOCKUP_W = Math.round((LOCKUP_H * 534) / 100);

/** Deep Plum, dark value, as RGB for the scrim's stops. */
const PLUM = '26, 16, 36';
const plum = (alpha: number) => `rgba(${PLUM}, ${alpha})`;
const LILAC = '#CDB3EE';

const root = process.cwd();
const fromRoot = (...p: string[]) => path.join(root, ...p);
const fontFile = (p: string) => fs.readFile(fromRoot('node_modules', p));
const dataUri = (type: string, b: Buffer | Uint8Array) => `data:${type};base64,${Buffer.from(b).toString('base64')}`;

interface Shared {
  caslon: Buffer;
  inter: Buffer;
  interMedium: Buffer;
  lockup: string;
}
let shared: Promise<Shared> | undefined;
function loadShared(): Promise<Shared> {
  shared ??= (async () => {
    // satori reads woff and ttf, not woff2.
    const [caslon, inter, interMedium, lockupSvg] = await Promise.all([
      fontFile('@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff'),
      fontFile('@fontsource/inter/files/inter-latin-400-normal.woff'),
      fontFile('@fontsource/inter/files/inter-latin-500-normal.woff'),
      fs.readFile(fromRoot('src/assets/brand/venue-lockup-white.svg'), 'utf8'),
    ]);
    // The lockup is outlined paths, so resvg draws it without fonts. Rendered at twice its size for a crisp edge.
    const lockupPng = new Resvg(lockupSvg, { fitTo: { mode: 'height', value: LOCKUP_H * 2 } }).render().asPng();
    return { caslon, inter, interMedium, lockup: dataUri('image/png', lockupPng) };
  })();
  return shared;
}

/** Several cards share a photo, so each one is resized once per build. */
const photos = new Map<string, Promise<string>>();
function loadPhoto(file: string): Promise<string> {
  let photo = photos.get(file);
  if (!photo) {
    photo = sharp(fromRoot('src/assets/venue', file))
      .resize(W, H, { fit: 'cover' })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer()
      .then((b) => dataUri('image/jpeg', b));
    photos.set(file, photo);
  }
  return photo;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});
const layer = { position: 'absolute', top: 0, left: 0, width: W, height: H } as const;

/** The width inside the padding. */
const CONTENT_W = W - PAD * 2;

/**
 * The title's size: 84px, smaller so a longer title still fits on one line, and never below 60px
 * (a title longer than that wraps). Libre Caslon Display averages about 0.42em a character; 0.44 leaves room.
 */
function titleSize(title: string): number {
  return Math.max(60, Math.min(84, Math.floor(CONTENT_W / (title.length * 0.44))));
}

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: ShareCard };
  const [a, photo] = await Promise.all([loadShared(), loadPhoto(card.photo.file)]);
  const size = titleSize(card.title);
  // A pale photo with strong lines (the gable's white cross) gets a deeper scrim behind the title.
  const k = card.deepScrim ? 1.18 : 1;
  const scrim = (alpha: number) => plum(Math.min(0.94, alpha * k));

  const tree = h('div', { display: 'flex', position: 'relative', width: W, height: H, backgroundColor: `rgb(${PLUM})`, fontFamily: 'Inter', color: '#FFFFFF' }, [
    h('img', { ...layer, objectFit: 'cover' }, undefined, { src: photo, width: W, height: H }),
    // Legibility scrims only: deepest behind the text at the lower left, a light veil under the lockup.
    h('div', { ...layer, backgroundImage: `linear-gradient(90deg, ${scrim(0.78)} 0%, ${scrim(0.5)} 38%, ${scrim(0.1)} 72%, ${plum(0)} 100%)` }),
    h('div', { ...layer, backgroundImage: `linear-gradient(0deg, ${scrim(0.8)} 0%, ${scrim(0.32)} 40%, ${plum(0)} 62%, ${plum(0)} 76%, ${plum(0.3)} 100%)` }),
    h('div', { ...layer, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: PAD }, [
      h('img', { width: LOCKUP_W, height: LOCKUP_H }, undefined, { src: a.lockup, width: LOCKUP_W, height: LOCKUP_H }),
      h('div', { display: 'flex', flexDirection: 'column', gap: 20, width: CONTENT_W }, [
        h('div', { fontFamily: 'Libre Caslon Display', fontSize: size, lineHeight: 1.08, letterSpacing: -0.01 * size }, card.title),
        h('div', { fontSize: 28, fontWeight: 500, lineHeight: 1.3, color: LILAC }, card.line),
      ]),
    ]),
  ]);

  const svg = await satori(tree as never, {
    width: W,
    height: H,
    fonts: [
      { name: 'Libre Caslon Display', data: a.caslon, weight: 400, style: 'normal' },
      { name: 'Inter', data: a.inter, weight: 400, style: 'normal' },
      { name: 'Inter', data: a.interMedium, weight: 500, style: 'normal' },
    ],
  });
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  // resvg writes a loosely compressed RGBA file. The card is opaque, so drop the alpha channel and recompress,
  // still lossless: a 256-color palette would halve the size but blotches smooth walls and sky.
  const png = await sharp(rendered).removeAlpha().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
