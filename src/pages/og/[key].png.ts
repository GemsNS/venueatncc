/**
 * Share images (Open Graph / Twitter cards), one per page, rendered at build time.
 * 1200 x 630 PNG: brand navy, the page title in Marcellus, and the illustrated arch.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { site } from '../../data/site';
import { events } from '../../data/events';
import { archSceneSvg } from '../../lib/archScene';

interface Card {
  title: string;
  subtitle: string;
}

const cards: Record<string, Card> = {
  home: { title: 'Unforgettable events await you', subtitle: 'An event space in Suffolk, Virginia, at New Community Church' },
  events: { title: 'Events at The Venue at NCC', subtitle: 'Weddings, showers, birthdays, repasts, meetings, and more' },
  'the-space': { title: 'The space', subtitle: 'The event space at New Community Church in Suffolk, Virginia' },
  book: { title: 'Check your date', subtitle: `Call ${site.contact.phone} to plan your event` },
  faq: { title: 'Questions and answers', subtitle: 'What to know before you book The Venue at NCC' },
  about: { title: 'About The Venue at NCC', subtitle: 'The event space of New Community Church, Suffolk, Virginia' },
};
for (const e of events) {
  cards[e.slug] = { title: e.name, subtitle: `At The Venue at NCC in Suffolk, Virginia` };
}

export const getStaticPaths = (() =>
  Object.entries(cards).map(([key, card]) => ({ params: { key }, props: { card } }))) satisfies GetStaticPaths;

const root = process.cwd();
const fontFile = (p: string) => fs.readFile(path.join(root, 'node_modules', p));

let assets: Promise<{ display: Buffer; body: Buffer; bodyBold: Buffer; mark: string; scene: string }> | undefined;
function loadAssets() {
  assets ??= (async () => {
    const [display, body, bodyBold, markPng] = await Promise.all([
      fontFile('@fontsource/marcellus/files/marcellus-latin-400-normal.woff'),
      fontFile('@fontsource/montserrat/files/montserrat-latin-400-normal.woff'),
      fontFile('@fontsource/montserrat/files/montserrat-latin-600-normal.woff'),
      sharp(path.join(root, 'src/assets/brand/ncc-mark.png')).resize(112, 112).png().toBuffer(),
    ]);
    const sceneSvg = archSceneSvg({ id: 'og', variant: 1, attrs: 'width="400" height="500"' });
    return {
      display,
      body,
      bodyBold,
      mark: `data:image/png;base64,${markPng.toString('base64')}`,
      scene: `data:image/svg+xml;base64,${Buffer.from(sceneSvg).toString('base64')}`,
    };
  })();
  return assets;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: Card };
  const a = await loadAssets();
  const titleSize = card.title.length > 30 ? 64 : 76;

  const tree = h(
    'div',
    { width: 1200, height: 630, display: 'flex', backgroundColor: '#14203c', color: '#f4f6fa', fontFamily: 'Montserrat' },
    [
      h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 0 60px 72px', width: 780 }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 20 }, [
          h('img', { width: 64, height: 64, borderRadius: 32 }, undefined, { src: a.mark, width: 64, height: 64 }),
          h('div', { fontFamily: 'Marcellus', fontSize: 34 }, site.name),
        ]),
        h('div', { display: 'flex', flexDirection: 'column', gap: 22 }, [
          h('div', { fontFamily: 'Marcellus', fontSize: titleSize, lineHeight: 1.08, maxWidth: 680 }, card.title),
          h('div', { fontSize: 28, lineHeight: 1.35, color: '#c3cbdc', maxWidth: 640 }, card.subtitle),
        ]),
        h('div', { display: 'flex', gap: 28, fontSize: 24, fontWeight: 600, color: '#e8d9c1' }, [
          h('div', {}, 'venueatncc.org'),
          h('div', {}, site.contact.phone),
        ]),
      ]),
      h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: 420, paddingBottom: 0 }, [
        h(
          'div',
          {
            display: 'flex',
            width: 340,
            height: 520,
            padding: 12,
            border: '1.5px solid #a87a2e',
            borderTopLeftRadius: 170,
            borderTopRightRadius: 170,
            borderBottomWidth: 0,
          },
          [
            h(
              'div',
              { display: 'flex', width: 316, height: 508, overflow: 'hidden', borderTopLeftRadius: 158, borderTopRightRadius: 158 },
              [h('img', { width: 316, height: 508, objectFit: 'cover' }, undefined, { src: a.scene, width: 316, height: 508 })],
            ),
          ],
        ),
      ]),
    ],
  );

  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Marcellus', data: a.display, weight: 400, style: 'normal' },
      { name: 'Montserrat', data: a.body, weight: 400, style: 'normal' },
      { name: 'Montserrat', data: a.bodyBold, weight: 600, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
