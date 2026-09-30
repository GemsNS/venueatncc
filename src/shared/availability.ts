/**
 * Turn calendar blocks into public availability. Shared by the API server and the demo backend
 * so both calendars behave identically.
 */
import { isClosedDay } from './booking-rules';
import { addDays, daysBetween, todayKey } from './dates';
import { SINGLE_SPACE_IDS, spaceParts } from './types';
import type { AvailabilityDay, CalendarBlock, DateKey, SingleSpace, SpaceChoice } from './types';

export const MAX_RANGE_DAYS = 400;

export function availabilityFor(from: DateKey, to: DateKey, blocks: Pick<CalendarBlock, 'date' | 'space'>[], today: DateKey = todayKey()): AvailabilityDay[] {
  const span = Math.min(daysBetween(from, to), MAX_RANGE_DAYS);
  const byDate = new Map<DateKey, Set<SingleSpace>>();
  for (const b of blocks) {
    const set = byDate.get(b.date) ?? new Set();
    for (const p of spaceParts(b.space)) set.add(p);
    byDate.set(b.date, set);
  }
  const days: AvailabilityDay[] = [];
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    const taken = byDate.get(date) ?? new Set();
    const spaces = Object.fromEntries(SINGLE_SPACE_IDS.map((s) => [s, taken.has(s) ? 'taken' : 'free'])) as AvailabilityDay['spaces'];
    const takenCount = SINGLE_SPACE_IDS.filter((s) => spaces[s] === 'taken').length;
    let status: AvailabilityDay['status'] = 'open';
    if (date < today) status = 'past';
    else if (isClosedDay(date)) status = 'closed';
    else if (takenCount === SINGLE_SPACE_IDS.length) status = 'booked';
    else if (takenCount > 0) status = 'partial';
    days.push({ date, status, spaces });
  }
  return days;
}

/** Whether a requested space is free on a given day. Never on a past or closed day. */
export function spaceIsFree(day: AvailabilityDay | undefined, space: SpaceChoice): boolean {
  if (!day || day.status === 'past' || day.status === 'closed') return false;
  return spaceParts(space).every((p) => day.spaces[p] === 'free');
}
