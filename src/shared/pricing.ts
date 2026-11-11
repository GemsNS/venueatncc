/**
 * The rate card's types and the estimate calculator.
 *
 * The rates are public since 2026-10-23: the pages show PUBLIC_RATES and RATES_FINE_PRINT from
 * src/shared/rate-card.ts. A per-request estimate is still internal: it never reaches a booking step or a
 * guest email.
 *
 * What reads it: the server's stored estimate for each inquiry, shown to the team as the
 * "Internal rate-card guide" in the team email and the admin; and, as booking rules rather than prices,
 * the day types and minimum hours the booking wizard enforces.
 *
 * The rate card itself is src/shared/rate-card.ts (confirmed by the owner, October 2026, public since
 * 2026-10-23). This file holds the types and the calculator.
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
  /** Hourly rates apply up to this many billable hours; longer events move to a flat block. */
  hourlyMaxHours: number;
  /** The flat rate package for events longer than hourlyMaxHours, up to its hours. */
  flatPackage: { name: string; hours: number; price: number; detail: string };
  /** The full day-evening flat rate, for anything longer than the package. */
  fullDayBlock: { name: string; from: number; detail: string };
  /** The pricing notes shown to the team with every estimate. */
  notes: string[];
}

export interface IntroOffer {
  /** Its name, e.g. "Founding rate". The estimate line reads "<name>, <percent>% off the rental". */
  name: string;
  percent: number;
  validUntil: DateKey;
}

/** The estimate line for an introductory offer: "Founding rate, 20% off the rental". */
export const introOfferLabel = (o: IntroOffer) => `${o.name}, ${o.percent}% off the rental`;

export const allDays = (rate: number): Record<DayType, number> => ({ weekday: rate, friday: rate, saturday: rate, sunday: rate });

/** The public space names and capacities every rate card shares. */
export const SPACES_FOR_PRICING: PricingModel['spaces'] = {
  indoor: { label: SPACE_NAME.indoor, capacity: 100 },
  main: { label: SPACE_NAME.main, capacity: 100 },
  outdoor: { label: SPACE_NAME.outdoor, capacity: 150 },
  // 150 for 'both' is an internal validation ceiling (the larger space), NOT a published combined
  // capacity. Never display it; show capacityLabel('both') from ./capacity instead.
  both: { label: SPACE_NAME.both, capacity: 150 },
};

export function dayTypeOf(date: DateKey, model: PricingModel): DayType {
  return ruleDayTypeOf(date, model.dayTypes);
}

const money = (n: number) => Math.round(n);

export interface EstimateInput {
  date: DateKey;
  space: SpaceChoice;
  hours: number;
  eventType?: string;
}

/**
 * Price an event against a rate card: hourly up to hourlyMaxHours, then the flat package, then the full day
 * block, against src/shared/rate-card.ts.
 */
export function estimate(input: EstimateInput, model: PricingModel, today: DateKey = todayKey()): Estimate {
  const dayType = dayTypeOf(input.date, model);
  const rate = model.hourly[input.space][dayType];
  const minHours = model.minimumHours[dayType];
  const hours = Math.max(1, Math.round(input.hours));
  const billableHours = Math.max(hours, minHours);

  let rental: number;
  let rentalLabel: string;
  let packageName: string | undefined;
  if (billableHours <= model.hourlyMaxHours) {
    rental = rate * billableHours;
    rentalLabel =
      billableHours > hours
        ? `${SPACE_NAME[input.space]}, ${model.dayTypes[dayType].label} minimum of ${billableHours} hours at $${rate} an hour`
        : `${SPACE_NAME[input.space]}, ${billableHours} hours at $${rate} an hour`;
  } else if (billableHours <= model.flatPackage.hours) {
    rental = model.flatPackage.price;
    packageName = model.flatPackage.name;
    rentalLabel = `${SPACE_NAME[input.space]}, ${model.flatPackage.name}, ${billableHours} hours (${model.flatPackage.detail})`;
  } else {
    rental = model.fullDayBlock.from;
    packageName = model.fullDayBlock.name;
    rentalLabel = `${SPACE_NAME[input.space]}, ${model.fullDayBlock.name}, ${billableHours} hours (${model.fullDayBlock.detail})`;
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
  notes.push(...model.notes);
  notes.push('This is a starting figure. Quote the final price personally.');

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
