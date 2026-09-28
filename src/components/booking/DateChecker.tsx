/**
 * "Check a date" for the home page hero (client:load).
 * A native date picker, the status of each space on that date, the next open Saturdays as quick
 * picks, and a primary button into the booking wizard with ?date=&space=.
 */
import './booking.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { addDays, dayOfWeek, formatLong, formatShort, todayKey } from '../../shared/dates';
import { CAPACITY } from '../../shared/capacity';
import type { DateKey } from '../../shared/types';
import { SINGLE_SPACES, bookUrl, parseDate, spaceLabel } from './lib';
import { SpaceStatus, Spinner } from './ui';
import { useAvailability } from './useAvailability';

type Single = 'indoor' | 'outdoor';

const WINDOW_DAYS = 120;

export default function DateChecker(props: { bookHref?: string }) {
  const [today, setToday] = useState<DateKey>('');
  const [date, setDate] = useState<DateKey | ''>('');
  const [raw, setRaw] = useState('');
  const [space, setSpace] = useState<Single | ''>('');
  const { days, loading, error, load, retry } = useAvailability();
  const [windowReady, setWindowReady] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const t = todayKey();
    setToday(t);
    void load(t, addDays(t, WINDOW_DAYS)).then(() => setWindowReady(true));
  }, [load]);

  // Dates past the first window load on their own.
  useEffect(() => {
    if (date && today && !days[date] && date > addDays(today, WINDOW_DAYS)) void load(date, date);
  }, [date, today]);

  const day = date ? days[date] : undefined;
  const isFree = (s: Single) => (day ? day.spaces[s] === 'free' && day.status !== 'past' : true);

  // The person's pick when it is free on this date; otherwise the first free space once the date is known.
  const chosen: Single | '' = space && isFree(space) ? space : day ? (SINGLE_SPACES.find((s) => isFree(s)) ?? '') : '';

  const tooEarly = Boolean(raw && today && parseDate(raw) && raw < today);

  const onDate = (value: string) => {
    setRaw(value);
    const k = parseDate(value);
    setDate(k && (!today || k >= today) ? k : '');
  };

  const saturdays: DateKey[] = [];
  if (today) {
    const firstSat = addDays(today, (6 - dayOfWeek(today) + 7) % 7);
    for (let k = firstSat; saturdays.length < 3 && k <= addDays(today, WINDOW_DAYS); k = addDays(k, 7)) {
      if (days[k]?.status === 'open') saturdays.push(k);
    }
  }

  const bothTaken = day ? !isFree('indoor') && !isFree('outdoor') : false;
  const cta = bookUrl(props.bookHref, {
    date: date && !bothTaken ? date : undefined,
    space: date && day && chosen ? chosen : undefined,
  });

  const pickSpace = (s: Single, focus = false, i = 0) => {
    if (!isFree(s)) return;
    setSpace(s);
    if (focus) refs.current[i]?.focus();
  };

  const onSpaceKey = (e: KeyboardEvent, i: number) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const j = i === 0 ? 1 : 0;
    const s = SINGLE_SPACES[j];
    if (isFree(s)) pickSpace(s, true, j);
  };

  const checkedIdx = SINGLE_SPACES.findIndex((s) => s === chosen);
  const tabIdx = checkedIdx >= 0 ? checkedIdx : Math.max(0, SINGLE_SPACES.findIndex((s) => isFree(s)));
  const statusPending = Boolean(date && !day && loading);
  const statusError = Boolean(date && !day && !loading && error);

  return (
    <div class="bk bk-dc">
      <div class="field">
        <label class="bk-dc__label" for="bk-dc-date">
          Check a date
        </label>
        <div class="bk-dc__inputwrap">
          <Icon name="calendar" class="bk-dc__inputicon" />
          <input
            id="bk-dc-date"
            class="input bk-dc__input"
            type="date"
            min={today || undefined}
            value={raw}
            aria-describedby="bk-dc-status"
            aria-invalid={tooEarly ? 'true' : undefined}
            onInput={(e) => onDate(e.currentTarget.value)}
            onChange={(e) => onDate(e.currentTarget.value)}
          />
        </div>
      </div>

      <div id="bk-dc-status" class="bk-dc__status" aria-live="polite">
        {tooEarly ? (
          <p class="field__error">Choose a date from today on.</p>
        ) : !date ? (
          <p class="bk-dc__hint">Pick a date to see which spaces are open.</p>
        ) : statusPending ? (
          <p class="bk-dc__hint">
            <Spinner /> Checking {formatShort(date)}
            {String.fromCharCode(8230)}
          </p>
        ) : statusError ? (
          <p class="bk-dc__hint">We could not check that date right now.</p>
        ) : day ? (
          <p class="bk-dc__hint">
            <strong>{formatLong(date)}</strong>
            {bothTaken ? '. Both spaces are booked. Try one of the open Saturdays below.' : ''}
          </p>
        ) : null}
      </div>

      {statusError && (
        <button type="button" class="btn btn--tinted btn--sm bk-dc__retry" onClick={retry}>
          Try Again
        </button>
      )}

      <div class="bk-dc__spaces" role="radiogroup" aria-label="Space">
        {SINGLE_SPACES.map((s, i) => {
          const free = isFree(s);
          const on = chosen === s;
          return (
            <button
              key={s}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              class="bk-dc__space"
              aria-checked={on ? 'true' : 'false'}
              aria-disabled={free ? undefined : 'true'}
              tabIndex={i === tabIdx ? 0 : -1}
              onClick={() => pickSpace(s)}
              onKeyDown={(e) => onSpaceKey(e, i)}
            >
              <span class="bk-dc__space-top">
                <span class="bk-dc__space-name">{spaceLabel(s)}</span>
                <span class="bk-dc__radio" aria-hidden="true" />
              </span>
              <span class="bk-dc__space-cap">Up to {CAPACITY[s]} guests</span>
              <span class="bk-dc__space-status">
                {day ? <SpaceStatus free={free} /> : <span class="bk-status bk-status--none">{date ? (statusPending ? 'Checking' : '') : 'Pick a date'}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div class="bk-dc__sats">
        <p class="bk-dc__sats-label" id="bk-dc-sats">
          Next open Saturdays
        </p>
        {!windowReady || (loading && saturdays.length === 0) ? (
          <div class="bk-chips" aria-hidden="true">
            <span class="bk-chip bk-chip--skel" />
            <span class="bk-chip bk-chip--skel" />
            <span class="bk-chip bk-chip--skel" />
          </div>
        ) : saturdays.length > 0 ? (
          <div class="bk-chips" role="group" aria-labelledby="bk-dc-sats">
            {saturdays.map((k) => (
              <button
                key={k}
                type="button"
                class="bk-chip"
                aria-pressed={date === k ? 'true' : 'false'}
                onClick={() => {
                  setRaw(k);
                  setDate(k);
                }}
              >
                {formatShort(k)}
              </button>
            ))}
          </div>
        ) : error ? (
          <p class="bk-dc__hint">
            We could not load open dates.{' '}
            <button type="button" class="bk-linkbtn" onClick={retry}>
              Try Again
            </button>
          </p>
        ) : (
          <p class="bk-dc__hint">No open Saturdays in the next few months. Pick any date above.</p>
        )}
      </div>

      <a class="btn btn--filled btn--lg bk-dc__cta" href={cta}>
        Check Availability
        <Icon name="arrow-right" />
      </a>
    </div>
  );
}
