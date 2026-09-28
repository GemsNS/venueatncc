/**
 * Controls shared by the booking islands, built to the HIG web spec (docs/design/hig-web-spec.md):
 * segmented control (radiogroup with arrow keys), stepper, guest count field, list-row switch,
 * spinner, per-space status, and the estimate breakdown.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import type { IconName } from '../../shared/icons';
import { formatUSD } from '../../shared/pricing';
import type { Estimate } from '../../shared/types';
import { clamp, formatMoney } from './lib';

/* ---------- Segmented control ---------- */

export interface SegOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string>(props: {
  id?: string;
  labelId?: string;
  label?: string;
  options: SegOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  describedBy?: string;
  invalid?: boolean;
  full?: boolean;
  class?: string;
}) {
  const { options, value, onChange } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIdx = options.findIndex((o) => o.value === value && !o.disabled);
  const tabIdx = checkedIdx >= 0 ? checkedIdx : options.findIndex((o) => !o.disabled);

  const move = (from: number, dir: 1 | -1) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    if (options[i].disabled) return;
    onChange(options[i].value);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(i, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(i, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(-1 + options.length, 1);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(0, -1);
    }
  };

  const cls = ['segmented', 'bk-seg', props.full ? 'bk-seg--full' : '', props.class ?? ''].filter(Boolean).join(' ');
  return (
    <div
      role="radiogroup"
      id={props.id}
      class={cls}
      aria-labelledby={props.labelId}
      aria-label={props.labelId ? undefined : props.label}
      aria-describedby={props.describedBy || undefined}
      aria-invalid={props.invalid ? 'true' : undefined}
      style={{ '--seg-count': String(options.length) }}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          class="segmented__item"
          aria-checked={o.value === value ? 'true' : 'false'}
          aria-disabled={o.disabled ? 'true' : undefined}
          tabIndex={i === tabIdx ? 0 : -1}
          onClick={() => {
            if (!o.disabled) onChange(o.value);
          }}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Stepper ---------- */

function StepButton(props: { dir: -1 | 1; label: string; atLimit: boolean; onStep: (dir: -1 | 1, big: boolean) => void }) {
  return (
    <button
      type="button"
      class="bk-stepper__btn"
      aria-label={props.label}
      aria-disabled={props.atLimit ? 'true' : undefined}
      onClick={(e) => {
        if (!props.atLimit) props.onStep(props.dir, e.shiftKey);
      }}
    >
      <Icon name={props.dir < 0 ? 'minus' : 'plus'} />
    </button>
  );
}

/** A minus/plus capsule next to its visible value. Shift-click steps by ten. */
export function Stepper(props: {
  id?: string;
  labelId: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
  decLabel: string;
  incLabel: string;
  describedBy?: string;
}) {
  const { value, min, max, onChange } = props;
  const step = (dir: -1 | 1, big: boolean) => onChange(clamp(value + dir * (big ? 10 : 1), min, max));
  return (
    <div class="bk-stepper" id={props.id} role="group" aria-labelledby={props.labelId} aria-describedby={props.describedBy || undefined}>
      <StepButton dir={-1} label={props.decLabel} atLimit={value <= min} onStep={step} />
      <output class="bk-stepper__value num" aria-live="polite">
        {props.format(value)}
      </output>
      <StepButton dir={1} label={props.incLabel} atLimit={value >= max} onStep={step} />
    </div>
  );
}

/** Guest count: stepper buttons around a numeric field, because counts vary widely. */
export function CountField(props: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  describedBy?: string;
  invalid?: boolean;
  decLabel: string;
  incLabel: string;
  /**
   * Announce the new count after a step (the buttons keep focus, so the change is otherwise silent).
   * Leave it out where the page already announces the result, as the capacity planner does.
   */
  announceAs?: (n: number) => string;
}) {
  const { value, min, max, onChange } = props;
  const [text, setText] = useState(String(value));
  const [stepped, setStepped] = useState('');

  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // only follow outside changes to the number
  }, [value]);

  const step = (dir: -1 | 1, big: boolean) => {
    const next = clamp(value + dir * (big ? 10 : 1), min, max);
    setText(String(next));
    onChange(next);
    if (props.announceAs) setStepped(props.announceAs(next));
  };

  return (
    <div class="bk-stepper bk-stepper--field">
      <StepButton dir={-1} label={props.decLabel} atLimit={value <= min} onStep={step} />
      <input
        id={props.id}
        class="bk-stepper__input num"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={text}
        aria-describedby={props.describedBy || undefined}
        aria-invalid={props.invalid ? 'true' : undefined}
        onInput={(e) => {
          const raw = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 4);
          setText(raw);
          if (raw === '') return;
          const n = Number(raw);
          if (n >= min && n <= max) onChange(n);
          else if (n > max) onChange(max);
        }}
        onBlur={() => {
          const n = text === '' ? value : clamp(Number(text), min, max);
          setText(String(n));
          if (n !== value) onChange(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
          }
        }}
      />
      <StepButton dir={1} label={props.incLabel} atLimit={value >= max} onStep={step} />
      {props.announceAs && (
        <span class="visually-hidden" aria-live="polite">
          {stepped}
        </span>
      )}
    </div>
  );
}

/* ---------- Switch in a list row ---------- */

export function SwitchRow(props: {
  id: string;
  title: string;
  hint?: string;
  icon?: IconName;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <li class="bk-switch-row">
      <button
        type="button"
        role="switch"
        id={props.id}
        class="bk-switch-row__btn"
        aria-checked={props.checked ? 'true' : 'false'}
        aria-labelledby={`${props.id}-t`}
        aria-describedby={props.hint ? `${props.id}-h` : undefined}
        onClick={() => props.onChange(!props.checked)}
      >
        {props.icon && (
          <span class="bk-row-icon" aria-hidden="true">
            <Icon name={props.icon} />
          </span>
        )}
        <span class="bk-switch-row__text">
          <span id={`${props.id}-t`} class="bk-switch-row__title">
            {props.title}
          </span>
          {props.hint && (
            <span id={`${props.id}-h`} class="bk-switch-row__hint">
              {props.hint}
            </span>
          )}
        </span>
        <span class="bk-switch" aria-hidden="true">
          <span class="bk-switch__knob" />
        </span>
      </button>
    </li>
  );
}

/* ---------- Small pieces ---------- */

export function Spinner() {
  return <span class="bk-spinner" aria-hidden="true" />;
}

export function SpaceStatus(props: { free: boolean }) {
  return props.free ? (
    <span class="bk-status bk-status--open">
      <Icon name="check-circle" />
      Open
    </span>
  ) : (
    <span class="bk-status bk-status--booked">
      <Icon name="x" />
      Booked
    </span>
  );
}

export function Note(props: { tone?: 'info' | 'warn'; id?: string; children: ComponentChildren; icon?: IconName }) {
  return (
    <div class={`bk-note bk-note--${props.tone ?? 'info'}`} id={props.id}>
      <Icon name={props.icon ?? 'info'} />
      <div class="bk-note__body">{props.children}</div>
    </div>
  );
}

/* ---------- Estimate breakdown ---------- */

/**
 * What the estimate says is due. estimate() already folds the balance window in: close to the
 * event, bookingDeposit equals the total. Never recompute it from dates here.
 */
export function payment(est: Estimate): { reserve: number; balance: number; full: boolean } {
  const balance = Math.max(0, est.total - est.bookingDeposit);
  return { reserve: est.bookingDeposit, balance, full: est.total > 0 && balance === 0 };
}

export function EstimateView(props: { est: Estimate; notes?: boolean; live?: boolean; showTotal?: boolean }) {
  const { est } = props;
  const { reserve, balance, full } = payment(est);
  return (
    <div class="bk-est">
      <ul class="bk-est__lines">
        {est.lines.map((l) => (
          <li class="bk-est__line" data-kind={l.kind} key={l.label}>
            <span class="bk-est__label">{l.label}</span>
            <span class="bk-est__amt num">{formatMoney(l.amount)}</span>
          </li>
        ))}
      </ul>
      {props.showTotal !== false ? (
        <div class="bk-est__total" aria-live={props.live ? 'polite' : undefined} aria-atomic={props.live ? 'true' : undefined}>
          <span>Estimated total</span>
          <span class="bk-est__total-amt num">{formatUSD(est.total)}</span>
        </div>
      ) : (
        <hr class="bk-est__rule" />
      )}
      <dl class="bk-est__pay">
        {full ? (
          <div class="bk-est__payrow">
            <dt>Due to reserve</dt>
            <dd class="num">{formatUSD(reserve)}</dd>
          </div>
        ) : (
          <>
            <div class="bk-est__payrow">
              <dt>Due to reserve</dt>
              <dd class="num">{formatUSD(reserve)}</dd>
            </div>
            {balance > 0 && (
              <div class="bk-est__payrow">
                <dt>Balance</dt>
                <dd class="num">{formatUSD(balance)}</dd>
              </div>
            )}
          </>
        )}
        {est.refundableDeposit > 0 && (
          <div class="bk-est__payrow">
            <dt>Refundable damage deposit</dt>
            <dd class="num">{formatUSD(est.refundableDeposit)}</dd>
          </div>
        )}
      </dl>
      {props.notes !== false && (
        <ul class="bk-est__notes">
          {est.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
