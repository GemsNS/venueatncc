/** Capacity rules shared by the wizard, the demo backend, and the API server. */
import type { SpaceChoice } from './types';

export const CAPACITY: Record<SpaceChoice, number> = { indoor: 100, outdoor: 150, both: 150 };

const LABEL: Record<SpaceChoice, string> = {
  indoor: 'The indoor hall',
  outdoor: 'The outdoor space',
  both: 'The venue',
};

/** A plain-language error when the guest count is over the space's capacity, else null. */
export function capacityError(space: SpaceChoice, guests: number): string | null {
  const max = CAPACITY[space];
  if (guests <= max) return null;
  if (space === 'indoor' && guests <= CAPACITY.outdoor) {
    return `The indoor hall holds up to ${max} guests. The outdoor space holds up to ${CAPACITY.outdoor}.`;
  }
  return `${LABEL[space]} holds up to ${max} guests. For a larger event, call us to talk it through.`;
}

/** The smallest space that fits a guest count, or null when nothing fits. */
export function suggestSpace(guests: number): SpaceChoice | null {
  if (guests <= CAPACITY.indoor) return 'indoor';
  if (guests <= CAPACITY.outdoor) return 'outdoor';
  return null;
}
