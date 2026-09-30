/**
 * The live summary: the request so far, in a white panel that sits beside the wizard on wide screens. With
 * `spacePhotos` it opens with the chosen space's photo (steps 2 and 3, where the space rows are off screen,
 * so no photo appears twice). The venue does not publish prices, so the card shows no amounts: we confirm
 * availability and send each quote personally.
 */
import { eventTypeName } from '../../data/event-types';
import { formatEndTime, formatTime } from '../../shared/dates';
import { formatLongKept, guestsLabel, spaceLabel } from './lib';
import { SpaceThumb, hasSpacePhoto, type SpacePhotos } from './SpaceThumb';
import type { Draft } from './wizard';

export function SummaryCard(props: { d: Draft; spacePhotos?: SpacePhotos }) {
  const { d, spacePhotos } = props;
  const rows: [string, string][] = [
    ['Date', d.date ? formatLongKept(d.date) : 'Not chosen yet'],
    ['Time', `${formatTime(d.startTime)} to ${formatEndTime(d.startTime, d.hours)}`],
    ['Space', spaceLabel(d.space)],
    ['Guests', guestsLabel(d.guests)],
    ['Event', d.eventType ? eventTypeName(d.eventType, d.eventTypeOther.trim()) : 'Not chosen yet'],
  ];
  const photo = spacePhotos && hasSpacePhoto(spacePhotos, d.space);
  return (
    <div class={`bk-panel bk-summary${photo ? ' bk-summary--photo' : ''}`}>
      {photo && <SpaceThumb photos={spacePhotos} space={d.space} class="bk-summary__photo" sizes="(min-width: 60rem) 360px, 100vw" />}
      <div class="bk-summary__body">
        <h2 class="bk-panel__title" id="bk-summary-title">
          Your request
        </h2>
        <dl class="bk-dl bk-summary__rows">
          {rows.map(([k, v]) => (
            <div class="bk-dl__row" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p class="bk-summary__note">We confirm availability and send your quote personally.</p>
      </div>
    </div>
  );
}
