/** The live summary: the request so far and its estimate. Sticky beside the wizard on wide screens. */
import { eventTypeName } from '../../data/event-types';
import { formatEndTime, formatTime } from '../../shared/dates';
import { formatUSD, pricing } from '../../shared/pricing';
import type { Estimate } from '../../shared/types';
import { formatLongKept, guestsLabel, spaceLabel } from './lib';
import { EstimateView } from './ui';
import type { Draft } from './wizard';

export function SummaryCard(props: { d: Draft; est: Estimate | null }) {
  const { d, est } = props;
  // The lowest hourly rate for the space chosen, so The Hall never reads as "from $85" (The Grove's rate).
  const fromHourly = Math.min(...Object.values(pricing.hourly[d.space]));
  const rows: [string, string][] = [
    ['Date', d.date ? formatLongKept(d.date) : 'Not chosen yet'],
    ['Time', `${formatTime(d.startTime)} to ${formatEndTime(d.startTime, d.hours)}`],
    ['Space', spaceLabel(d.space)],
    ['Guests', guestsLabel(d.guests)],
    ['Event', d.eventType ? eventTypeName(d.eventType, d.eventTypeOther.trim()) : 'Not chosen yet'],
  ];
  return (
    <div class="bk-summary">
      <h2 class="bk-summary__title" id="bk-summary-title">
        Your estimate
      </h2>
      <dl class="bk-summary__rows">
        {rows.map(([k, v]) => (
          <div class="bk-summary__row" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {est && d.date ? (
        <EstimateView est={est} live />
      ) : (
        <p class="bk-summary__empty">
          Choose a date to see your estimate. Rates for {spaceLabel(d.space)} start at <span class="num">{formatUSD(fromHourly)}</span> an hour.
        </p>
      )}
    </div>
  );
}
