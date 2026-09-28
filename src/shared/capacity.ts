/**
 * Capacity rules shared by the wizard, the demo backend, and the API server.
 *
 * Confirmed: the indoor hall holds up to 100 guests and the outdoor space up to 150.
 * NOT confirmed: any combined figure. When a host books both spaces, the guest count still
 * cannot exceed the larger space (150), and copy must describe each space's own limit rather
 * than a single number for "both".
 */
import type { SpaceChoice } from './types';

export const CAPACITY: Record<SpaceChoice, number> = { indoor: 100, outdoor: 150, both: 150 };

/** Plain-language capacity for a space choice, safe to show anywhere. */
export function capacityLabel(space: SpaceChoice): string {
  if (space === 'indoor') return `Up to ${CAPACITY.indoor} guests`;
  if (space === 'outdoor') return `Up to ${CAPACITY.outdoor} guests`;
  return `Indoor up to ${CAPACITY.indoor}, outdoor up to ${CAPACITY.outdoor}`;
}

/** A plain-language error when the guest count is over the space's capacity, else null. */
export function capacityError(space: SpaceChoice, guests: number): string | null {
  const max = CAPACITY[space];
  if (guests <= max) return null;
  if (space === 'indoor' && guests <= CAPACITY.outdoor) {
    return `The indoor hall holds up to ${CAPACITY.indoor} guests. The outdoor space holds up to ${CAPACITY.outdoor}.`;
  }
  if (space === 'both') {
    return `The outdoor space holds up to ${CAPACITY.outdoor} guests and the indoor hall up to ${CAPACITY.indoor}. For a larger event, call us to talk it through.`;
  }
  return `The ${space === 'indoor' ? 'indoor hall' : 'outdoor space'} holds up to ${max} guests. For a larger event, call us to talk it through.`;
}

/** The smallest space that fits a guest count, or null when nothing fits. */
export function suggestSpace(guests: number): SpaceChoice | null {
  if (guests <= CAPACITY.indoor) return 'indoor';
  if (guests <= CAPACITY.outdoor) return 'outdoor';
  return null;
}
