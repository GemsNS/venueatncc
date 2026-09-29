/**
 * Capacity rules shared by the wizard, the demo backend, and the API server.
 *
 * Confirmed: The Hall (the indoor space, slug 'indoor') holds up to 100 guests and The Grove
 * (the outdoor space, slug 'outdoor') up to 150.
 * NOT confirmed: any combined figure. When a host books both spaces, the guest count still
 * cannot exceed the larger space (150), and copy must describe each space's own limit rather
 * than a single number for "both".
 */
import type { SpaceChoice } from './types';

export const CAPACITY: Record<SpaceChoice, number> = { indoor: 100, outdoor: 150, both: 150 };

/**
 * Public names for each space choice, as in src/data/site.ts and docs/design/brand.md.
 * The slugs stay 'indoor', 'outdoor', and 'both'.
 */
export const SPACE_NAME: Record<SpaceChoice, string> = { indoor: 'The Hall', outdoor: 'The Grove', both: 'The Hall and The Grove' };
const NAME = SPACE_NAME;

/**
 * Plain-language capacity for a space choice. The wording is always accurate (no combined figure for
 * 'both'), but each page states capacity once (brand.md, Redundancy rules): on /pricing/ and /book/
 * it belongs to the estimator and wizard controls, not to headings or package lines.
 */
export function capacityLabel(space: SpaceChoice): string {
  if (space === 'indoor') return `Up to ${CAPACITY.indoor} guests`;
  if (space === 'outdoor') return `Up to ${CAPACITY.outdoor} guests`;
  return `${NAME.indoor} up to ${CAPACITY.indoor}, ${NAME.outdoor} up to ${CAPACITY.outdoor}`;
}

/** A plain-language error when the guest count is over the space's capacity, else null. */
export function capacityError(space: SpaceChoice, guests: number): string | null {
  const max = CAPACITY[space];
  if (guests <= max) return null;
  if (space === 'indoor' && guests <= CAPACITY.outdoor) {
    return `${NAME.indoor} holds up to ${CAPACITY.indoor} guests. ${NAME.outdoor} holds up to ${CAPACITY.outdoor}.`;
  }
  if (space === 'both') {
    return `${NAME.outdoor} holds up to ${CAPACITY.outdoor} guests and ${NAME.indoor} up to ${CAPACITY.indoor}. For a larger event, please call us to discuss it.`;
  }
  return `${space === 'indoor' ? NAME.indoor : NAME.outdoor} holds up to ${max} guests. For a larger event, please call us to discuss it.`;
}

/** The smallest space that fits a guest count, or null when nothing fits. */
export function suggestSpace(guests: number): SpaceChoice | null {
  if (guests <= CAPACITY.indoor) return 'indoor';
  if (guests <= CAPACITY.outdoor) return 'outdoor';
  return null;
}
