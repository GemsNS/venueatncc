/**
 * The event types, light enough to ship to the browser (booking wizard, inquiry form, admin).
 * The long-form page copy for each lives in src/data/events.ts; slugs must match.
 */
import type { IconName } from '../shared/icons';

export interface EventTypeLite {
  slug: string;
  name: string;
  icon: IconName;
}

export const eventTypes: EventTypeLite[] = [
  { slug: 'weddings', name: 'Weddings & receptions', icon: 'heart' },
  { slug: 'receptions-banquets', name: 'Banquets & anniversaries', icon: 'sparkles' },
  { slug: 'baby-bridal-showers', name: 'Baby & bridal showers', icon: 'gift' },
  { slug: 'birthday-parties', name: 'Birthdays & milestones', icon: 'cake' },
  { slug: 'repasts-memorials', name: 'Repasts & celebrations of life', icon: 'flower' },
  { slug: 'meetings-trainings', name: 'Meetings & workshops', icon: 'briefcase' },
  { slug: 'graduations-reunions', name: 'Graduations & reunions', icon: 'graduation-cap' },
  { slug: 'community-events', name: 'Community events', icon: 'users' },
];

export const OTHER_EVENT = { slug: 'other', name: 'Something else', icon: 'party-popper' as IconName };

export function eventTypeName(slug: string, other?: string): string {
  if (slug === 'other') return other ? `Other: ${other}` : 'Other event';
  return eventTypes.find((e) => e.slug === slug)?.name ?? slug;
}
