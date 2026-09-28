/** Step 1: the calendar, guests, space, start time, and hours. */
import { site } from '../../data/site';
import { spaceIsFree } from '../../shared/availability';
import { CAPACITY, capacityError, suggestSpace } from '../../shared/capacity';
import { addHours, formatShort, formatTime } from '../../shared/dates';
import { dayTypeOf } from '../../shared/pricing';
import type { AvailabilityDay, DateKey, DayStatus, SpaceChoice } from '../../shared/types';
import { Calendar } from './Calendar';
import { HOURS_MAX, HOURS_MIN, SINGLE_SPACES, SPACE_SHORT, SPACES, TIME_OPTIONS, hoursLabel, minimumHoursNote, spaceLabel, telHref } from './lib';
import { CountField, Note, Segmented, Stepper } from './ui';
import { addMonths, type YM } from './useAvailability';
import { GUESTS_MAX, GUESTS_MIN, errorId, fieldId, type Draft } from './wizard';
import { FieldError, describe } from './fields';

export interface StepDateProps {
  d: Draft;
  update: (patch: Partial<Draft>) => void;
  errors: Record<string, string>;
  today: DateKey;
  view: YM;
  onView: (v: YM) => void;
  days: Record<DateKey, AvailabilityDay>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onUnavailable: (date: DateKey, status: DayStatus) => void;
  onGuests: (n: number) => void;
  /** A short message after someone picks a day that cannot be booked. */
  calMsg: string;
}

function spaceSentence(space: SpaceChoice): string {
  if (space === 'both') return `The indoor hall and the outdoor space together, for up to ${CAPACITY.both} guests.`;
  return `${spaceLabel(space)} holds up to ${CAPACITY[space]} guests.`;
}

export function StepDate(props: StepDateProps) {
  const { d, update, errors, today, view, days } = props;
  const day = d.date ? days[d.date] : undefined;
  const taken = day ? SINGLE_SPACES.filter((s) => day.spaces[s] === 'taken') : [];
  const capErr = capacityError(d.space, d.guests);
  const suggestion = capErr ? suggestSpace(d.guests) : null;
  const suggestionFree = suggestion ? !day || spaceIsFree(day, suggestion) : false;
  const dayType = d.date ? dayTypeOf(d.date) : null;

  const spaceOptions = SPACES.map((s) => ({
    value: s,
    label: SPACE_SHORT[s],
    disabled: day ? day.status !== 'past' && !spaceIsFree(day, s) : false,
  }));

  const capId = 'bk-guests-cap';
  const spaceHintId = 'bk-space-hint';
  const hoursHintId = 'bk-hours-hint';

  return (
    <div class="bk-step1">
      <section class="bk-panel bk-cal-panel" aria-label="Choose a date">
        <Calendar
          id={fieldId('date')}
          view={view}
          onView={props.onView}
          min={{ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }}
          max={addMonths({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }, 23)}
          today={today}
          selected={d.date}
          onSelect={(date) => update({ date })}
          statusOf={(k) => days[k]?.status}
          loading={props.loading}
          error={props.error}
          onRetry={props.onRetry}
          describedBy={errors.date ? errorId('date') : undefined}
          onUnavailable={props.onUnavailable}
        />
        <FieldError errors={errors} field="date" />
        <p class="bk-cal__chosen">
          {props.calMsg ? (
            <span class="bk-cal__msg">{props.calMsg}</span>
          ) : d.date ? (
            <>
              <span class="secondary">Selected: </span>
              <strong>{formatShort(d.date)}</strong>
            </>
          ) : (
            <span class="secondary">Choose a day to see which spaces are open.</span>
          )}
        </p>
      </section>

      <div class="bk-choices">
        <div class="field">
          <label class="field__label" for={fieldId('guests')}>
            Guests
          </label>
          <CountField
            id={fieldId('guests')}
            value={d.guests}
            min={GUESTS_MIN}
            max={GUESTS_MAX}
            onChange={props.onGuests}
            describedBy={describe(capErr ? capId : '', errors.guests && errors.guests !== capErr ? errorId('guests') : '')}
            invalid={Boolean(errors.guests)}
            decLabel="Fewer guests"
            incLabel="More guests"
          />
          {errors.guests && errors.guests !== capErr && <FieldError errors={errors} field="guests" />}
          {capErr && (
            <Note tone="warn" id={capId}>
              <p>{capErr}</p>
              {suggestion && suggestion !== d.space && suggestionFree && (
                <button type="button" class="btn btn--tinted btn--sm" onClick={() => update({ space: suggestion, spaceChosen: true })}>
                  Use {SPACE_SHORT[suggestion]} Space
                </button>
              )}
              {suggestion && suggestion !== d.space && !suggestionFree && d.date && (
                <p>
                  {spaceLabel(suggestion)} is booked on {formatShort(d.date)}. Try another date.
                </p>
              )}
              {!suggestion && (
                <a class="btn btn--tinted btn--sm" href={telHref(site.contact.phoneE164)}>
                  Call {site.contact.phone}
                </a>
              )}
            </Note>
          )}
        </div>

        <div class="field">
          <span class="field__label" id="bk-space-label">
            Space
          </span>
          <Segmented
            id={fieldId('space')}
            labelId="bk-space-label"
            options={spaceOptions}
            value={d.space}
            onChange={(space) => update({ space, spaceChosen: true })}
            describedBy={describe(spaceHintId, errors.space ? errorId('space') : '')}
            invalid={Boolean(errors.space)}
            full
          />
          <p class="field__hint" id={spaceHintId}>
            {taken.length > 0 && d.date ? (
              <>
                Booked on {formatShort(d.date)}: {taken.map((s) => spaceLabel(s)).join(' and ')}.{' '}
              </>
            ) : null}
            {spaceSentence(d.space)}
          </p>
          <FieldError errors={errors} field="space" />
        </div>

        <div class="bk-pair">
          <div class="field">
            <label class="field__label" for={fieldId('startTime')}>
              Start time
            </label>
            <select
              id={fieldId('startTime')}
              class="input bk-select"
              value={d.startTime}
              aria-invalid={errors.startTime ? 'true' : undefined}
              aria-describedby={errors.startTime ? errorId('startTime') : undefined}
              onChange={(e) => update({ startTime: e.currentTarget.value })}
            >
              {TIME_OPTIONS.map((t) => (
                <option value={t.value} key={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <FieldError errors={errors} field="startTime" />
          </div>

          <div class="field">
            <span class="field__label" id="bk-hours-label">
              Hours
            </span>
            <Stepper
              id={fieldId('hours')}
              labelId="bk-hours-label"
              value={d.hours}
              min={HOURS_MIN}
              max={HOURS_MAX}
              onChange={(hours) => update({ hours })}
              format={hoursLabel}
              decLabel="Fewer hours"
              incLabel="More hours"
              describedBy={describe(hoursHintId, errors.hours ? errorId('hours') : '')}
            />
            <FieldError errors={errors} field="hours" />
          </div>
        </div>
        <p class="field__hint bk-hours-hint" id={hoursHintId}>
          <span class="num">
            {formatTime(d.startTime)} to {formatTime(addHours(d.startTime, d.hours))}
          </span>
          . Include time to set up and clean up.
          {dayType ? ` ${minimumHoursNote(dayType)}` : ''}
        </p>
      </div>
    </div>
  );
}
