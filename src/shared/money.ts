/**
 * Money formatting and the payment timing, without the rate card. The admin imports these from here so
 * its browser bundle never carries the internal rate card in ./pricing, which stays on the server (and in
 * the demo build's in-browser backend). ./pricing re-exports formatUSD and reads the balance timing.
 */

/** The balance is due this many days before the event; inside this window the full amount is due to reserve. */
export const BALANCE_DUE_DAYS_BEFORE = 30;

const MINUS = /* @__PURE__ */ String.fromCharCode(0x2212);
const usd = /* @__PURE__ */ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
/** Whole-dollar USD. Negative amounts use a true minus sign, e.g. for discounts. */
export const formatUSD = (n: number) => (n < 0 ? MINUS + usd.format(-n) : usd.format(n));
