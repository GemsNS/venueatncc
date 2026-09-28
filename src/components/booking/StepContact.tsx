/** Step 3: who to contact and how. */
import type { ContactPreference } from '../../shared/types';
import { Segmented } from './ui';
import { emailError, errorId, fieldId, type Draft } from './wizard';
import { FieldError, describe } from './fields';

const PREFS: { value: ContactPreference; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'text', label: 'Text' },
];

export function StepContact(props: {
  d: Draft;
  update: (patch: Partial<Draft>) => void;
  errors: Record<string, string>;
  setError: (field: string, message: string | null) => void;
}) {
  const { d, update, errors } = props;
  const phoneNeeded = d.contactPreference !== 'email';

  return (
    <div class="bk-step3">
      <div class="field">
        <label class="field__label" for={fieldId('name')}>
          Your name
        </label>
        <input
          id={fieldId('name')}
          class="input"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={120}
          value={d.name}
          aria-invalid={errors.name ? 'true' : undefined}
          aria-describedby={describe(errors.name && errorId('name'))}
          onInput={(e) => update({ name: e.currentTarget.value })}
        />
        <FieldError errors={errors} field="name" />
      </div>

      <div class="field">
        <label class="field__label" for={fieldId('email')}>
          Email
        </label>
        <input
          id={fieldId('email')}
          class="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellcheck={false}
          maxLength={200}
          placeholder="name@example.com"
          value={d.email}
          aria-invalid={errors.email ? 'true' : undefined}
          aria-describedby={describe(errors.email && errorId('email'))}
          onInput={(e) => update({ email: e.currentTarget.value })}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v.trim()) props.setError('email', emailError(v));
          }}
        />
        <FieldError errors={errors} field="email" />
      </div>

      <div class="field">
        <label class="field__label" for={fieldId('phone')}>
          Phone {!phoneNeeded && <span class="bk-optional">Optional</span>}
        </label>
        <input
          id={fieldId('phone')}
          class="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={40}
          placeholder="(757) 555-0123"
          value={d.phone}
          aria-invalid={errors.phone ? 'true' : undefined}
          aria-describedby={describe(errors.phone && errorId('phone'))}
          onInput={(e) => update({ phone: e.currentTarget.value })}
        />
        <FieldError errors={errors} field="phone" />
      </div>

      <div class="field">
        <span class="field__label" id="bk-pref-label">
          How should we reach you?
        </span>
        <Segmented
          id={fieldId('contactPreference')}
          labelId="bk-pref-label"
          options={PREFS}
          value={d.contactPreference}
          onChange={(contactPreference) => update({ contactPreference })}
          describedBy={describe(errors.contactPreference && errorId('contactPreference'))}
          full
        />
        <FieldError errors={errors} field="contactPreference" />
      </div>

      <div class="field">
        <label class="field__label" for={fieldId('message')}>
          Anything else we should know? <span class="bk-optional">Optional</span>
        </label>
        <textarea
          id={fieldId('message')}
          class="input"
          maxLength={4000}
          rows={4}
          placeholder="Questions, plans, or special requests"
          value={d.message}
          aria-invalid={errors.message ? 'true' : undefined}
          aria-describedby={describe(errors.message && errorId('message'))}
          onInput={(e) => update({ message: e.currentTarget.value })}
        />
        <FieldError errors={errors} field="message" />
      </div>
    </div>
  );
}
