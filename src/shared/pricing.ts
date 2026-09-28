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

export const pricing: PricingModel = {
  status: 'provisional',
  currency: 'USD',
  spaces: {
    indoor: { label: 'Indoor hall', capacity: 100 },
    outdoor: { label: 'Outdoor space', capacity: 150 },
    both: { label: 'Indoor and outdoor', capacity: 150 },
  },
  dayTypes: {
    weekday: { label: 'Monday to Thursday', days: [1, 2, 3, 4] },
    friday: { label: 'Friday', days: [5] },
    saturday: { label: 'Saturday', days: [6] },
    sunday: { label: 'Sunday', days: [0] },
  },
  hourly: {
    indoor: { weekday: 75, friday: 100, saturday: 125, sunday: 100 },
    outdoor: { weekday: 85, friday: 110, saturday: 140, sunday: 110 },
    both: { weekday: 125, friday: 160, saturday: 200, sunday: 160 },
  },
  minimumHours: { weekday: 2, friday: 4, saturday: 5, sunday: 4 },
  packages: [],
  fees: { cleaning: 100, damageDepositRefundable: 250 },
  bookingDeposit: { type: 'percent', value: 50, balanceDueDaysBefore: 14 },
  discounts: [],
  introOffer: null,
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

  for (const d of model.discounts) {
    const [scope, value] = d.appliesTo.split(':');
    const applies = (scope === 'eventType' && value === input.eventType) || (scope === 'dayType' && value === dayType);
    if (!applies || d.percent <= 0) continue;
    const off = money((rental * d.percent) / 100);
    lines.push({ label: d.label, amount: -off, kind: 'discount' });
    total -= off;
  }

  if (model.introOffer && model.introOffer.percent > 0 && today <= model.introOffer.validUntil) {
    const off = money((rental * model.introOffer.percent) / 100);
    lines.push({ label: model.introOffer.label, amount: -off, kind: 'discount' });
    total -= off;
  }

  total = Math.max(0, money(total));
  const bookingDeposit =
    model.bookingDeposit.type === 'percent'
      ? money((total * model.bookingDeposit.value) / 100)
      : Math.min(total, model.bookingDeposit.value);

  const notes: string[] = [];
  if (billableHours > hours) notes.push(`${model.dayTypes[dayType].label} bookings have a ${minHours}-hour minimum.`);
  notes.push('Catering is not included. Bring the caterer of your choice.');
  notes.push('On-site parking is included.');
  const daysOut = daysBetween(today, input.date);
  if (model.bookingDeposit.balanceDueDaysBefore > 0) {
    notes.push(
      daysOut > model.bookingDeposit.balanceDueDaysBefore
        ? `The balance is due ${model.bookingDeposit.balanceDueDaysBefore} days before your event.`
        : 'Your event is soon, so the full amount is due when you reserve.',
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

export const formatUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
