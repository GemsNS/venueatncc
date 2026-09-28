/**
 * The illustrated view through an arched window: an evening sky over a line of pines,
 * with the window's muntins and fanlight. Returned as an SVG string so the same artwork
 * is used on the page (ArchScene.astro) and in generated share images (/og/*.png).
 */

export const SCENE_W = 400;
export const SCENE_H = 500;

function pine(x: number, base: number, h: number, w: number): string {
  const tiers = 5;
  const trunk = h * 0.08;
  const crownBase = base - trunk;
  const crownH = h - trunk;
  let d = '';
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const yBottom = crownBase - crownH * t0 * 0.92;
    const yTop = crownBase - crownH * Math.min(1, (i + 1.7) / tiers);
    const half = (w / 2) * (1 - t0 * 0.78);
    d += `M${(x - half).toFixed(1)} ${yBottom.toFixed(1)}L${x.toFixed(1)} ${yTop.toFixed(1)}L${(x + half).toFixed(1)} ${yBottom.toFixed(1)}Z`;
  }
  const tw = Math.max(2, w * 0.06);
  d += `M${(x - tw / 2).toFixed(1)} ${base.toFixed(1)}h${tw.toFixed(1)}v${(-trunk - 2).toFixed(1)}h${(-tw).toFixed(1)}Z`;
  return d;
}

/** Deterministic pseudo-random sequence so every build draws the same trees. */
function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function treeLine(seed: number, base: number, minH: number, maxH: number, count: number): string {
  const r = rand(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * (SCENE_W + 60) - 30 + (r() - 0.5) * 24;
    const h = minH + r() * (maxH - minH);
    const w = h * (0.34 + r() * 0.12);
    d += pine(x, base + r() * 8, h, w);
  }
  return d;
}

export interface SceneOptions {
  /** Varies the tree line so repeated scenes are not identical. */
  variant?: number;
  /** Draw the window muntins and fanlight. */
  muntins?: boolean;
  /** Unique prefix for gradient ids when several scenes share a document. */
  id: string;
  /** Extra attributes for the root <svg>, as a raw string. */
  attrs?: string;
}

export function archSceneSvg({ variant = 0, muntins = true, id, attrs = '' }: SceneOptions): string {
  const W = SCENE_W;
  const H = SCENE_H;
  const springline = W / 2;
  const cx = W / 2;
  const back = treeLine(3 + variant, H - 70, 120, 190, 14);
  const front = treeLine(11 + variant * 7, H - 20, 170, 270, 9);

  const fan = [30, 60, 90, 120, 150]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x = (cx - Math.cos(rad) * cx).toFixed(1);
      const y = (springline - Math.sin(rad) * cx).toFixed(1);
      return `<line x1="${cx}" y1="${springline}" x2="${x}" y2="${y}" stroke-width="3"/>`;
    })
    .join('');

  const lowerRail = springline + (H - springline) / 2;
  const bars = muntins
    ? `<g stroke="#f4efe6" stroke-opacity="0.9" fill="none">` +
      `<line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke-width="5"/>` +
      `<line x1="0" y1="${springline}" x2="${W}" y2="${springline}" stroke-width="5"/>` +
      `<line x1="0" y1="${lowerRail}" x2="${W}" y2="${lowerRail}" stroke-width="3"/>` +
      fan +
      `<path d="M${cx - 54} ${springline}A54 54 0 0 1 ${cx + 54} ${springline}" stroke-width="3"/>` +
      `</g>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" ${attrs}>` +
    `<defs>` +
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#1b2a50"/><stop offset="0.45" stop-color="#4f5f86"/>` +
    `<stop offset="0.78" stop-color="#b9a98f"/><stop offset="1" stop-color="#e8d9c1"/>` +
    `</linearGradient>` +
    `<radialGradient id="${id}-glow" cx="0.5" cy="0.86" r="0.5">` +
    `<stop offset="0" stop-color="#f6e6c6" stop-opacity="0.95"/><stop offset="1" stop-color="#f6e6c6" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}-glow)"/>` +
    `<path d="${back}" fill="#3b5a4d" opacity="0.85"/>` +
    `<rect x="0" y="${H - 80}" width="${W}" height="80" fill="#3b5a4d" opacity="0.85"/>` +
    `<path d="${front}" fill="#1b3129"/>` +
    `<rect x="0" y="${H - 44}" width="${W}" height="44" fill="#1b3129"/>` +
    bars +
    `</svg>`
  );
}
