/**
 * The venue's real rate card. INTERNAL USE ONLY, and server only: it is imported by the server and its tests,
 * never by anything under src/ that ships to a browser (the demo uses src/lib/api/demo-rate-card.ts).
 *
 * Confirmed by the owner in October 2026. PRICING_NOTES are Faith's notes, word for word apart from spelling
 * ("high seasons", the busy seasons). Food and decoration are not included. The owner set no cleaning fee,
 * damage deposit, deposit amount, or discounts, so the card has none and the team views leave those rows out.
 */
import { dayTypes, minimumHours } from '../src/shared/booking-rules';
import { SPACES_FOR_PRICING, allDays, estimate, type EstimateInput, type PricingModel } from '../src/shared/pricing';
import { todayKey } from '../src/shared/dates';
import type { DateKey, Estimate } from '../src/shared/types';

export const PRICING_NOTES: string[] = [
  'High seasons: venue rent starts at $250 per hour, for a maximum of 4 hours.',
  'Flat rate package: starts at $2,500 for a block of up to 6 to 8 hours.',
  'Full day or evening events: flat block rates instead of strict hourly rates, starting at $2,995 to $3,995+ per event.',
  'Food and decoration are not included.',
];

export const pricing: PricingModel = {
  status: 'confirmed',
  currency: 'USD',
  spaces: SPACES_FOR_PRICING,
  // Booking rules, shared with the public site through src/shared/booking-rules.
  dayTypes,
  // One starting rate for every space and day.
  hourly: { indoor: allDays(250), main: allDays(250), outdoor: allDays(250), both: allDays(250) },
  minimumHours,
  packages: [],
  fees: { cleaning: 0, damageDepositRefundable: 0 },
  bookingDeposit: { type: 'flat', value: 0, balanceDueDaysBefore: 0 },
  discounts: [],
  introOffer: null,
  hourlyMaxHours: 4,
  flatPackage: { name: 'Flat rate package', hours: 8, price: 2500, detail: 'a block of up to 6 to 8 hours, from $2,500' },
  fullDayBlock: { name: 'Full day or evening flat block', from: 2995, detail: 'from $2,995 to $3,995+' },
  notes: PRICING_NOTES,
};

/** The estimate against the real card. */
export const estimateWithRates = (input: EstimateInput, today: DateKey = todayKey()): Estimate => estimate(input, pricing, today);
