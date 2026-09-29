/**
 * The venue's rate card and the estimate calculator.
 *
 * One model drives everything: the rates page, the booking wizard's instant estimate,
 * the server's stored estimate for each inquiry, and `priceRange` in structured data.
 *
 * STATUS: recommended rates from the Hampton Roads comparables analysis. The venue team
 * should confirm them before launch. Change a number here and every page follows.
 */
import { SPACE_NAME } from './capacity';
import { dayOfWeek, daysBetween, todayKey } from './dates';
import type { DateKey, Estimate, EstimateLine, SpaceChoice } from './types';

export type DayType = 'weekday' | 'friday' | 'saturday' | 'sunday';

export interface PricingPackage {
  id: string;
  name: string;
  /**
   * What the package suits, when there is something to say. The pricing page already shows the day,
   * the space, and the hours beside it, so the description never repeats them. Omit it otherwise.
   */
  description?: string;
  space: SpaceChoice;
  dayType: DayType | 'any';
  hours: number;
  price: number;
}

export interface PricingDiscount {
  id: string;
  /** The line in an estimate and on the rates page. */
  label: string;
  /** Who qualifies, as the subject of a sentence, e.g. "Nonprofits and churches". Defaults to the label. */
  who?: string;
  /** When it applies, e.g. "Sunday to Thursday", for "... for events Sunday to Thursday". */
  when?: string;
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
  introOffer: IntroOffer | null;
}

export interface IntroOffer {
  /** Its name, e.g. "Founding rate". The estimate line reads "<name>, <percent>% off the rental". */
  name: string;
  /** The condition, completing "20% off the rental ...", e.g. "when you book by March 31, 2027". */
  terms: string;
  percent: number;
  validUntil: DateKey;
}

/** The estimate line for an introductory offer: "Founding rate, 20% off the rental". */
export const introOfferLabel = (o: IntroOffer) => `${o.name}, ${o.percent}% off the rental`;

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
  // The public names, the same as SPACE_NAME in ./capacity and SPACE_NAMES in ./types, which the
  // booking app, the admin, the emails, and the CSV export use.
  spaces: {
    indoor: { label: SPACE_NAME.indoor, capacity: 100 },
    outdoor: { label: SPACE_NAME.outdoor, capacity: 150 },
    // 150 for 'both' is an internal validation ceiling (the larger space), NOT a published combined
    // capacity. Never display it; show capacityLabel('both') from ./capacity instead.
    both: { label: SPACE_NAME.both, capacity: 150 },
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
    { id: 'sat-indoor-6', name: 'Saturday Hall Block', description: 'Suited to receptions, showers, and banquets.', space: 'indoor', dayType: 'saturday', hours: 6, price: 900 },
    { id: 'sat-outdoor-6', name: 'Saturday Grove Block', description: 'Suited to ceremonies, reunions, and graduation parties.', space: 'outdoor', dayType: 'saturday', hours: 6, price: 800 },
    { id: 'sat-both-6', name: 'Saturday Hall and Grove Block', description: 'The Hall is available as a rain plan.', space: 'both', dayType: 'saturday', hours: 6, price: 1250 },
    { id: 'sat-indoor-12', name: 'Saturday Full Day, Hall', description: 'For a long program or a full day of events.', space: 'indoor', dayType: 'saturday', hours: 12, price: 1500 },
    { id: 'sat-outdoor-12', name: 'Saturday Full Day, Grove', description: 'For an all-day reunion or community day.', space: 'outdoor', dayType: 'saturday', hours: 12, price: 1400 },
    { id: 'sat-both-12', name: 'Saturday Wedding and Celebration Day', description: 'A ceremony in The Grove and a reception in either space.', space: 'both', dayType: 'saturday', hours: 12, price: 2200 },
    { id: 'fri-indoor-6', name: 'Friday Hall Block', space: 'indoor', dayType: 'friday', hours: 6, price: 700 },
    { id: 'fri-outdoor-6', name: 'Friday Grove Block', space: 'outdoor', dayType: 'friday', hours: 6, price: 650 },
    { id: 'fri-both-6', name: 'Friday Hall and Grove Block', space: 'both', dayType: 'friday', hours: 6, price: 1000 },
    { id: 'fri-both-12', name: 'Friday Full Day, Hall and Grove', description: 'Suited to weddings and receptions.', space: 'both', dayType: 'friday', hours: 12, price: 1800 },
    { id: 'sun-indoor-6', name: 'Sunday Hall Block', space: 'indoor', dayType: 'sunday', hours: 6, price: 650 },
    { id: 'sun-outdoor-6', name: 'Sunday Grove Block', space: 'outdoor', dayType: 'sunday', hours: 6, price: 550 },
    { id: 'sun-both-6', name: 'Sunday Hall and Grove Block', space: 'both', dayType: 'sunday', hours: 6, price: 900 },
    { id: 'weekday-indoor-8', name: 'Weekday Full Day, Hall', description: 'Suited to trainings and retreats.', space: 'indoor', dayType: 'weekday', hours: 8, price: 600 },
  ],
  fees: { cleaning: 100, damageDepositRefundable: 250 },
  bookingDeposit: { type: 'percent', value: 50, balanceDueDaysBefore: 30 },
  discounts: [
    { id: 'repast', label: 'Repast and celebration of life rate', percent: 25, appliesTo: 'eventType:repasts-memorials' },
    { id: 'weekday-daytime', label: 'Weekday daytime, Monday to Thursday, ending by 4 PM', percent: 20, appliesTo: 'manual' },
    {
      id: 'nonprofit',
      label: 'Nonprofits and churches, Sunday to Thursday',
      who: 'Nonprofits and churches',
      when: 'Sunday to Thursday',
      percent: 15,
      appliesTo: 'manual',
    },
    { id: 'military', label: 'Military, veterans, and first responders', percent: 10, appliesTo: 'manual' },
  ],
  introOffer: { name: 'Founding rate', terms: 'when you book by March 31, 2027', percent: 20, validUntil: '2027-03-31' },
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
  // Below the day's minimum, the line says why it bills more hours than were asked for.
  let rentalLabel =
    billableHours > hours
      ? `${SPACE_NAME[input.space]}, ${model.dayTypes[dayType].label} minimum of ${billableHours} hours at $${rate} an hour`
      : `${SPACE_NAME[input.space]}, ${billableHours} hours at $${rate} an hour`;
  let packageName: string | undefined;

  for (const p of model.packages) {
    if (p.space !== input.space) continue;
    if (p.dayType !== 'any' && p.dayType !== dayType) continue;
    const extra = Math.max(0, hours - p.hours);
    const price = p.price + extra * rate;
    if (price < rental) {
      rental = price;
      packageName = p.name;
      rentalLabel = extra > 0 ? `${p.name}, ${p.hours} hours, plus ${extra} extra ${extra === 1 ? 'hour' : 'hours'} at $${rate} an hour` : `${p.name}, ${p.hours} hours`;
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
    applicable.push({ label: introOfferLabel(model.introOffer), percent: model.introOffer.percent });
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

  // Notes are about this estimate only. What every rental includes (parking) is stated once per page by
  // the page itself: the Included card on /pricing/ and "Good to know" in the booking wizard.
  const notes: string[] = [];
  if (billableHours > hours) notes.push(`${model.dayTypes[dayType].label} bookings have a ${minHours}-hour minimum.`);
  if (applicable.length > 1) notes.push('Discounts do not combine, so your estimate uses the best one.');
  if (model.bookingDeposit.balanceDueDaysBefore > 0) {
    notes.push(
      payInFull
        ? `Your event is within ${model.bookingDeposit.balanceDueDaysBefore} days, so the full amount is due when you reserve.`
        : `Balance due ${model.bookingDeposit.balanceDueDaysBefore} days before your event.`,
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
