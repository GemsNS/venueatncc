/**
 * The demo's sample rate card. The GitHub Pages demo runs its backend in the browser, so it must never carry
 * the venue's real prices (those are server only, server/rate-card.ts). These figures are placeholders that
 * show how the team's rate-card guide looks; the notes say so.
 */
import { dayTypes, minimumHours } from '../../shared/booking-rules';
import { SPACES_FOR_PRICING, allDays, estimate, type EstimateInput, type PricingModel } from '../../shared/pricing';
import type { DateKey, Estimate } from '../../shared/types';

export const demoPricing: PricingModel = {
  status: 'provisional',
  currency: 'USD',
  spaces: SPACES_FOR_PRICING,
  dayTypes,
  hourly: { indoor: allDays(100), main: allDays(100), outdoor: allDays(100), both: allDays(100) },
  minimumHours,
  packages: [],
  fees: { cleaning: 0, damageDepositRefundable: 0 },
  bookingDeposit: { type: 'flat', value: 0, balanceDueDaysBefore: 0 },
  discounts: [],
  introOffer: null,
  hourlyMaxHours: 4,
  flatPackage: { name: 'Flat rate package', hours: 8, price: 1000, detail: 'sample figure' },
  fullDayBlock: { name: 'Full day or evening flat block', from: 1500, detail: 'sample figure' },
  notes: ["Demo figures only. The venue's real rate card is kept on its server and never shown in the demo."],
};

/** The demo's estimate, against the sample card. */
export const demoEstimate = (input: EstimateInput, today?: DateKey): Estimate => estimate(input, demoPricing, today);
