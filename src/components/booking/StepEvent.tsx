/** Step 2: the kind of event (serif chips), a visit request, and two inclusions good to know. */
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
      <section class="bk-panel" aria-labelledby="bk-event-label">
        <h3 class="bk-panel__title" id="bk-event-label">
          What are you planning?
        </h3>
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
                <span class="bk-tile__check" aria-hidden="true">
                  <Icon name="check" />
                </span>
                <span class="bk-tile__name">{t.name}</span>
              </button>
            );
          })}
        </div>
        <FieldError errors={errors} field="eventType" />

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
              placeholder="For example, a fundraiser or a club meeting"
              value={d.eventTypeOther}
              aria-invalid={errors.eventTypeOther ? 'true' : undefined}
              aria-describedby={errors.eventTypeOther ? errorId('eventTypeOther') : undefined}
              onInput={(e) => update({ eventTypeOther: e.currentTarget.value })}
            />
            <FieldError errors={errors} field="eventTypeOther" />
          </div>
        )}
      </section>

      <section class="bk-panel" aria-labelledby="bk-details-label">
        <h3 class="bk-panel__title" id="bk-details-label">
          Visit first
        </h3>
        <ul class="list-group bk-list" aria-labelledby="bk-details-label">
          <SwitchRow
            id={fieldId('wantsVisit')}
            title="I would like to see the space before I book"
            hint="We will arrange a time with you."
            checked={d.wantsVisit}
            onChange={(wantsVisit) => update({ wantsVisit })}
          />
        </ul>

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
      </section>

      <section class="bk-facts" aria-labelledby="bk-included-label">
        <h3 class="bk-facts__title" id="bk-included-label">
          Good to know
        </h3>
        <ul class="bk-facts__list">
          <li class="bk-fact">
            <Icon name="check" class="bk-fact__check" />
            <span class="bk-fact__text">
              <span>Tables and chairs are included.</span>
              <span class="bk-fact__hint">They come with the rental, and you may use them if you wish.</span>
            </span>
          </li>
          <li class="bk-fact">
            <Icon name="check" class="bk-fact__check" />
            <span class="bk-fact__text">
              <span>Parking is included.</span>
              <span class="bk-fact__hint">A large paved lot sits beside the building.</span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
