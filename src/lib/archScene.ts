/**
 * The luminous placeholder scene: evening light through a window, in the venue's purple.
 * Shown in media frames until real photos are added, and reused in generated share images.
 * Returned as an SVG string so pages (ArchScene.astro) and the OG renderer share one source.
 */

export interface SceneOptions {
  /** Unique prefix for gradient ids when several scenes share a document. */
  id: string;
  /** Varies the light so repeated scenes are not identical. */
  variant?: number;
  /** Draw window muntins (thin bars) for the arched-window frames. */
  muntins?: boolean;
  /** Draw a large arched window outline centred in the scene (for wide panels). */
  window?: boolean;
  /** Canvas size; the SVG is drawn to cover it (preserveAspectRatio slice). */
  width?: number;
  height?: number;
  /** Extra attributes for the root <svg>, as a raw string. */
  attrs?: string;
}

const PALETTES = [
  { top: '#1a0b2e', mid: '#5b2a9a', low: '#c9a2f2', glowA: '#bf5af2', glowB: '#5e5ce6', warm: '#ffd9f2' },
  { top: '#140a26', mid: '#4a2388', low: '#b691ec', glowA: '#9b51e0', glowB: '#7d7aff', warm: '#ffe4f5' },
  { top: '#1d0c33', mid: '#6b2fb0', low: '#dcb8ff', glowA: '#cb30e0', glowB: '#5e5ce6', warm: '#fff0fa' },
];

/** A tall arched window outline with fanlight and muntins, centred in a W x H canvas. */
function windowOutline(W: number, H: number): string {
  const aw = Math.min(W * 0.34, H * 0.62);
  const x0 = W / 2 - aw / 2;
  const x1 = W / 2 + aw / 2;
  const r = aw / 2;
  const top = H * 0.1;
  const spring = top + r;
  const cx = W / 2;
  const sw = Math.max(2, W / 400);
  const fan = [30, 60, 90, 120, 150]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return `<line x1="${cx}" y1="${spring}" x2="${(cx - Math.cos(rad) * r).toFixed(1)}" y2="${(spring - Math.sin(rad) * r).toFixed(1)}"/>`;
    })
    .join('');
  const rails = [0.42, 0.7].map((t) => {
    const y = (spring + (H - spring) * t).toFixed(1);
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
  });
  const outline = `M${x0} ${H}V${spring}A${r} ${r} 0 0 1 ${x1} ${spring}V${H}`;
  return (
    `<path d="${outline}Z" fill="#ffffff" fill-opacity="0.07"/>` +
    `<g fill="none" stroke="#ffffff" stroke-linecap="round">` +
    `<path d="${outline}" stroke-opacity="0.75" stroke-width="${sw * 1.6}"/>` +
    `<g stroke-opacity="0.4" stroke-width="${sw}">` +
    `<line x1="${cx}" y1="${top}" x2="${cx}" y2="${H}"/>` +
    `<line x1="${x0}" y1="${spring}" x2="${x1}" y2="${spring}"/>` +
    fan +
    rails.join('') +
    `<path d="M${cx - r * 0.28} ${spring}A${r * 0.28} ${r * 0.28} 0 0 1 ${cx + r * 0.28} ${spring}"/>` +
    `</g></g>`
  );
}

export function archSceneSvg({ id, variant = 0, muntins = false, window: showWindow = false, width = 400, height = 500, attrs = '' }: SceneOptions): string {
  const p = PALETTES[Math.abs(variant) % PALETTES.length];
  const W = width;
  const H = height;
  const shift = ((variant * 37) % 30) / 100; // 0 to 0.29, moves the glows a little per variant
  const cx = W / 2;
  const springline = Math.min(W / 2, H * 0.45);

  const bars = muntins
    ? `<g stroke="#ffffff" stroke-opacity="0.42" fill="none">` +
      `<line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke-width="${Math.max(2, W / 110)}"/>` +
      `<line x1="0" y1="${springline}" x2="${W}" y2="${springline}" stroke-width="${Math.max(2, W / 110)}"/>` +
      [30, 60, 90, 120, 150]
        .map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = (cx - Math.cos(rad) * cx).toFixed(1);
          const y = (springline - Math.sin(rad) * cx).toFixed(1);
          return `<line x1="${cx}" y1="${springline}" x2="${x}" y2="${y}" stroke-width="${Math.max(1.5, W / 160)}"/>`;
        })
        .join('') +
      `</g>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ${attrs}>` +
    `<defs>` +
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${p.top}"/><stop offset="0.55" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.low}"/>` +
    `</linearGradient>` +
    `<radialGradient id="${id}-a" cx="${0.22 + shift}" cy="0.72" r="0.55">` +
    `<stop offset="0" stop-color="${p.glowA}" stop-opacity="0.85"/><stop offset="1" stop-color="${p.glowA}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="${id}-b" cx="${0.82 - shift}" cy="0.35" r="0.5">` +
    `<stop offset="0" stop-color="${p.glowB}" stop-opacity="0.7"/><stop offset="1" stop-color="${p.glowB}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="${id}-sun" cx="0.5" cy="1.02" r="0.62">` +
    `<stop offset="0" stop-color="${p.warm}" stop-opacity="0.95"/><stop offset="0.45" stop-color="${p.warm}" stop-opacity="0.35"/><stop offset="1" stop-color="${p.warm}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}-a)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}-b)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}-sun)"/>` +
    (showWindow ? windowOutline(W, H) : '') +
    bars +
    `</svg>`
  );
}
