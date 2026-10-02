/**
 * The occasions the venue hosts, each a compact block on the one events page, /events/#<slug>
 * (docs/design/redesign-v7.md, "Version 8"). Slugs and names must match src/data/event-types.ts. The old
 * event pages, /events/<slug>/, answer 301 to /events/#<slug> (MOVED_PAGES in server/static.ts).
 *
 * Copy rules (docs/design/brand.md, "Voice" and "Redundancy rules"):
 * - One or two short sentences in plain words. No exclamation marks, no em or en dashes.
 * - Never mention alcohol or drinks, catering, menus, kitchens, or bringing your own anything. Catering
 *   appears only in one FAQ entry on Rates & FAQ.
 * - The venue is a stand-alone business (brand.md, "Separation"): no copy connects it to a church.
 * - Describe only what the photos and the owner's copy confirm, and never a gazebo roof material.
 * - No capacities, prices, hours, deposits, parking, or visits: each has one home elsewhere.
 * - Never state how far ahead to book or plan a date.
 * - Never describe guests walking between spaces or to their cars.
 * - `spaces` lists the spaces that suit the occasion, the most suitable first. The page links each to its
 *   section on The Space.
 */
import type { SpaceId } from './site';

export interface EventType {
  slug: string;
  /** Display name, e.g. "Weddings & receptions". */
  name: string;
  /** One or two sentences: the block's copy, the llms.txt line, and nothing else. */
  summary: string;
  /** The spaces that suit the occasion, the most suitable first. */
  spaces: SpaceId[];
}

export const events: EventType[] = [
  {
    slug: 'weddings',
    name: 'Weddings & receptions',
    summary:
      'Say your vows at the timber gazebo in The Pine Garden or at the front of The Stage Hall, and hold the reception in The Fireside Room or outdoors among the pines.',
    spaces: ['outdoor', 'indoor', 'main'],
  },
  {
    slug: 'receptions-banquets',
    name: 'Banquets & anniversaries',
    summary: 'Anniversary dinners, awards banquets, and formal evenings, with the fireplace wall of The Fireside Room behind the head table.',
    spaces: ['indoor', 'outdoor'],
  },
  {
    slug: 'baby-bridal-showers',
    name: 'Baby & bridal showers',
    summary: 'Baby showers, bridal showers, and gender reveals in a bright room with a natural backdrop for the gifts and photos.',
    spaces: ['indoor', 'outdoor'],
  },
  {
    slug: 'birthday-parties',
    name: 'Birthdays & milestones',
    summary: 'First birthdays, sweet sixteens, milestone birthdays, and retirement parties, indoors or on the lawn.',
    spaces: ['indoor', 'outdoor'],
  },
  {
    slug: 'repasts-memorials',
    name: 'Repasts & celebrations of life',
    summary: 'A calm, dignified room where family and friends can gather after a service and share memories.',
    spaces: ['indoor', 'outdoor'],
  },
  {
    slug: 'meetings-trainings',
    name: 'Meetings & workshops',
    summary: 'Board meetings, trainings, and workshops in one open room with daylight, or a presentation facing the stage.',
    spaces: ['indoor', 'main'],
  },
  {
    slug: 'graduations-reunions',
    name: 'Graduations & reunions',
    summary: 'Graduation parties and family or class reunions with room to spread out: open lawn, picnic tables, and the gazebo for a group photo.',
    spaces: ['outdoor', 'indoor'],
  },
  {
    slug: 'community-events',
    name: 'Community events',
    summary: 'Conferences, civic forums, and neighborhood days, with rows of seating facing the stage or a picnic under the pines.',
    spaces: ['main', 'outdoor'],
  },
];
