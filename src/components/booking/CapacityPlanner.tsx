/**
 * Guest count planner for /the-space/ (client:visible).
 * Shows how each space fits the guest count, recommends the smallest space that fits,
 * and links into the booking wizard with ?guests=&space=.
 */
import './booking.css';
import { useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { site } from '../../data/site';
import { CAPACITY, suggestSpace } from '../../shared/capacity';
import { SINGLE_SPACES, bookUrl, guestsLabel, spaceLabel, telHref } from './lib';
import { CountField } from './ui';

const MIN = 10;
const MAX = 200;

export default function CapacityPlanner(props: { bookHref?: string }) {
  const [guests, setGuests] = useState(60);
  const best = suggestSpace(guests);

  return (
    <div class="bk bk-cp">
      <div class="bk-cp__controls">
        <div class="field">
          <label class="bk-cp__label" for="bk-cp-guests">
            How many guests?
          </label>
          <CountField
            id="bk-cp-guests"
            value={guests}
            min={MIN}
            max={MAX}
            onChange={setGuests}
            decLabel="Fewer guests"
            incLabel="More guests"
            describedBy="bk-cp-result"
          />
        </div>
        <div class="bk-cp__slider">
          <input
            type="range"
            class="bk-range"
            min={MIN}
            max={MAX}
            step={1}
            value={guests}
            aria-label="Guest count"
            aria-valuetext={guestsLabel(guests)}
            onInput={(e) => setGuests(Number(e.currentTarget.value))}
            style={{ '--pct': `${((guests - MIN) / (MAX - MIN)) * 100}%` }}
          />
          <div class="bk-cp__scale num" aria-hidden="true">
            <span>{MIN}</span>
            <span>{MAX}</span>
          </div>
        </div>
      </div>

      <ul class="bk-cp__spaces">
        {SINGLE_SPACES.map((s) => {
          const cap = CAPACITY[s];
          const fits = guests <= cap;
          const pct = Math.min(100, (guests / cap) * 100);
          const recommended = best === s;
          return (
            <li class={`bk-cap${recommended ? ' is-best' : ''}`} key={s} data-fits={fits ? 'true' : 'false'}>
              <div class="bk-cap__head">
                <span class="bk-cap__name">{spaceLabel(s)}</span>
                {recommended && <span class="badge badge--green">Best fit</span>}
                <span class="bk-cap__max num">Up to {cap}</span>
              </div>
              <div class="bk-cap__bar" aria-hidden="true">
                <span class="bk-cap__fill" style={{ width: `${pct}%` }} />
              </div>
              <p class="bk-cap__verdict">
                {fits ? (
                  <>
                    <Icon name="check-circle" />
                    <span>
                      Fits {guestsLabel(guests)}, with room for {cap - guests} more
                    </span>
                  </>
                ) : (
                  <>
                    <Icon name="x" />
                    <span>Over capacity by {guests - cap}</span>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>

      <div id="bk-cp-result" class="bk-cp__result" aria-live="polite">
        {best ? (
          <p>
            <strong>{spaceLabel(best)}</strong> is the best fit for {guestsLabel(guests)}.
          </p>
        ) : (
          <div class="bk-note bk-note--info">
            <Icon name="phone" />
            <div class="bk-note__body">
              <p>
                Our largest space holds up to {site.maxCapacity} guests. For a bigger event, give us a call and we will talk it through.
              </p>
            </div>
          </div>
        )}
      </div>

      {best ? (
        <a class="btn btn--filled btn--lg bk-cp__cta" href={bookUrl(props.bookHref, { guests, space: best })}>
          Check Dates for {guests} Guests
          <Icon name="arrow-right" />
        </a>
      ) : (
        <a class="btn btn--filled btn--lg bk-cp__cta" href={telHref(site.contact.phoneE164)}>
          <Icon name="phone" />
          Call {site.contact.phone}
        </a>
      )}
    </div>
  );
}
