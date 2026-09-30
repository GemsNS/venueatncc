/**
 * The live summary: the request so far. Sticky beside the wizard on wide screens. The venue does not
 * publish prices, so the card shows no amounts: we confirm availability and send each quote personally.
 */
import { eventTypeName } from '../../data/event-types';
import { formatEndTime, formatTime } from '../../shared/dates';
import { formatLongKept, guestsLabel, spaceLabel } from './lib';
import type { Draft } from './wizard';

export function SummaryCard(props: { d: Draft }) {
  const { d } = props;
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
        Your request
      </h2>
      <dl class="bk-summary__rows">
        {rows.map(([k, v]) => (
          <div class="bk-summary__row" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p class="bk-summary__note">We confirm availability and send your quote personally.</p>
    </div>
  );
}
