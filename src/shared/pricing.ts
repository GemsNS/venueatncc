/**
 * The venue's rate card and the estimate calculator.
 *
 * One model drives everything: the rates page, the booking wizard's instant estimate,
 * the server's stored estimate for each inquiry, and `priceRange` in structured data.
 *
 * STATUS: recommended rates from the Hampton Roads comparables analysis. The venue team
 * should confirm them before launch. Change a number here and every page follows.
 */
import { dayOfWeek, daysBetween, todayKey } from './dates';
import type { DateKey, Estimate, EstimateLine, SpaceChoice } from './types';

export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

export interface PricingPackage {
  id: string;
  name: string;
  description: string;
  space: SpaceChoice;
  dayType: DayType | 'any';
  hours: number;
  price: number;
}

export interface PricingDiscount {
  id: string;
  label: string;
  percent: number;
  /** 'eventType:<slug>' and 'dayType:<type>' apply automatically; 'manual' is shown on the rates page only. */
  appliesTo: string;
}

export interface PricingModel {
  status: 'provisional' | 'recommended' | 'confirmed';
  currency: 'USD';
  spaces: Record<SpaceChoice, { label: string; capacity: number }>;
  dayTypes: Record<DayType, { label: string; days: number[] }>;
  hourly: Record<SpaceChoice, Record<DayType, number>>;
  minimumHours: Record<DayType, number>;
  packages: PricingPackage[];
  fees: { cleaning: number; damageDepositRefundable: number };
  bookingDeposit: { type: 'percent' | 'flat'; value: number; balanceDueDaysBefore: number };
  discounts: PricingDiscount[];
  introOffer: { label: string; percent: number; validUntil: DateKey } | null;
}

/**
 * Recommended from the September 2026 comparables analysis (47 distinct Hampton Roads venues plus
 * 5 market benchmarks): private venue-only halls for 75 to 100 guests rent for about $145 to $225
 * an hour on Saturdays ($870 to $1,350 for 6 hours, hall rental only, before fees and tax). This card
 * sits at the value end of that band, below the priced faith halls, with a founding discount to earn
 * first reviews.
 */
export const pricing: PricingModel = {
  status: 'recommended',
  currency: 'USD',
  spaces: {
    indoor: { label: 'Indoor hall', capacity: 100 },
    outdoor: { label: 'Outdoor space', capacity: 150 },
    // 150 for 'both' is an internal validation ceiling (the larger space), NOT a published combined
    // capacity. Never display it; show capacityLabel('both') from ./capacity instead.
    both: { label: 'Indoor and outdoor', capacity: 150 },
  },
  dayTypes: {
    weekday: { label: 'Monday to Thursday', days: [1, 2, 3, 4] },
    friday: { label: 'Friday', days: [5] },
    saturday: { label: 'Saturday', days: [6] },
    sunday: { label: 'Sunday', days: [0] },
  },
  hourly: {
    indoor: { weekday: 100, friday: 130, saturday: 160, sunday: 120 },
    outdoor: { weekday: 85, friday: 115, saturday: 140, sunday: 100 },
    both: { weekday: 140, friday: 180, saturday: 220, sunday: 165 },
  },
  minimumHours: { weekday: 2, friday: 4, saturday: 5, sunday: 3 },
  packages: [
    { id: 'sat-indoor-6', name: 'Saturday Indoor Block', description: 'The indoor hall for 6 hours. A fit for receptions, showers, and banquets.', space: 'indoor', dayType: 'saturday', hours: 6, price: 900 },
    { id: 'sat-outdoor-6', name: 'Saturday Outdoor Block', description: 'The outdoor space for 6 hours. A fit for ceremonies, reunions, and graduation parties.', space: 'outdoor', dayType: 'saturday', hours: 6, price: 800 },
    { id: 'sat-both-6', name: 'Saturday Indoor and Outdoor Block', description: 'Both spaces for 6 hours, with the hall as your rain plan for up to 100 guests.', space: 'both', dayType: 'saturday', hours: 6, price: 1250 },
    { id: 'sat-indoor-12', name: 'Saturday Full Day, Indoor', description: 'The indoor hall for up to 12 hours, for a long program or a full day of events.', space: 'indoor', dayType: 'saturday', hours: 12, price: 1500 },
    { id: 'sat-outdoor-12', name: 'Saturday Full Day, Outdoor', description: 'The outdoor space for up to 12 hours, for an all-day reunion or community day.', space: 'outdoor', dayType: 'saturday', hours: 12, price: 1400 },
    { id: 'sat-both-12', name: 'Saturday Wedding and Celebration Day', description: 'Both spaces for up to 12 hours: ceremony outside, reception inside or out.', space: 'both', dayType: 'saturday', hours: 12, price: 2200 },
    { id: 'fri-indoor-6', name: 'Friday Indoor Block', description: 'The indoor hall for 6 hours on a Friday.', space: 'indoor', dayType: 'friday', hours: 6, price: 700 },
    { id: 'fri-outdoor-6', name: 'Friday Outdoor Block', description: 'The outdoor space for 6 hours on a Friday.', space: 'outdoor', dayType: 'friday', hours: 6, price: 650 },
    { id: 'fri-both-6', name: 'Friday Indoor and Outdoor Block', description: 'Both spaces for 6 hours on a Friday.', space: 'both', dayType: 'friday', hours: 6, price: 1000 },
    { id: 'fri-both-12', name: 'Friday Full Day, Indoor and Outdoor', description: 'Both spaces for up to 12 hours. Good for Friday weddings and receptions.', space: 'both', dayType: 'friday', hours: 12, price: 1800 },
    { id: 'sun-indoor-6', name: 'Sunday Indoor Block', description: 'The indoor hall for 6 hours on a Sunday.', space: 'indoor', dayType: 'sunday', hours: 6, price: 650 },
    { id: 'sun-outdoor-6', name: 'Sunday Outdoor Block', description: 'The outdoor space for 6 hours on a Sunday.', space: 'outdoor', dayType: 'sunday', hours: 6, price: 550 },
    { id: 'sun-both-6', name: 'Sunday Indoor and Outdoor Block', description: 'Both spaces for 6 hours on a Sunday.', space: 'both', dayType: 'sunday', hours: 6, price: 900 },
    { id: 'weekday-indoor-8', name: 'Weekday Full Day, Indoor', description: 'The indoor hall for up to 8 hours, Monday to Thursday. Good for trainings and retreats.', space: 'indoor', dayType: 'weekday', hours: 8, price: 600 },
  ],
  fees: { cleaning: 100, damageDepositRefundable: 250 },
  bookingDeposit: { type: 'percent', value: 50, balanceDueDaysBefore: 30 },
  discounts: [
    { id: 'repast', label: 'Repast and celebration of life rate', percent: 25, appliesTo: 'eventType:repasts-memorials' },
    { id: 'weekday-daytime', label: 'Weekday daytime (Monday to Thursday, ending by 4 PM)', percent: 20, appliesTo: 'manual' },
    { id: 'nonprofit', label: 'Nonprofits and churches (Sunday to Thursday)', percent: 15, appliesTo: 'manual' },
    { id: 'military', label: 'Military, veterans, and first responders', percent: 10, appliesTo: 'manual' },
  ],
  introOffer: { label: 'Founding rate: 20% off the rental when you book by March 31, 2027', percent: 20, validUntil: '2027-03-31' },
};

/**
 * Market context from the comparables analysis, shown on the pricing page.
 * venueCount: 59 research entries, less 5 market benchmarks and 7 duplicate listings.
 * The Saturday band is private venue-only halls for 75 to 100 guests, hall rental only, before fees and tax.
 */
export const marketContext = {
  researched: 'September 2026',
  venueCount: 47,
  saturdaySixHourLow: 870,
  saturdaySixHourHigh: 1350,
  saturdayHourlyLow: 145,
  saturdayHourlyHigh: 225,
};

export function dayTypeOf(date: DateKey, model: PricingModel = pricing): DayType {
  const dow = dayOfWeek(date);
  for (const [id, def] of Object.entries(model.dayTypes) as [DayType, { days: number[] }][]) {
    if (def.days.includes(dow)) return id;
  }
  return 'weekday';
}

const money = (n: number) => Math.round(n);

export interface EstimateInput {
  date: DateKey;
  space: SpaceChoice;
  hours: number;
  eventType?: string;
}

/** Price an event. Picks whichever is cheaper for the host: hourly, or a matching package plus extra hours. */
export function estimate(input: EstimateInput, model: PricingModel = pricing, today: DateKey = todayKey()): Estimate {
  const dayType = dayTypeOf(input.date, model);
  const rate = model.hourly[input.space][dayType];
  const minHours = model.minimumHours[dayType];
  const hours = Math.max(1, Math.round(input.hours));
  const billableHours = Math.max(hours, minHours);

  let rental = rate * billableHours;
  let rentalLabel = `${model.spaces[input.space].label}, ${billableHours} hours at $${rate}/hour`;
  let packageName: string | undefined;

  for (const p of model.packages) {
    if (p.space !== input.space) continue;
    if (p.dayType !== 'any' && p.dayType !== dayType) continue;
    const extra = Math.max(0, hours - p.hours);
    const price = p.price + extra * rate;
    if (price < rental) {
      rental = price;
      packageName = p.name;
      rentalLabel = extra > 0 ? `${p.name} (${p.hours} hours) plus ${extra} extra hours at $${rate}/hour` : `${p.name} (${p.hours} hours)`;
    }
  }

  const lines: EstimateLine[] = [{ label: rentalLabel, amount: money(rental), kind: 'rental' }];
  let total = rental;

  if (model.fees.cleaning > 0) {
    lines.push({ label: 'Cleaning fee', amount: model.fees.cleaning, kind: 'fee' });
    total += model.fees.cleaning;
  }

  // Discounts do not combine: the host gets the single best one that applies.
  const applicable: { label: string; percent: number }[] = [];
  for (const d of model.discounts) {
    const [scope, value] = d.appliesTo.split(':');
    const applies = (scope === 'eventType' && value === input.eventType) || (scope === 'dayType' && value === dayType);
    if (applies && d.percent > 0) applicable.push({ label: d.label, percent: d.percent });
  }
  if (model.introOffer && model.introOffer.percent > 0 && today <= model.introOffer.validUntil) {
    applicable.push({ label: model.introOffer.label, percent: model.introOffer.percent });
  }
  const best = applicable.sort((a, b) => b.percent - a.percent)[0];
  if (best) {
    const off = money((rental * best.percent) / 100);
    lines.push({ label: best.label, amount: -off, kind: 'discount' });
    total -= off;
  }

  total = Math.max(0, money(total));
  const daysUntilEvent = daysBetween(today, input.date);
  // Inside the balance window there is no separate balance: the full amount reserves the date.
  const payInFull = model.bookingDeposit.balanceDueDaysBefore > 0 && daysUntilEvent <= model.bookingDeposit.balanceDueDaysBefore;
  const bookingDeposit = payInFull
    ? total
    : model.bookingDeposit.type === 'percent'
      ? money((total * model.bookingDeposit.value) / 100)
      : Math.min(total, model.bookingDeposit.value);

  const notes: string[] = [];
  if (billableHours > hours) notes.push(`${model.dayTypes[dayType].label} bookings have a ${minHours}-hour minimum.`);
  if (applicable.length > 1) notes.push('Discounts do not combine, so your estimate uses the best one.');
  notes.push('Catering is not included. Bring the caterer of your choice.');
  notes.push('On-site parking is included.');
  if (model.bookingDeposit.balanceDueDaysBefore > 0) {
    notes.push(
      payInFull
        ? `Your event is within ${model.bookingDeposit.balanceDueDaysBefore} days, so the full amount is due when you reserve.`
        : `The balance of ${formatUSD(total - bookingDeposit)} is due ${model.bookingDeposit.balanceDueDaysBefore} days before your event.`,
    );
  }
  notes.push('This is an estimate. We confirm your final quote.');

  return {
    currency: 'USD',
    dayType,
    dayTypeLabel: model.dayTypes[dayType].label,
    space: input.space,
    hours,
    billableHours,
    total,
    bookingDeposit,
    refundableDeposit: model.fees.damageDepositRefundable,
    lines,
    notes,
    packageName,
  };
}

/** Lowest and highest typical prices, for structured data priceRange and "from $X" copy. */
export function priceSummary(model: PricingModel = pricing): { fromHourly: number; lowestPackage: number | null } {
  const allHourly = Object.values(model.hourly).flatMap((byDay) => Object.values(byDay));
  const lowestPackage = model.packages.length > 0 ? Math.min(...model.packages.map((p) => p.price)) : null;
  return { fromHourly: Math.min(...allHourly), lowestPackage };
}

const MINUS = String.fromCharCode(0x2212);
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
/** Whole-dollar USD. Negative amounts use a true minus sign, e.g. for discounts. */
export const formatUSD = (n: number) => (n < 0 ? MINUS + usd.format(-n) : usd.format(n));
