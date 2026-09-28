/**
 * Share images (Open Graph / Twitter cards), one per page, rendered at build time.
 * 1200 x 630 PNG in the site's white-and-purple style: large title, key facts, and a photo of the building at dusk.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { site } from '../../data/site';
import { shareCards, sharePills, type ShareCard as Card } from './_cards';

export const getStaticPaths = (() =>
  Object.entries(shareCards).map(([key, card]) => ({ params: { key }, props: { card } }))) satisfies GetStaticPaths;

const root = process.cwd();
const read = (p: string) => fs.readFile(path.join(root, 'node_modules', p));

let assets: Promise<{ regular: Buffer; semibold: Buffer; bold: Buffer; mark: string; photo: string }> | undefined;
function loadAssets() {
  assets ??= (async () => {
    const [regular, semibold, bold, markPng, photoJpg] = await Promise.all([
      read('@fontsource/inter/files/inter-latin-400-normal.woff'),
      read('@fontsource/inter/files/inter-latin-600-normal.woff'),
      read('@fontsource/inter/files/inter-latin-700-normal.woff'),
      sharp(path.join(root, 'src/assets/brand/ncc-mark.png')).resize(96, 96).png().toBuffer(),
      // The building at dusk, cropped to the photo panel at twice its size for a sharp render.
      sharp(path.join(root, 'src/assets/venue/exterior-dusk-tall.jpg')).resize(640, 1148, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer(),
    ]);
    return {
      regular,
      semibold,
      bold,
      mark: `data:image/png;base64,${markPng.toString('base64')}`,
      photo: `data:image/jpeg;base64,${photoJpg.toString('base64')}`,
    };
  })();
  return assets;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

const pill = (text: string) =>
  h('div', { display: 'flex', padding: '10px 18px', borderRadius: 999, backgroundColor: '#F4F0F8', color: '#4F2A75', fontSize: 22, fontWeight: 600 }, text);

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: Card };
  const a = await loadAssets();
  const titleSize = card.title.length > 44 ? 58 : card.title.length > 30 ? 66 : 76;

  const tree = h('div', { width: 1200, height: 630, display: 'flex', backgroundColor: '#ffffff', fontFamily: 'Inter', color: '#1C1622' }, [
    h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px 0 56px 72px', width: 800 }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
        h('img', { width: 52, height: 52, borderRadius: 26 }, undefined, { src: a.mark, width: 52, height: 52 }),
        h('div', { fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }, site.name),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: 18 }, [
        h('div', { fontSize: 28, fontWeight: 600, color: '#4F2A75' }, card.kicker),
        h('div', { fontSize: titleSize, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.2, maxWidth: 700 }, card.title),
      ]),
      h('div', { display: 'flex', gap: 12 }, sharePills.map(pill)),
    ]),
    h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: 400, paddingTop: 56 }, [
      h(
        'div',
        { display: 'flex', width: 320, height: 574, overflow: 'hidden', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
        [h('img', { width: 320, height: 574, objectFit: 'cover' }, undefined, { src: a.photo, width: 320, height: 574 })],
      ),
    ]),
  ]);

  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: a.regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: a.semibold, weight: 600, style: 'normal' },
      { name: 'Inter', data: a.bold, weight: 700, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
