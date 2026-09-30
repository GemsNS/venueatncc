/**
 * "Check a date" for the home page hero (client:load).
 * A date field that opens the booking calendar, the status of each space on that date, the next
 * open Saturdays as quick picks, and a primary button into the booking wizard with ?date=&space=.
 */
import './booking.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { addDays, dayOfWeek, formatLong, formatShort, todayKey } from '../../shared/dates';
import { CLOSED_DAY_MESSAGE } from '../../shared/booking-rules';
import type { DateKey, SingleSpace } from '../../shared/types';
import { DateField } from './DateField';
import { ELLIPSIS, SINGLE_SPACES, bookUrl, latestBookableDate, listSpaces, spaceLabel } from './lib';
import { SpaceStatus, Spinner } from './ui';
import { useAvailability, useRefreshOnReturn } from './useAvailability';

type Single = SingleSpace;

const WINDOW_DAYS = 120;

/** Speak the result once it settles (a pick and its availability can land in separate renders). */
const SPEAK_AFTER_MS = 500;

/**
 * One word under each space name. Capacities are not repeated here: the home page space cards, one
 * scroll down, carry them (docs/design/brand.md, "Redundancy rules").
 */
const SPACE_META: Record<Single, string> = {
  indoor: 'Indoor',
  main: 'Auditorium',
  outdoor: 'Outdoor',
};

export default function DateChecker(props: { bookHref?: string }) {
  const [today, setToday] = useState<DateKey>('');
  const [date, setDate] = useState<DateKey | ''>('');
  const [space, setSpace] = useState<Single | ''>('');
  const { days, loading, error, load, ensureMonths, retry } = useAvailability();
  const [windowReady, setWindowReady] = useState(false);
  const [spoken, setSpoken] = useState('');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const latest = today ? latestBookableDate(today) : '';

  useEffect(() => {
    const t = todayKey();
    setToday(t);
    void load(t, addDays(t, WINDOW_DAYS)).then(() => setWindowReady(true));
  }, [load]);

  // Dates past the first window load on their own.
  useEffect(() => {
    if (date && today && !days[date] && date > addDays(today, WINDOW_DAYS)) void load(date, date);
  }, [date, today]);

  // Coming back to the tab: dates may have been booked meanwhile.
  useRefreshOnReturn(() => {
    if (!today) return;
    void load(today, addDays(today, WINDOW_DAYS));
    if (date && date > addDays(today, WINDOW_DAYS)) void load(date, date);
  });

  const day = date ? days[date] : undefined;
  const isFree = (s: Single) => (day ? day.spaces[s] === 'free' && day.status !== 'past' && day.status !== 'closed' : true);

  // The person's pick when it is free on this date; otherwise the first free space once the date is known.
  const chosen: Single | '' = space && isFree(space) ? space : day ? (SINGLE_SPACES.find((s) => isFree(s)) ?? '') : '';

  const saturdays: DateKey[] = [];
  if (today) {
    const firstSat = addDays(today, (6 - dayOfWeek(today) + 7) % 7);
    for (let k = firstSat; saturdays.length < 3 && k <= addDays(today, WINDOW_DAYS); k = addDays(k, 7)) {
      if (days[k]?.status === 'open') saturdays.push(k);
    }
  }

  const allTaken = day ? SINGLE_SPACES.every((s) => !isFree(s)) : false;
  const cta = bookUrl(props.bookHref, {
    date: date && !allTaken ? date : undefined,
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
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const n = SINGLE_SPACES.length;
    // Move to the next free space in that direction, wrapping around, as native radios do.
    for (let k = 1; k < n; k++) {
      const j = (i + step * k + n) % n;
      if (isFree(SINGLE_SPACES[j])) {
        pickSpace(SINGLE_SPACES[j], true, j);
        return;
      }
    }
  };

  const checkedIdx = SINGLE_SPACES.findIndex((s) => s === chosen);
  const tabIdx = checkedIdx >= 0 ? checkedIdx : Math.max(0, SINGLE_SPACES.findIndex((s) => isFree(s)));
  const statusPending = Boolean(date && !day && loading);
  const statusError = Boolean(date && !day && !loading && error);

  // What the day means, space by space (the radios carry the same, but this is what gets announced).
  let dayNews = '';
  if (date && day) {
    const free = SINGLE_SPACES.filter((s) => isFree(s));
    const taken = SINGLE_SPACES.filter((s) => !isFree(s));
    if (day.status === 'closed') dayNews = CLOSED_DAY_MESSAGE;
    else if (free.length === SINGLE_SPACES.length) dayNews = 'All three spaces are open.';
    else if (free.length > 0) {
      dayNews = `${listSpaces(free)} ${free.length === 1 ? 'is' : 'are'} open. ${listSpaces(taken)} ${taken.length === 1 ? 'is' : 'are'} booked.`;
    } else dayNews = 'All three spaces are booked. Try one of the open Saturdays below.';
  }

  // The field shows the date, so the line under it says only what the day means. The announcement
  // names the date too, for a pick made with the Saturday chips.
  const speech = statusError ? 'We could not check that date right now.' : date && day ? `${formatLong(date)}. ${dayNews}` : '';

  useEffect(() => {
    const timer = window.setTimeout(() => setSpoken(speech), SPEAK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [speech]);

  return (
    <div class="bk bk-dc">
      <div class="field">
        <span class="bk-dc__label" id="bk-dc-label">
          Check a date
        </span>
        <DateField
          id="bk-dc-date"
          labelId="bk-dc-label"
          value={date}
          onChange={setDate}
          today={today}
          latest={latest}
          statusOf={(k) => days[k]?.status}
          loading={loading}
          error={error}
          onRetry={retry}
          onMonth={(view) => ensureMonths(view, 1)}
          describedBy="bk-dc-status"
        />
      </div>

      <div id="bk-dc-status" class="bk-dc__status">
        {!date ? (
          <p class="bk-dc__hint">See which spaces are open on your day.</p>
        ) : statusPending ? (
          <p class="bk-dc__hint">
            <Spinner /> Checking availability{ELLIPSIS}
          </p>
        ) : statusError ? (
          <p class="bk-dc__hint">We could not check that date right now.</p>
        ) : day ? (
          <p class="bk-dc__hint">{dayNews}</p>
        ) : null}
      </div>
      <p class="visually-hidden" aria-live="polite">
        {spoken}
      </p>

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
              <span class="bk-dc__space-main">
                <span class="bk-dc__space-name">{spaceLabel(s)}</span>
                <span class="bk-dc__space-cap">{SPACE_META[s]}</span>
              </span>
              {/* Before a date is chosen the hint above says what to do, so the rows stay quiet. */}
              {(day || statusPending) && (
                <span class="bk-dc__space-status">
                  {day ? <SpaceStatus free={free} /> : <span class="bk-status bk-status--none">Checking</span>}
                </span>
              )}
              <span class="bk-dc__radio" aria-hidden="true" />
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
                onClick={() => setDate(k)}
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
        Continue to Booking
        <Icon name="arrow-right" />
      </a>
    </div>
  );
}
