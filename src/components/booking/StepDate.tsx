/** Step 1: the calendar, guests, space, start time, and hours. */
import { site } from '../../data/site';
import { spaceIsFree } from '../../shared/availability';
import { capacityError, suggestSpace } from '../../shared/capacity';
import { addHours, formatShort, formatTime } from '../../shared/dates';
import { dayTypeOf } from '../../shared/pricing';
import type { AvailabilityDay, DateKey } from '../../shared/types';
import { Calendar, type CalStatus } from './Calendar';
import {
  HOURS_MAX,
  HOURS_MIN,
  SINGLE_SPACES,
  SPACE_CHOICE_TITLE,
  SPACE_HINT,
  SPACES,
  TIME_OPTIONS,
  guestsLabel,
  hoursLabel,
  latestBookableDate,
  minimumHoursNote,
  spaceLabel,
  telHref,
} from './lib';
import { ChoiceList, CountField, Note, Stepper, type ChoiceOption } from './ui';
import { ymOf, type YM } from './useAvailability';
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
  onUnavailable: (date: DateKey, status: CalStatus) => void;
  onGuests: (n: number) => void;
  /** A short message after someone picks a day that cannot be booked. */
  calMsg: string;
}

export function StepDate(props: StepDateProps) {
  const { d, update, errors, today, view, days } = props;
  const latest = latestBookableDate(today);
  const day = d.date ? days[d.date] : undefined;
  const taken = day ? SINGLE_SPACES.filter((s) => day.spaces[s] === 'taken') : [];
  const capErr = capacityError(d.space, d.guests);
  const suggestion = capErr ? suggestSpace(d.guests) : null;
  const suggestionFree = suggestion ? !day || spaceIsFree(day, suggestion) : false;
  const dayType = d.date ? dayTypeOf(d.date) : null;

  // Each space by its own limit; never one combined figure for both.
  const spaceOptions: ChoiceOption<(typeof SPACES)[number]>[] = SPACES.map((s) => ({
    value: s,
    title: SPACE_CHOICE_TITLE[s],
    hint: SPACE_HINT[s],
    disabled: day ? day.status !== 'past' && !spaceIsFree(day, s) : false,
    disabledNote: s === 'both' && taken.length < 2 ? 'Partly booked' : 'Booked',
  }));

  // One space taken on the chosen day: say which, so the Booked label is not the only clue.
  const bookedNote =
    d.date && taken.length === 1 ? `${spaceLabel(taken[0])} is booked on ${formatShort(d.date)}. ${spaceLabel(SINGLE_SPACES.find((s) => s !== taken[0]) ?? 'indoor')} is open.` : '';

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
          min={ymOf(today)}
          max={ymOf(latest)}
          lastDate={latest}
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
            announceAs={guestsLabel}
          />
          {errors.guests && errors.guests !== capErr && <FieldError errors={errors} field="guests" />}
          {capErr && (
            <Note tone="warn" id={capId}>
              <p>{capErr}</p>
              {suggestion && suggestion !== d.space && suggestionFree && (
                <button type="button" class="btn btn--tinted btn--sm" onClick={() => update({ space: suggestion, spaceChosen: true })}>
                  Use {spaceLabel(suggestion)}
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
          <ChoiceList
            id={fieldId('space')}
            labelId="bk-space-label"
            options={spaceOptions}
            value={d.space}
            onChange={(space) => update({ space, spaceChosen: true })}
            describedBy={describe(bookedNote ? spaceHintId : '', errors.space ? errorId('space') : '')}
            invalid={Boolean(errors.space)}
          />
          {bookedNote && (
            <p class="field__hint" id={spaceHintId}>
              {bookedNote}
            </p>
          )}
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
          . Ask us about time to set up and clean up.
          {dayType ? ` ${minimumHoursNote(dayType)}` : ''}
        </p>
      </div>
    </div>
  );
}
