/**
 * The lockup's geometry (src/assets/brand/venue-lockup.svg), shared by Logo.astro and the home page morph.
 *
 * The lockup is 533 by 100 units: the ring and its V fill the first 100 units, and the two words' outlines
 * span x 125.54 to 526.98 and y 23.86 to 76.38. NAME_BOX is a box just around the words; the 'lockup-name'
 * variant of Logo uses it as its viewBox, so a welcome name drawn at any size lines up with the header
 * lockup's words once it is scaled by the ratio of the two heights.
 */
export const LOCKUP = { width: 533, height: 100 } as const;
export const NAME_BOX = { x: 125, y: 23, width: 402.5, height: 54 } as const;
export const RING_BOX = { x: 0, y: 0, width: 100, height: 100 } as const;
