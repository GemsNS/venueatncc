/**
 * The venue's rate card, confirmed by the owner in October 2026 and published on the site since 2026-10-23
 * (Rates & FAQ, the home page essentials, llms.txt, and the venue's structured data). The server and the demo
 * price requests with it, and the pages show PUBLIC_RATES.
 * PRICING_NOTES are Faith's notes, word for word apart from spelling
 * ("high seasons", the busy seasons). Food and decoration are not included. The owner set no cleaning fee,
 * damage deposit, deposit amount, or discounts, so the card has none and the team views leave those rows out.
 */
import { dayTypes, minimumHours } from './booking-rules';
import { SPACES_FOR_PRICING, allDays, estimate, type EstimateInput, type PricingModel } from './pricing';
import { todayKey } from './dates';
import type { DateKey, Estimate } from './types';

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

/** The rates as the site shows them, in the owner's terms. Every figure is a starting price. */
export const PUBLIC_RATES: { name: string; price: string; detail: string }[] = [
  { name: 'Hourly, high seasons', price: 'From $250 an hour', detail: 'For a maximum of 4 hours.' },
  { name: 'Flat rate package', price: 'From $2,500', detail: 'A block of up to 6 to 8 hours.' },
  { name: 'Full day or evening', price: '$2,995 to $3,995+', detail: 'A flat block rate per event, instead of strict hourly rates.' },
];

/** What every rate leaves out, and how a date's rate is set. */
export const RATES_FINE_PRINT = 'Food and decoration are not included. Rates vary with the season and the day, so call us for the rate for your date.';

/** One sentence for the home page and llms.txt. */
export const RATES_SUMMARY = 'From $250 an hour in high seasons (up to 4 hours), $2,500 for a flat rate package of up to 6 to 8 hours, or $2,995 to $3,995+ for a full day or evening.';

/** schema.org priceRange for the venue. */
export const PRICE_RANGE = '$250 to $3,995+';
