/**
 * A date field for the home page date checker and the price estimator (HIG pickers: a compact
 * control that shows the date and opens a calendar in a popover).
 *
 * The field is a button styled like a text field. It reads "Choose a date" until a date is chosen,
 * then the date ("Saturday, October 17"). It opens the booking calendar in a modal <dialog>: the top
 * layer keeps it clear of the hero's clipped photo frame, and the page behind stays inert. The dialog
 * sits under the button (above it when only that side has room) and scrolls with the page.
 * Esc, the Close button, and a tap outside dismiss it, and focus returns to the button. Days before
 * today, after the latest date the venue takes requests for, and fully booked days cannot be chosen;
 * picking one says why inside the popover.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import type { DateKey, DayStatus } from '../../shared/types';
import { Calendar } from './Calendar';
import { formatPicked, unavailableMessage } from './lib';
import { ymOf, type YM } from './useAvailability';

/** Room kept between the popover and the screen edges, and between the popover and the button. */
const EDGE = 8;
const GAP = 8;
/**
 * The popover matches the field's width within these bounds: at least seven 44px day cells plus its
 * padding, and no wider than a month reads well (the estimator's field spans a wide card on desktop).
 */
const MIN_WIDTH = 336;
const MAX_WIDTH = 368;

export interface DateFieldProps {
  /** The button's id. The popover is `${id}-pop` and the calendar grid `${id}-cal`. */
  id: string;
  /** Id of the visible label. With the value (the date, or "Choose a date") it names the button. */
  labelId: string;
  value: DateKey | '';
  onChange: (date: DateKey) => void;
  /** Today in the venue's time zone; empty until the island hydrates. */
  today: DateKey | '';
  /** The last day the venue takes requests for. */
  latest: DateKey | '';
  statusOf: (date: DateKey) => DayStatus | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Called when the popover opens and whenever it shows another month, to load that month's availability. */
  onMonth?: (view: YM) => void;
  describedBy?: string;
  class?: string;
}

export function DateField(props: DateFieldProps) {
  const { id, value, today, latest } = props;
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDialogElement>(null);
  const upRef = useRef(false);
  const onMonthRef = useRef(props.onMonth);
  onMonthRef.current = props.onMonth;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<YM>(() => ymOf(value || today || '2000-01-01'));
  const [msg, setMsg] = useState('');

  const popId = `${id}-pop`;
  const valueId = `${id}-value`;

  /**
   * Put the popover under the button, or above it when only that side has room, inside the screen's
   * width. The top layer positions it against the page, so it scrolls with the button. On opening,
   * when neither side has room, the page scrolls until the calendar fits (or reaches the top).
   */
  const place = (opening: boolean) => {
    const dlg = popRef.current;
    const btn = btnRef.current;
    if (!dlg || !btn || !dlg.open) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let r = btn.getBoundingClientRect();
    const width = Math.min(vw - 2 * EDGE, Math.max(MIN_WIDTH, Math.min(r.width, MAX_WIDTH)));
    dlg.style.width = `${width}px`;
    dlg.style.left = `${Math.max(EDGE, Math.min(r.left, vw - EDGE - width)) + window.scrollX}px`;
    const h = dlg.offsetHeight;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const up = h > below && h <= above;
    upRef.current = up;
    if (!up && opening && h > below) {
      const by = Math.min(h - below, r.bottom + GAP - EDGE);
      if (by > 0) {
        window.scrollBy({ top: by, behavior: 'instant' });
        r = btn.getBoundingClientRect();
      }
    }
    dlg.style.top = `${(up ? r.top - GAP - h : r.bottom + GAP) + window.scrollY}px`;
  };

  const show = () => {
    if (!today || open) return;
    const start = ymOf(value && value >= today ? value : today);
    setView(start);
    setMsg('');
    setOpen(true);
    onMonthRef.current?.(start);
  };

  // The close event does the rest (below).
  const hide = () => popRef.current?.close();

  const onView = (next: YM) => {
    setView(next);
    setMsg('');
    onMonthRef.current?.(next);
  };

  // Present the dialog once the calendar has rendered into it, then put focus on its day.
  useLayoutEffect(() => {
    const dlg = popRef.current;
    const btn = btnRef.current;
    if (!open || !dlg || !btn || dlg.open) return;
    // showModal() focuses the first control inside, which can scroll the page (smoothly, and past the
    // scroll padding the page keeps for its sticky bars). Make that scroll instant and put it back at
    // once, before the popover takes its place.
    const r = btn.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    dlg.style.left = `${r.left + sx}px`;
    dlg.style.top = `${r.bottom + GAP + sy}px`;
    const html = document.documentElement;
    const behavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    dlg.showModal();
    window.scrollTo({ left: sx, top: sy, behavior: 'instant' });
    html.style.scrollBehavior = behavior;
    place(true);
    dlg.querySelector<HTMLButtonElement>('[data-date][tabindex="0"]')?.focus({ preventScroll: true });
  }, [open]);

  // Esc, Close, a tap outside, or a chosen day: close, and focus goes back to the button.
  useEffect(() => {
    const dlg = popRef.current;
    if (!dlg) return;
    const onClose = () => {
      setOpen(false);
      btnRef.current?.focus();
    };
    // A tap on the backdrop reaches the dialog itself; the dialog has no padding of its own.
    const onClick = (e: MouseEvent) => {
      if (e.target === dlg) dlg.close();
    };
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('click', onClick);
    return () => {
      dlg.removeEventListener('close', onClose);
      dlg.removeEventListener('click', onClick);
      if (dlg.open) dlg.close();
    };
  }, []);

  // Follow the button when the window is resized or the phone turns, and keep a popover above the
  // button anchored to it when the calendar grows or shrinks (a six-week month, a message).
  useEffect(() => {
    if (!open) return;
    const onResize = () => place(false);
    window.addEventListener('resize', onResize);
    const dlg = popRef.current;
    const ro =
      dlg && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (upRef.current) place(false);
          })
        : null;
    if (dlg) ro?.observe(dlg);
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        class={`input bk-datefield${props.class ? ` ${props.class}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={popId}
        aria-labelledby={`${props.labelId} ${valueId}`}
        aria-describedby={props.describedBy || undefined}
        onClick={show}
      >
        <Icon name="calendar" class="bk-datefield__icon" />
        <span id={valueId} class={`bk-datefield__value${value ? '' : ' is-empty'}`}>
          {value ? formatPicked(value, today) : 'Choose a date'}
        </span>
        <Icon name="chevron-down" class="bk-datefield__chevron" />
      </button>
      <dialog ref={popRef} id={popId} class="bk-datepop" aria-label="Choose a date">
        {open && today && (
          <div class="bk-datepop__body">
            <Calendar
              id={`${id}-cal`}
              view={view}
              onView={onView}
              min={ymOf(today)}
              max={ymOf(latest || today)}
              lastDate={latest || undefined}
              today={today}
              selected={value}
              onSelect={(date) => {
                props.onChange(date);
                hide();
              }}
              statusOf={props.statusOf}
              loading={props.loading}
              error={props.error}
              onRetry={props.onRetry}
              onUnavailable={(date, status) => setMsg(unavailableMessage(date, status))}
              onClose={hide}
              keepScroll
              headingLevel={2}
            />
            <p class="bk-datepop__msg" role="status">
              {msg}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
