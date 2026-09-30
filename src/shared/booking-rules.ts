/**
 * Booking rules the public site enforces: the day types and each one's minimum hours. These are rules,
 * not prices, so the booking wizard, the inquiry form, and llms.txt import them from here and never from
 * ./pricing, which keeps the internal rate card out of every public bundle. ./pricing reads the same
 * values for its estimate, so the two cannot drift.
 */
import { dayOfWeek } from './dates';
import type { DateKey } from './types';

export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

export const dayTypes: Record<DayType, { label: string; days: number[] }> = {
  weekday: { label: 'Monday to Thursday', days: [1, 2, 3, 4] },
  friday: { label: 'Friday', days: [5] },
  saturday: { label: 'Saturday', days: [6] },
  sunday: { label: 'Sunday', days: [0] },
};

export const minimumHours: Record<DayType, number> = { weekday: 2, friday: 4, saturday: 5, sunday: 3 };

export function dayTypeOf(date: DateKey, types: Record<DayType, { days: number[] }> = dayTypes): DayType {
  const dow = dayOfWeek(date);
  for (const [id, def] of Object.entries(types) as [DayType, { days: number[] }][]) {
    if (def.days.includes(dow)) return id;
  }
  return 'weekday';
}
