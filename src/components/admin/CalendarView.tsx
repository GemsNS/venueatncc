import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import { addDays, dayOfWeek, formatLong, formatShort, monthGrid, parseKey, toKey, todayKey } from '../../shared/dates';
import { SPACE_NAMES, type BlockKind, type CalendarBlock, type DateKey, type SpaceChoice } from '../../shared/types';
import { Icon } from '../islands/Icon';
import { useAdmin } from './context';
import { Sheet } from './Dialog';
import { DOT, ELLIPSIS, KIND_LABEL, SEP, SPACE_SHORT, formatMonth, plural, spaceLabel } from './format';
import { calendarHash } from './route';
import { ErrorBanner, PageHeader, SegmentedRadio } from './ui';

const WEEKDAYS = [
  ['Sun', 'Sunday'],
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
];

const SPACE_OPTIONS: { id: SpaceChoice; label: string }[] = [
  { id: 'indoor', label: SPACE_NAMES.indoor },
  { id: 'outdoor', label: SPACE_NAMES.outdoor },
  { id: 'both', label: 'Both' },
];

const KIND_OPTIONS: { id: BlockKind; label: string }[] = [
  { id: 'booked', label: 'Booked' },
  { id: 'held', label: 'Held' },
  { id: 'closed', label: 'Closed' },
];

const SPACE_ORDER: Record<SpaceChoice, number> = { both: 0, indoor: 1, outdoor: 2 };

function monthOf(key: DateKey): string {
  return key.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastDay(month: string): DateKey {
  const [y, m] = month.split('-').map(Number);
  return toKey(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

function blockText(b: CalendarBlock): string {
  return `${SPACE_SHORT[b.space]} ${KIND_LABEL[b.kind].toLowerCase()}${b.label ? `: ${b.label}` : ''}`;
}

function Chip({ block }: { block: CalendarBlock }) {
  return (
    <span class={`adm-chip adm-chip--${block.kind}`}>
      <span class="adm-chip__space">{SPACE_SHORT[block.space]}</span>
      <span class="adm-chip__sep" aria-hidden="true">
        {' '}
        {DOT}{' '}
      </span>
      <span class="adm-chip__kind">{KIND_LABEL[block.kind]}</span>
    </span>
  );
}

function DaySheetContent({
  date,
  blocks,
  onAdded,
  onDeleted,
}: {
  date: DateKey;
  blocks: CalendarBlock[];
  onAdded: (b: CalendarBlock) => void;
  onDeleted: (id: number) => void;
}) {
  const { run, toast } = useAdmin();
  const [space, setSpace] = useState<SpaceChoice>('indoor');
  const [kind, setKind] = useState<BlockKind>('booked');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const add = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await run(api.admin.createBlock({ date, space, kind, label: label.trim() }));
    setBusy(false);
    if (isError(res)) {
      const fieldMsg = res.fields ? Object.values(res.fields)[0] : undefined;
      setError(fieldMsg && fieldMsg !== res.error ? `${res.error} ${fieldMsg}` : res.error);
      return;
    }
    onAdded(res);
    setLabel('');
    toast(`${SPACE_SHORT[res.space]} ${KIND_LABEL[res.kind].toLowerCase()} on ${formatShort(res.date)}.`);
  };

  const remove = async (id: number) => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await run(api.admin.deleteBlock(id));
    setDeleting(false);
    if (isError(res)) {
      setDeleteError(res.error);
      return;
    }
    setConfirmId(null);
    onDeleted(id);
    toast('Block deleted.');
  };

  return (
    <>
      <section class="adm-sheet__section" aria-labelledby="adm-day-blocks">
        <h3 id="adm-day-blocks" class="adm-sheet__h3">
          On this day
        </h3>
        {blocks.length === 0 ? (
          <p class="adm-muted adm-sheet__empty">Nothing blocked. Both spaces are open.</p>
        ) : (
          <ul class="list-group adm-list adm-blocklist">
            {blocks.map((b) => (
              <li class="list-row adm-block" key={b.id}>
                <div class="adm-block__main">
                  <Chip block={b} />
                  <p class="adm-block__label">{b.label || <span class="adm-muted">No label</span>}</p>
                  <p class="adm-block__meta">{spaceLabel(b.space)}</p>
                  {b.inquiryId !== null && (
                    <a class="adm-block__link" href={`#/inquiry/${b.inquiryId}`}>
                      View Request
                    </a>
                  )}
                </div>
                {confirmId === b.id ? (
                  <div class="adm-block__confirm" role="group" aria-label="Confirm delete">
                    <p class="adm-block__ask">Delete this block?</p>
                    <div class="adm-block__actions">
                      <button type="button" class="btn btn--gray btn--sm adm-btn-44" onClick={() => setConfirmId(null)} disabled={deleting}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="btn btn--sm adm-btn-44 adm-btn--destructive"
                        onClick={() => remove(b.id)}
                        disabled={deleting}
                        aria-busy={deleting ? 'true' : undefined}
                      >
                        {deleting ? `Deleting${ELLIPSIS}` : 'Delete'}
                      </button>
                    </div>
                    {deleteError && (
                      <p class="adm-error" role="alert">
                        {deleteError}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    class="btn btn--plain btn--sm adm-btn-44 adm-text-red"
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmId(b.id);
                    }}
                    aria-label={`Delete ${blockText(b)}`}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form class="adm-sheet__section adm-blockform" onSubmit={add} aria-labelledby="adm-add-block">
        <h3 id="adm-add-block" class="adm-sheet__h3">
          Add a block
        </h3>
        <div class="field">
          <span class="field__label" id="adm-block-space">
            Space
          </span>
          <SegmentedRadio labelledBy="adm-block-space" options={SPACE_OPTIONS} value={space} onChange={setSpace} class="adm-segmented--full" />
        </div>
        <div class="field">
          <span class="field__label" id="adm-block-kind">
            Kind
          </span>
          <SegmentedRadio labelledBy="adm-block-kind" options={KIND_OPTIONS} value={kind} onChange={setKind} class="adm-segmented--full" />
        </div>
        <div class="field">
          <label class="field__label" for="adm-block-label">
            Label
          </label>
          <input
            id="adm-block-label"
            class="input"
            type="text"
            maxLength={120}
            placeholder="For example, the host's name"
            value={label}
            aria-describedby="adm-block-label-hint"
            onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
          />
          <span id="adm-block-label-hint" class="field__hint">
            Optional. Shown on this calendar.
          </span>
        </div>
        {error && (
          <p class="adm-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" class="btn btn--filled adm-blockform__submit" disabled={busy} aria-busy={busy ? 'true' : undefined}>
          <Icon name="plus" />
          {busy ? `Adding${ELLIPSIS}` : 'Add Block'}
        </button>
      </form>
    </>
  );
}

export function CalendarView({ month: routeMonth, day: routeDay }: { month: string | null; day: DateKey | null }) {
  const { run, navigate, refreshStats } = useAdmin();
  const today = todayKey();
  const month = routeMonth ?? (routeDay ? monthOf(routeDay) : monthOf(today));
  const [y, m] = month.split('-').map(Number);
  const [blocks, setBlocks] = useState<CalendarBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetDay, setSheetDay] = useState<DateKey | null>(routeDay);
  const [focusDate, setFocusDate] = useState<DateKey>(() => {
    if (routeDay && monthOf(routeDay) === month) return routeDay;
    return monthOf(today) === month ? today : `${month}-01`;
  });
  const wantFocus = useRef(false);
  const gridRef = useRef<HTMLTableElement>(null);
  const reqId = useRef(0);

  const load = async () => {
    const id = ++reqId.current;
    setError(null);
    setBlocks(null);
    const res = await run(api.admin.listBlocks(`${month}-01`, lastDay(month)));
    if (id !== reqId.current) return;
    if (isError(res)) {
      setError(res.error);
      setBlocks([]);
      return;
    }
    setBlocks(res);
  };

  useEffect(() => {
    load();
    if (monthOf(focusDate) !== month) setFocusDate(monthOf(today) === month ? today : `${month}-01`);
  }, [month]);

  useEffect(() => {
    if (routeDay) setSheetDay(routeDay);
  }, [routeDay]);

  // An empty month points to the next blocked date, so the first view is not a dead end.
  const [nextBlocked, setNextBlocked] = useState<DateKey | null>(null);
  useEffect(() => {
    setNextBlocked(null);
    if (!blocks || blocks.length > 0) return;
    let alive = true;
    const monthEnd = lastDay(month);
    const from = addDays(monthEnd < today ? today : monthEnd, 1);
    api.admin.listBlocks(from, addDays(from, 365)).then((res) => {
      if (!alive || isError(res) || res.length === 0) return;
      setNextBlocked(res.reduce((min, b) => (b.date < min ? b.date : min), res[0].date));
    });
    return () => {
      alive = false;
    };
  }, [blocks, month]);

  useEffect(() => {
    if (!wantFocus.current) return;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${focusDate}"]`);
    if (btn) {
      btn.focus();
      wantFocus.current = false;
    }
  }, [focusDate, month, blocks]);

  const byDate = useMemo(() => {
    const map = new Map<DateKey, CalendarBlock[]>();
    for (const b of blocks ?? []) {
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => SPACE_ORDER[a.space] - SPACE_ORDER[b.space]);
    return map;
  }, [blocks]);

  const monthBlocks = useMemo(
    () => (blocks ?? []).slice().sort((a, b) => a.date.localeCompare(b.date) || SPACE_ORDER[a.space] - SPACE_ORDER[b.space]),
    [blocks],
  );

  const goMonth = (next: string, focus?: DateKey) => {
    if (focus) {
      wantFocus.current = true;
      setFocusDate(focus);
    }
    navigate(calendarHash(next === monthOf(today) ? null : next), true);
  };

  const openDay = (date: DateKey) => {
    setFocusDate(date);
    setSheetDay(date);
  };

  const closeSheet = () => {
    setSheetDay(null);
    if (routeDay) navigate(calendarHash(routeMonth ?? monthOf(routeDay)), true);
  };

  const onGridKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const date = target.dataset?.date;
    if (!date) return;
    let next: DateKey | null = null;
    if (e.key === 'ArrowLeft') next = addDays(date, -1);
    else if (e.key === 'ArrowRight') next = addDays(date, 1);
    else if (e.key === 'ArrowUp') next = addDays(date, -7);
    else if (e.key === 'ArrowDown') next = addDays(date, 7);
    else if (e.key === 'Home') next = addDays(date, -dayOfWeek(date));
    else if (e.key === 'End') next = addDays(date, 6 - dayOfWeek(date));
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      const other = shiftMonth(monthOf(date), e.key === 'PageUp' ? -1 : 1);
      const dd = Math.min(parseKey(date).d, parseKey(lastDay(other)).d);
      next = `${other}-${String(dd).padStart(2, '0')}`;
    }
    if (!next) return;
    e.preventDefault();
    wantFocus.current = true;
    setFocusDate(next);
    if (monthOf(next) !== month) goMonth(monthOf(next));
  };

  const weeks = monthGrid(y, m);
  const sheetBlocks = sheetDay ? (blocks ?? []).filter((b) => b.date === sheetDay).sort((a, b) => SPACE_ORDER[a.space] - SPACE_ORDER[b.space]) : [];

  return (
    <div class="adm-screen">
      <PageHeader title="Calendar" subtitle="Booked, held, and closed dates. Blocked dates show as taken on the public calendar." />

      <div class="adm-calbar">
        <h2 id="adm-cal-month" class="adm-calbar__month" aria-live="polite">
          {formatMonth(y, m)}
        </h2>
        <div class="adm-calbar__nav">
          <button type="button" class="adm-iconbtn adm-iconbtn--fill" aria-label="Previous Month" onClick={() => goMonth(shiftMonth(month, -1))}>
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            class="btn btn--gray btn--sm adm-btn-44"
            onClick={() => goMonth(monthOf(today), today)}
          >
            Today
          </button>
          <button type="button" class="adm-iconbtn adm-iconbtn--fill" aria-label="Next Month" onClick={() => goMonth(shiftMonth(month, 1))}>
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>

      <ul class="adm-legend" aria-label="Key">
        <li>
          <span class="adm-chip adm-chip--booked">Booked</span> Reserved for an event
        </li>
        <li>
          <span class="adm-chip adm-chip--held">Held</span> Kept for someone, not confirmed
        </li>
        <li>
          <span class="adm-chip adm-chip--closed">Closed</span> Not available
        </li>
      </ul>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div class={`adm-calwrap${blocks ? '' : ' is-loading'}`} aria-busy={blocks ? undefined : 'true'}>
        <table class="adm-cal" ref={gridRef} aria-labelledby="adm-cal-month" onKeyDown={onGridKey}>
          <thead>
            <tr>
              {WEEKDAYS.map(([short, long]) => (
                <th scope="col" key={short}>
                  <span aria-hidden="true">{short}</span>
                  <span class="visually-hidden">{long}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((date, di) => {
                  if (!date) return <td key={di} class="adm-cal__pad" />;
                  const list = byDate.get(date) ?? [];
                  const isToday = date === today;
                  const past = date < today;
                  const label = `${formatLong(date)}${isToday ? ', today' : ''}. ${
                    list.length === 0 ? 'Nothing blocked.' : `${list.map(blockText).join('. ')}.`
                  }`;
                  return (
                    <td key={date}>
                      <button
                        type="button"
                        class={`adm-day${past ? ' is-past' : ''}${sheetDay === date ? ' is-selected' : ''}`}
                        data-date={date}
                        tabIndex={date === focusDate ? 0 : -1}
                        aria-label={label}
                        aria-current={isToday ? 'date' : undefined}
                        aria-haspopup="dialog"
                        onClick={() => openDay(date)}
                      >
                        <span class="adm-day__num">{parseKey(date).d}</span>
                        {list.length > 0 && (
                          <span class="adm-day__chips">
                            {list.slice(0, 3).map((b) => (
                              <Chip key={b.id} block={b} />
                            ))}
                            {list.length > 3 && <span class="adm-day__more">+{list.length - 3}</span>}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="adm-footnote adm-cal__hint">Select a day to see its blocks or add one. Arrow keys move between days.</p>

      <section class="adm-section" aria-labelledby="adm-cal-list">
        <div class="adm-section__head">
          <h2 id="adm-cal-list" class="adm-section__title">
            This month
          </h2>
        </div>
        {!blocks ? (
          <div class="list-group adm-list">
            <p class="list-row adm-muted">Loading{ELLIPSIS}</p>
          </div>
        ) : monthBlocks.length === 0 ? (
          <div class="list-group adm-list">
            <div class="list-row adm-cal__empty">
              <p class="adm-muted">
                Nothing blocked in {formatMonth(y, m)}.
                {nextBlocked && ` The next blocked date is ${formatShort(nextBlocked)}.`}
              </p>
              {nextBlocked && (
                <button type="button" class="btn btn--tinted btn--sm adm-btn-44" onClick={() => goMonth(monthOf(nextBlocked), nextBlocked)}>
                  Go to {formatMonth(parseKey(nextBlocked).y, parseKey(nextBlocked).m)}
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul class="list-group adm-list">
            {monthBlocks.map((b) => (
              <li key={b.id}>
                <button type="button" class="list-row adm-row adm-row--link adm-row--button" onClick={() => openDay(b.date)} aria-haspopup="dialog">
                  <span class="list-row__main">
                    <span class="adm-row__title">{b.label || KIND_LABEL[b.kind]}</span>
                    <span class="adm-row__meta">
                      <span class="adm-nowrap">{formatShort(b.date)}</span>
                      {SEP}
                      <span class="adm-nowrap">{spaceLabel(b.space)}</span>
                    </span>
                  </span>
                  <Chip block={b} />
                  <Icon name="chevron-right" class="adm-row__chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={sheetDay !== null}
        onClose={closeSheet}
        title={sheetDay ? formatLong(sheetDay) : ''}
        subtitle={sheetDay ? (sheetBlocks.length ? plural(sheetBlocks.length, 'block') : 'Open') : undefined}
      >
        {sheetDay && (
          <DaySheetContent
            key={sheetDay}
            date={sheetDay}
            blocks={sheetBlocks}
            onAdded={(b) => {
              if (monthOf(b.date) === month) setBlocks((list) => [...(list ?? []), b]);
              refreshStats();
            }}
            onDeleted={(id) => {
              setBlocks((list) => (list ?? []).filter((b) => b.id !== id));
              refreshStats();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
