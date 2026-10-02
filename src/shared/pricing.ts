/**
 * The venue's internal rate card and the estimate calculator. INTERNAL USE ONLY.
 *
 * The venue does not publish prices. Nothing here may reach a public page, a booking step, a guest
 * email, structured data, llms.txt, or a share card: the public wording is "Our affordable rates vary
 * with peak season, holidays, and the day of the week. For pricing and special offers, please call us
 * and we will be happy to help you." (RATES_WORDING in src/data/faq.ts).
 *
 * What still reads it: the server's stored estimate for each inquiry, shown to the team as the
 * "Internal rate-card guide" in the team email and the admin; and, as booking rules rather than prices,
 * the day types and minimum hours the booking wizard enforces.
 *
 * STATUS: recommended rates from the Hampton Roads comparables analysis. The venue team
 * should confirm them before relying on the internal guide.
 */
import { SPACE_NAME } from './capacity';
import { daysBetween, todayKey } from './dates';
import { BALANCE_DUE_DAYS_BEFORE } from './money';
import { dayTypeOf as ruleDayTypeOf, dayTypes, minimumHours, type DayType } from './booking-rules';
import type { DateKey, Estimate, EstimateLine, SpaceChoice } from './types';

export type { DayType };

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
    main: { label: SPACE_NAME.main, capacity: 100 },
    outdoor: { label: SPACE_NAME.outdoor, capacity: 150 },
    // 150 for 'both' is an internal validation ceiling (the larger space), NOT a published combined
    // capacity. Never display it; show capacityLabel('both') from ./capacity instead.
    both: { label: SPACE_NAME.both, capacity: 150 },
  },
  // Booking rules, shared with the public site through ./booking-rules.
  dayTypes,
  hourly: {
    indoor: { weekday: 100, friday: 130, saturday: 160, sunday: 120 },
    // The Main Hall: the same guide as The Hall until the venue team sets its own rates.
    main: { weekday: 100, friday: 130, saturday: 160, sunday: 120 },
    outdoor: { weekday: 85, friday: 115, saturday: 140, sunday: 100 },
    both: { weekday: 140, friday: 180, saturday: 220, sunday: 165 },
  },
  minimumHours,
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
  bookingDeposit: { type: 'percent', value: 50, balanceDueDaysBefore: BALANCE_DUE_DAYS_BEFORE },
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
  introOffer: { name: 'Founding rate', percent: 20, validUntil: '2027-03-31' },
};


export function dayTypeOf(date: DateKey, model: PricingModel = pricing): DayType {
  return ruleDayTypeOf(date, model.dayTypes);
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
  // the page itself: "What the rental includes" on The Space.
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

export { formatUSD } from './money';
