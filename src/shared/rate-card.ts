/**
 * The venue's rate card, set by the owner (first published 2026-10-23, updated 2026-11-10 to $375 an hour for
 * up to 5 hours, a $3,500 flat rate package for up to 9 hours, and $4,500 for a full day-evening). It is shown on
 * Rates & FAQ, the home page essentials, llms.txt, and the venue's structured data. The server and the demo
 * price requests with it, and the pages show PUBLIC_RATES.
 * Food, decoration, and cleanup fees are not included, and rates vary with the season and the day; that is said
 * once, after the rates (RATES_FINE_PRINT). The owner set no cleanup fee amount, damage deposit, deposit amount,
 * or discounts, so the card has none and the team views leave those rows out.
 */
import { dayTypes, minimumHours } from './booking-rules';
import { SPACES_FOR_PRICING, allDays, estimate, type EstimateInput, type PricingModel } from './pricing';
import { todayKey } from './dates';
import type { DateKey, Estimate } from './types';

/** What every rate leaves out, and how a date's rate is set. Said once, after the rates, never under each one. */
export const RATES_FINE_PRINT = 'Food, decoration, and cleanup fees are not included. Rates vary with the season and the day, so call us for the rate for your date!';

export const PRICING_NOTES: string[] = [
  'Hourly rate: $375 per hour, up to a maximum of 5 hours.',
  'Flat rate package: a block of up to 9 hours, $3,500.',
  'Full day-evening: a flat rate per event instead of strict hourly rates, $4,500.',
  RATES_FINE_PRINT,
];

export const pricing: PricingModel = {
  status: 'confirmed',
  currency: 'USD',
  spaces: SPACES_FOR_PRICING,
  // Booking rules, shared with the public site through src/shared/booking-rules.
  dayTypes,
  // One hourly rate for every space and day.
  hourly: { indoor: allDays(375), main: allDays(375), outdoor: allDays(375), both: allDays(375) },
  minimumHours,
  packages: [],
  // Cleanup fees are not included in the rates, but the owner set no amount, so no fee line is added.
  fees: { cleaning: 0, damageDepositRefundable: 0 },
  bookingDeposit: { type: 'flat', value: 0, balanceDueDaysBefore: 0 },
  discounts: [],
  introOffer: null,
  hourlyMaxHours: 5,
  flatPackage: { name: 'Flat rate package', hours: 9, price: 3500, detail: 'a block of up to 9 hours, $3,500' },
  fullDayBlock: { name: 'Full day-evening flat rate', from: 4500, detail: 'a flat rate per event, $4,500' },
  notes: PRICING_NOTES,
};

/** The estimate against the real card. */
export const estimateWithRates = (input: EstimateInput, today: DateKey = todayKey()): Estimate => estimate(input, pricing, today);

/** The rates as the site shows them, in the owner's terms and order. */
export const PUBLIC_RATES: { name: string; price: string; detail: string }[] = [
  { name: 'Hourly rate', price: '$375 per hour', detail: 'Up to a maximum of 5 hours.' },
  { name: 'Flat rate package', price: '$3,500', detail: 'A block of up to 9 hours.' },
  { name: 'Full day-evening', price: '$4,500', detail: 'A flat rate per event, instead of strict hourly rates.' },
];

/** One sentence for the home page and llms.txt. */
export const RATES_SUMMARY = '$375 per hour (up to 5 hours), a flat rate package of up to 9 hours for $3,500, or $4,500 for a full day-evening.';

/** schema.org priceRange for the venue. */
export const PRICE_RANGE = '$375 to $4,500';
