/**
 * Inline month calendar (HIG pickers: shown in context, 44px day cells).
 * ARIA grid with a roving tabindex: arrows move by day and week, Home/End to the week's edges,
 * Page Up/Down by month (with Shift, by year). Enter or Space chooses a day.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { addDays, dayOfWeek, formatLong, monthGrid, parseKey, toKey } from '../../shared/dates';
import type { DateKey, DayStatus } from '../../shared/types';
import { Spinner } from './ui';
import { addMonths, firstKey, lastDayOf, lastKey, ymIndex, ymOf, type YM } from './useAvailability';

const WEEKDAYS: [string, string][] = [
  ['S', 'Sunday'],
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
];

/** A day's status, plus 'later' for days past the latest date the venue takes requests for. */
export type CalStatus = DayStatus | 'later';

const STATUS_WORD: Record<CalStatus, string> = {
  open: 'open',
  partial: 'partly booked',
  booked: 'booked',
  past: 'past',
  later: 'not open for requests yet',
};

const monthTitle = (ym: YM) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(ym.y, ym.m - 1, 1)));

function shiftMonth(key: DateKey, n: number): DateKey {
  const { d } = parseKey(key);
  const target = addMonths(ymOf(key), n);
  return toKey(target.y, target.m, Math.min(d, lastDayOf(target)));
}

export interface CalendarProps {
  /** Id of the grid; error links focus here. */
  id: string;
  view: YM;
  onView: (view: YM) => void;
  min: YM;
  max: YM;
  today: DateKey;
  /** The last day that can be requested; later days in the last month show as unavailable. */
  lastDate?: DateKey;
  selected: DateKey | '';
  onSelect: (date: DateKey) => void;
  /** Status for a date, or undefined while it loads. */
  statusOf: (date: DateKey) => DayStatus | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  describedBy?: string;
  /** Called when someone picks a day that cannot be booked. */
  onUnavailable?: (date: DateKey, status: CalStatus) => void;
  /** In a popover: adds a Close button after the month arrows. The wizard's inline calendar has none. */
  onClose?: () => void;
  /** Move focus between days without scrolling the page (a popover is placed in view when it opens). */
  keepScroll?: boolean;
  /** The month title's heading level: 3 in the wizard's step, 2 as the first heading of a popover. */
  headingLevel?: 2 | 3;
}

export function Calendar(props: CalendarProps) {
  const { view, min, max, today, selected } = props;
  const statusOf = (k: DateKey): CalStatus | undefined =>
    k < today ? 'past' : props.lastDate && k > props.lastDate ? 'later' : props.statusOf(k);
  const gridRef = useRef<HTMLTableElement>(null);
  const wantFocus = useRef(false);

  const inView = (k: DateKey) => {
    const ym = ymOf(k);
    return ym.y === view.y && ym.m === view.m;
  };
  const defaultFocus = (): DateKey => {
    if (selected && inView(selected)) return selected;
    if (today && inView(today)) return today;
    return firstKey(view);
  };
  const [focus, setFocus] = useState<DateKey>(defaultFocus);

  // Keep the roving focus inside the visible month.
  useEffect(() => {
    if (!inView(focus)) setFocus(defaultFocus());
  }, [view.y, view.m]);

  useEffect(() => {
    if (selected && inView(selected)) setFocus(selected);
  }, [selected]);

  useLayoutEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus(props.keepScroll ? { preventScroll: true } : undefined);
  });

  const atMin = ymIndex(view) <= ymIndex(min);
  const atMax = ymIndex(view) >= ymIndex(max);

  const onKeyDown = (e: KeyboardEvent) => {
    let next: DateKey | null = null;
    switch (e.key) {
      case 'ArrowRight':
        next = addDays(focus, 1);
        break;
      case 'ArrowLeft':
        next = addDays(focus, -1);
        break;
      case 'ArrowDown':
        next = addDays(focus, 7);
        break;
      case 'ArrowUp':
        next = addDays(focus, -7);
        break;
      case 'Home':
        next = addDays(focus, -dayOfWeek(focus));
        break;
      case 'End':
        next = addDays(focus, 6 - dayOfWeek(focus));
        break;
      case 'PageUp':
        next = shiftMonth(focus, e.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = shiftMonth(focus, e.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next < firstKey(min)) next = firstKey(min);
    if (next > lastKey(max)) next = lastKey(max);
    const ym = ymOf(next);
    wantFocus.current = true;
    setFocus(next);
    if (ym.y !== view.y || ym.m !== view.m) props.onView(ym);
  };

  const choose = (k: DateKey) => {
    setFocus(k);
    const st = statusOf(k);
    if (st === 'past' || st === 'booked' || st === 'later') {
      props.onUnavailable?.(k, st);
      return;
    }
    props.onSelect(k);
  };

  const titleId = `${props.id}-title`;
  const Title = props.headingLevel === 2 ? 'h2' : 'h3';
  const weeks = monthGrid(view.y, view.m);

  return (
    <div class="bk-cal">
      <div class="bk-cal__head">
        <Title id={titleId} class="bk-cal__title" aria-live="polite">
          {monthTitle(view)}
        </Title>
        <div class="bk-cal__nav">
          {props.loading && (
            <span class="bk-cal__loading">
              <Spinner />
              <span class="visually-hidden">Checking dates</span>
            </span>
          )}
          <button
            type="button"
            class="bk-iconbtn"
            aria-label="Previous month"
            aria-disabled={atMin ? 'true' : undefined}
            onClick={() => {
              if (!atMin) props.onView(addMonths(view, -1));
            }}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            class="bk-iconbtn"
            aria-label="Next month"
            aria-disabled={atMax ? 'true' : undefined}
            onClick={() => {
              if (!atMax) props.onView(addMonths(view, 1));
            }}
          >
            <Icon name="chevron-right" />
          </button>
          {props.onClose && (
            <button type="button" class="bk-iconbtn bk-cal__close" aria-label="Close" onClick={props.onClose}>
              <Icon name="x" />
            </button>
          )}
        </div>
      </div>

      <table
        role="grid"
        id={props.id}
        ref={gridRef}
        class="bk-cal__grid"
        aria-labelledby={titleId}
        aria-describedby={props.describedBy || undefined}
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {WEEKDAYS.map(([s, full]) => (
              <th scope="col" key={full} abbr={full}>
                <span aria-hidden="true">{s}</span>
                <span class="visually-hidden">{full}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((k, di) => {
                if (!k) return <td key={`e${di}`} class="bk-cal__empty" />;
                const st = statusOf(k);
                const isSel = k === selected;
                const isToday = k === today;
                const disabled = st === 'past' || st === 'booked' || st === 'later';
                const label = [formatLong(k), st ? STATUS_WORD[st] : '', isSel ? 'selected' : ''].filter(Boolean).join(', ');
                // The cell (a gridcell under role="grid") carries the selected state; the label says it too.
                return (
                  <td key={k} aria-selected={isSel ? 'true' : 'false'}>
                    <button
                      type="button"
                      class={`bk-day${isSel ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                      data-date={k}
                      data-status={st ?? 'unknown'}
                      tabIndex={k === focus ? 0 : -1}
                      aria-label={label}
                      aria-disabled={disabled ? 'true' : undefined}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => choose(k)}
                    >
                      <span class="bk-day__num">{parseKey(k).d}</span>
                      <span class="bk-day__mark" aria-hidden="true">
                        {st === 'booked' && <Icon name="x" />}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {props.error && (
        <div class="bk-cal__error" role="alert">
          <p>We could not load open dates. You can still pick a date and we will confirm it.</p>
          <button type="button" class="btn btn--tinted btn--sm" onClick={props.onRetry}>
            Try Again
          </button>
        </div>
      )}

      <ul class="bk-legend" aria-label="Calendar key">
        <li>
          <span class="bk-legend__mark" data-status="open" aria-hidden="true" />
          Open
        </li>
        <li>
          <span class="bk-legend__mark" data-status="partial" aria-hidden="true" />
          Partly booked
        </li>
        <li>
          <span class="bk-legend__mark" data-status="booked" aria-hidden="true">
            <Icon name="x" />
          </span>
          <span class="bk-legend__booked">Booked</span>
        </li>
      </ul>
    </div>
  );
}
