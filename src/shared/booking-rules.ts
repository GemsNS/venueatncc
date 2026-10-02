/**
 * Booking rules the public site enforces: the days and hours the building is open for events, the day
 * types, and each one's minimum hours. These are rules, not prices, so the booking wizard, the inquiry
 * form, and llms.txt import them from here and never from ./pricing, which keeps the internal rate card
 * out of every public bundle. ./pricing reads the same values for its estimate, so the two cannot drift.
 *
 * Confirmed by the owner: building access Monday to Saturday, 9:00 AM to 12:00 midnight. No Sundays.
 */
import { dayOfWeek } from './dates';
import type { DateKey } from './types';

export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

/**
 * Sunday stays a day type for the internal rate card and for older requests, but the site never
 * offers a Sunday (isClosedDay).
 */
export const dayTypes: Record<DayType, { label: string; days: number[] }> = {
  weekday: { label: 'Monday to Thursday', days: [1, 2, 3, 4] },
  friday: { label: 'Friday', days: [5] },
  saturday: { label: 'Saturday', days: [6] },
  sunday: { label: 'Sunday', days: [0] },
};

/** The day types a client can book, in week order. */
export const OPEN_DAY_TYPES: DayType[] = ['weekday', 'friday', 'saturday'];

export const minimumHours: Record<DayType, number> = { weekday: 2, friday: 4, saturday: 5, sunday: 3 };

export function dayTypeOf(date: DateKey, types: Record<DayType, { days: number[] }> = dayTypes): DayType {
  const dow = dayOfWeek(date);
  for (const [id, def] of Object.entries(types) as [DayType, { days: number[] }][]) {
    if (def.days.includes(dow)) return id;
  }
  return 'weekday';
}

/** Days of the week the building is closed for events (0 = Sunday). */
export const CLOSED_WEEKDAYS = [0];

/** True when the building is closed for events on this date (every Sunday). */
export const isClosedDay = (date: DateKey) => CLOSED_WEEKDAYS.includes(dayOfWeek(date));

/** Building access: events start at 9:00 AM at the earliest and end by 12:00 midnight. */
export const OPENS_AT = '09:00';
export const OPENS_HOUR = 9;
export const CLOSES_HOUR = 24;

/** The access hours in words, as the site states them. */
export const ACCESS_DAYS = 'Monday to Saturday';
export const ACCESS_TIMES = '9:00 AM to 12:00 midnight';
export const ACCESS_HOURS = `${ACCESS_DAYS}, ${ACCESS_TIMES}`;

/**
 * The one rule for setup and cleanup, used word for word by the FAQ, Rates, and the booking page: the hours a
 * guest books are the whole time in the building (src/shared/types.ts, "total rental hours including setup
 * and cleanup").
 */
export const SETUP_CLEANUP_RULE = 'Your booked hours include time to set up and clean up.';

export const CLOSED_DAY_MESSAGE = 'We are closed on Sundays. Choose a date from Monday to Saturday.';
export const START_TOO_EARLY_MESSAGE = 'Choose a start time from 9:00 AM on.';
export const ENDS_TOO_LATE_MESSAGE = 'Events end by 12:00 midnight. Choose an earlier start time or fewer hours.';

/** Minutes after midnight for "HH:MM". */
export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Whether a start time is within building hours (9:00 AM or later). */
export const startsInHours = (startTime: string) => minutesOf(startTime) >= OPENS_HOUR * 60;

/** Whether an event that starts at startTime and runs this many hours ends by 12:00 midnight. */
export const endsInHours = (startTime: string, hours: number) => minutesOf(startTime) + Math.round(hours * 60) <= CLOSES_HOUR * 60;

/** The most whole hours that fit between a start time and 12:00 midnight. */
export const maxHoursFrom = (startTime: string) => Math.floor((CLOSES_HOUR * 60 - minutesOf(startTime)) / 60);
