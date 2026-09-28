/** The live summary: the request so far and its estimate. Sticky beside the wizard on wide screens. */
import { eventTypeName } from '../../data/event-types';
import { addHours, formatTime } from '../../shared/dates';
import { formatUSD, priceSummary } from '../../shared/pricing';
import type { Estimate } from '../../shared/types';
import { formatLongKept, guestsLabel, spaceLabel } from './lib';
import { EstimateView } from './ui';
import type { Draft } from './wizard';

export function SummaryCard(props: { d: Draft; est: Estimate | null }) {
  const { d, est } = props;
  const rows: [string, string][] = [
    ['Date', d.date ? formatLongKept(d.date) : 'Not chosen yet'],
    ['Time', `${formatTime(d.startTime)} to ${formatTime(addHours(d.startTime, d.hours))}`],
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
          Choose a date to see your estimate. Rates start at <span class="num">{formatUSD(priceSummary().fromHourly)}</span> an hour.
        </p>
      )}
    </div>
  );
}
