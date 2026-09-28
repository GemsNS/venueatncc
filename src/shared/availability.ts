/**
 * Turn calendar blocks into public availability. Shared by the API server and the demo backend
 * so both calendars behave identically.
 */
import { addDays, daysBetween, todayKey } from './dates';
import type { AvailabilityDay, CalendarBlock, DateKey, SpaceChoice } from './types';

export const MAX_RANGE_DAYS = 400;

export function availabilityFor(from: DateKey, to: DateKey, blocks: Pick<CalendarBlock, 'date' | 'space'>[], today: DateKey = todayKey()): AvailabilityDay[] {
  const span = Math.min(daysBetween(from, to), MAX_RANGE_DAYS);
  const byDate = new Map<DateKey, Set<'indoor' | 'outdoor'>>();
  for (const b of blocks) {
    const set = byDate.get(b.date) ?? new Set();
    if (b.space === 'both' || b.space === 'indoor') set.add('indoor');
    if (b.space === 'both' || b.space === 'outdoor') set.add('outdoor');
    byDate.set(b.date, set);
  }
  const days: AvailabilityDay[] = [];
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    const taken = byDate.get(date) ?? new Set();
    const indoor = taken.has('indoor') ? 'taken' : 'free';
    const outdoor = taken.has('outdoor') ? 'taken' : 'free';
    let status: AvailabilityDay['status'] = 'open';
    if (date < today) status = 'past';
    else if (indoor === 'taken' && outdoor === 'taken') status = 'booked';
    else if (indoor === 'taken' || outdoor === 'taken') status = 'partial';
    days.push({ date, status, spaces: { indoor, outdoor } });
  }
  return days;
}

/** Whether a requested space is free on a given day. */
export function spaceIsFree(day: AvailabilityDay | undefined, space: SpaceChoice): boolean {
  if (!day || day.status === 'past') return false;
  if (space === 'both') return day.spaces.indoor === 'free' && day.spaces.outdoor === 'free';
  return day.spaces[space] === 'free';
}
