/** Step 2: the kind of event, alcohol, and a visit request. */
import { useRef } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { OTHER_EVENT, eventTypes } from '../../data/event-types';
import { SwitchRow } from './ui';
import { errorId, fieldId, type Draft } from './wizard';
import { FieldError, describe } from './fields';

const TILES = [...eventTypes, OTHER_EVENT];

export function StepEvent(props: { d: Draft; update: (patch: Partial<Draft>) => void; errors: Record<string, string> }) {
  const { d, update, errors } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checked = TILES.findIndex((t) => t.slug === d.eventType);
  const tabIdx = checked >= 0 ? checked : 0;

  const pick = (i: number, focus = false) => {
    update({ eventType: TILES[i].slug });
    if (focus) refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const n = TILES.length;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    pick(next, true);
  };

  return (
    <div class="bk-step2">
      <div class="field">
        <span class="field__label" id="bk-event-label">
          What are you planning?
        </span>
        <div
          class="bk-tiles"
          role="radiogroup"
          id={fieldId('eventType')}
          aria-labelledby="bk-event-label"
          aria-describedby={errors.eventType ? errorId('eventType') : undefined}
          aria-invalid={errors.eventType ? 'true' : undefined}
        >
          {TILES.map((t, i) => {
            const on = t.slug === d.eventType;
            return (
              <button
                key={t.slug}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                class="bk-tile"
                aria-checked={on ? 'true' : 'false'}
                tabIndex={i === tabIdx ? 0 : -1}
                onClick={() => pick(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <span class="bk-tile__icon" aria-hidden="true">
                  <Icon name={t.icon} />
                </span>
                <span class="bk-tile__name">{t.name}</span>
                <span class="bk-tile__check" aria-hidden="true">
                  <Icon name="check" />
                </span>
              </button>
            );
          })}
        </div>
        <FieldError errors={errors} field="eventType" />
      </div>

      {d.eventType === 'other' && (
        <div class="field">
          <label class="field__label" for={fieldId('eventTypeOther')}>
            What kind of event?
          </label>
          <input
            id={fieldId('eventTypeOther')}
            class="input"
            type="text"
            maxLength={80}
            autoComplete="off"
            placeholder="For example, a family reunion picnic"
            value={d.eventTypeOther}
            aria-invalid={errors.eventTypeOther ? 'true' : undefined}
            aria-describedby={errors.eventTypeOther ? errorId('eventTypeOther') : undefined}
            onInput={(e) => update({ eventTypeOther: e.currentTarget.value })}
          />
          <FieldError errors={errors} field="eventTypeOther" />
        </div>
      )}

      <div class="field">
        <span class="field__label" id="bk-details-label">
          Details
        </span>
        <ul class="list-group bk-list" aria-labelledby="bk-details-label">
          <SwitchRow
            id={fieldId('servingAlcohol')}
            icon="wine"
            title="We plan to serve alcohol"
            hint="Alcohol is allowed at the venue."
            checked={d.servingAlcohol}
            onChange={(servingAlcohol) => update({ servingAlcohol })}
          />
          <SwitchRow
            id={fieldId('wantsVisit')}
            icon="map-pin"
            title="I'd like to see the space first"
            hint="Tell us which days and times work for you."
            checked={d.wantsVisit}
            onChange={(wantsVisit) => update({ wantsVisit })}
          />
        </ul>
      </div>

      {d.wantsVisit && (
        <div class="field">
          <label class="field__label" for={fieldId('visitNotes')}>
            When works for a visit? <span class="bk-optional">Optional</span>
          </label>
          <textarea
            id={fieldId('visitNotes')}
            class="input bk-textarea--short"
            maxLength={500}
            rows={3}
            placeholder="Days and times that work for you"
            value={d.visitNotes}
            aria-invalid={errors.visitNotes ? 'true' : undefined}
            aria-describedby={describe(errors.visitNotes && errorId('visitNotes'))}
            onInput={(e) => update({ visitNotes: e.currentTarget.value })}
          />
          <FieldError errors={errors} field="visitNotes" />
        </div>
      )}

      <div class="field">
        <span class="field__label" id="bk-included-label">
          Good to know
        </span>
        <ul class="list-group bk-list" aria-labelledby="bk-included-label">
          <li class="bk-fact">
            <span class="bk-row-icon" aria-hidden="true">
              <Icon name="utensils" />
            </span>
            <span class="bk-fact__text">
              <strong>Catering is not included.</strong>
              <span class="bk-fact__hint">Bring the caterer of your choice, or your own food and drinks.</span>
            </span>
          </li>
          <li class="bk-fact">
            <span class="bk-row-icon" aria-hidden="true">
              <Icon name="parking" />
            </span>
            <span class="bk-fact__text">
              <strong>Parking is included.</strong>
              <span class="bk-fact__hint">On-site parking comes with every booking.</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
