/**
 * Instant estimate for /pricing/ (client:visible). Every number comes from src/shared/pricing.ts.
 * Space, day (or an exact date), hours, and event type feed estimate(); the result links into the
 * booking wizard with ?space=&hours=&event= (and &date= when one was picked).
 */
import './booking.css';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { OTHER_EVENT, eventTypes } from '../../data/event-types';
import { formatLong, todayKey } from '../../shared/dates';
import { dayTypeOf, estimate, formatUSD, pricing, type DayType } from '../../shared/pricing';
import type { DateKey, SpaceChoice } from '../../shared/types';
import {
  DAY_SHORT,
  DAY_TYPES,
  HOURS_MAX,
  HOURS_MIN,
  SPACE_HINT,
  SPACE_SHORT,
  SPACES,
  bookUrl,
  hoursLabel,
  latestBookableDate,
  minimumHoursNote,
  parseDate,
  representativeDate,
  spaceLabel,
} from './lib';
import { EstimateView, Segmented, Stepper } from './ui';

const ROOT_ID = 'bk-pe-root';

/**
 * The day the page was rendered on. The server render (at build time) prices against it, and the
 * first client render reads it back from that markup, so hydration matches and the static HTML
 * already carries the offers that apply today.
 */
function useRenderDay(ssrToday?: DateKey): DateKey {
  const [day] = useState<DateKey>(() => {
    if (ssrToday) return ssrToday;
    if (typeof document === 'undefined') return todayKey();
    return parseDate(document.getElementById(ROOT_ID)?.getAttribute('data-basis')) ?? todayKey();
  });
  return day;
}

export default function PriceEstimator(props: { bookHref?: string; ssrToday?: DateKey }) {
  const renderDay = useRenderDay(props.ssrToday);
  const [today, setToday] = useState<DateKey>('');
  const [space, setSpace] = useState<SpaceChoice>('indoor');
  const [dayType, setDayType] = useState<DayType>('saturday');
  const [date, setDate] = useState<DateKey | ''>('');
  const [hours, setHours] = useState(pricing.minimumHours.saturday);
  const [eventType, setEventType] = useState('');

  useEffect(() => setToday(todayKey()), []);

  const basis = today || renderDay;
  const latest = today ? latestBookableDate(today) : '';
  const priceDate = date || representativeDate(dayType, basis);
  const est = useMemo(
    () => estimate({ date: priceDate, space, hours, eventType: eventType || undefined }, undefined, basis),
    [priceDate, space, hours, eventType, basis],
  );
  const minHours = pricing.minimumHours[dayType];

  const onDate = (value: string) => {
    const k = parseDate(value);
    if (k && (!today || (k >= today && k <= latestBookableDate(today)))) {
      setDate(k);
      setDayType(dayTypeOf(k));
    } else {
      setDate('');
    }
  };

  const cta = bookUrl(props.bookHref, { space, hours, event: eventType || undefined, date: date || undefined });

  return (
    <div class="bk bk-pe" id={ROOT_ID} data-basis={renderDay}>
      <div class="bk-pe__controls">
        <div class="field">
          <span class="field__label" id="bk-pe-space">
            Space
          </span>
          <Segmented
            labelId="bk-pe-space"
            options={SPACES.map((s) => ({ value: s, label: SPACE_SHORT[s] }))}
            value={space}
            onChange={setSpace}
            describedBy="bk-pe-space-hint"
            full
          />
          <p class="field__hint" id="bk-pe-space-hint">
            {`${SPACE_HINT[space]}.`}
          </p>
        </div>

        <div class="field">
          <span class="field__label" id="bk-pe-day">
            Day
          </span>
          <Segmented
            labelId="bk-pe-day"
            options={DAY_TYPES.map((t) => ({ value: t, label: DAY_SHORT[t] }))}
            value={dayType}
            onChange={(t) => {
              setDayType(t);
              setDate('');
            }}
            full
            class="bk-seg--days"
          />
          <div class="bk-pe__date">
            <label class="field__hint" for="bk-pe-date">
              Or pick your date
            </label>
            <input
              id="bk-pe-date"
              class="input bk-pe__dateinput"
              type="date"
              min={today || undefined}
              max={latest || undefined}
              value={date}
              onChange={(e) => onDate(e.currentTarget.value)}
            />
          </div>
        </div>

        <div class="field">
          <span class="field__label" id="bk-pe-hours">
            Hours
          </span>
          <Stepper
            labelId="bk-pe-hours"
            value={hours}
            min={HOURS_MIN}
            max={HOURS_MAX}
            onChange={setHours}
            format={hoursLabel}
            decLabel="Fewer hours"
            incLabel="More hours"
            describedBy="bk-pe-hours-hint"
          />
          <p class="field__hint" id="bk-pe-hours-hint">
            {minimumHoursNote(dayType)}
            {hours < minHours ? ` Shorter events are billed as ${hoursLabel(minHours)}.` : ''}
          </p>
        </div>

        <div class="field">
          <label class="field__label" for="bk-pe-event">
            Event type
          </label>
          <select id="bk-pe-event" class="input bk-select" value={eventType} onChange={(e) => setEventType(e.currentTarget.value)}>
            <option value="">Any event</option>
            {eventTypes.map((t) => (
              <option value={t.slug} key={t.slug}>
                {t.name}
              </option>
            ))}
            <option value={OTHER_EVENT.slug}>{OTHER_EVENT.name}</option>
          </select>
        </div>
      </div>

      <section class="bk-pe__result" aria-labelledby="bk-pe-result-title">
        <div class="bk-pe__headline">
          <h2 class="bk-pe__title" id="bk-pe-result-title">
            Your estimate
          </h2>
          <p class="bk-pe__meta">
            {spaceLabel(space)}, {date ? formatLong(date) : pricing.dayTypes[dayType].label}, {hoursLabel(hours)}
          </p>
          <p class="bk-pe__big num" aria-live="polite" aria-atomic="true">
            <span class="visually-hidden">Estimated total </span>
            {formatUSD(est.total)}
            {hours < minHours && <span class="visually-hidden">, billed as {hoursLabel(minHours)}</span>}
          </p>
        </div>
        <EstimateView est={est} showTotal={false} />
        <a class="btn btn--filled btn--lg bk-pe__cta" href={cta}>
          Continue to Booking
          <Icon name="arrow-right" />
        </a>
      </section>
    </div>
  );
}
