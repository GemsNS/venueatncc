import { useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import { Icon } from '../islands/Icon';
import { useAdmin } from './context';
import { ConfirmDialog } from './Dialog';
import { SHOW_DEMO } from './demo-tools';
import { ELLIPSIS } from './format';
import { PageHeader } from './ui';

const MIN_PASSWORD = 12;

type Field = 'current' | 'next' | 'confirm';

function PasswordForm({ disabled }: { disabled: boolean }) {
  const { run, toast } = useAdmin();
  const [values, setValues] = useState<Record<Field, string>>({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [busy, setBusy] = useState(false);

  const set = (f: Field) => (e: Event) => setValues((v) => ({ ...v, [f]: (e.target as HTMLInputElement).value }));

  const validate = (): Partial<Record<Field, string>> => {
    const out: Partial<Record<Field, string>> = {};
    if (!values.current) out.current = 'Enter your current password.';
    if (values.next.length < MIN_PASSWORD) out.next = `Use at least ${MIN_PASSWORD} characters.`;
    else if (values.next === values.current) out.next = 'Choose a password you have not used here.';
    if (!out.next && values.confirm !== values.next) out.confirm = 'The passwords do not match.';
    return out;
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy || disabled) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (['current', 'next', 'confirm'] as Field[]).find((f) => found[f]);
      if (first) document.getElementById(`adm-pw-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const res = await run(api.admin.changePassword(values.current, values.next));
    setBusy(false);
    if (isError(res)) {
      setErrors({
        current: res.fields?.current,
        next: res.fields?.next,
        form: res.fields?.current || res.fields?.next ? undefined : res.error,
      });
      return;
    }
    setValues({ current: '', next: '', confirm: '' });
    setErrors({});
    toast('Password changed.');
  };

  const field = (f: Field, label: string, autocomplete: string, hint?: string) => {
    const err = errors[f];
    const hintId = hint ? `adm-pw-${f}-hint` : undefined;
    const errId = err ? `adm-pw-${f}-error` : undefined;
    return (
      <div class="field">
        <label class="field__label" for={`adm-pw-${f}`}>
          {label}
        </label>
        <input
          id={`adm-pw-${f}`}
          class="input"
          type="password"
          autocomplete={autocomplete}
          value={values[f]}
          onInput={set(f)}
          aria-invalid={err ? 'true' : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
        />
        {hint && (
          <span id={hintId} class="field__hint">
            {hint}
          </span>
        )}
        {err && (
          <span id={errId} class="field__error">
            {err}
          </span>
        )}
      </div>
    );
  };

  return (
    <form class="adm-card adm-form" onSubmit={submit} noValidate>
      <fieldset class="adm-fieldset" disabled={disabled}>
        <legend class="visually-hidden">Change password</legend>
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password', 'new-password', `At least ${MIN_PASSWORD} characters.`)}
        {field('confirm', 'Confirm new password', 'new-password')}
        {errors.form && (
          <p class="adm-error" role="alert">
            {errors.form}
          </p>
        )}
        <div>
          <button type="submit" class="btn btn--filled" disabled={busy || disabled} aria-busy={busy ? 'true' : undefined}>
            {busy ? `Changing${ELLIPSIS}` : 'Change Password'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function SettingsView({ onReset }: { onReset: () => Promise<string | null> }) {
  const { user, signOut } = useAdmin();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const doReset = async () => {
    setResetBusy(true);
    setResetError(null);
    const err = await onReset();
    setResetBusy(false);
    if (err) setResetError(err);
    else setResetOpen(false);
  };

  return (
    <div class="adm-screen adm-settings">
      <PageHeader title="Settings" />

      <section class="adm-section" aria-labelledby="adm-set-account">
        <div class="adm-section__head">
          <h2 id="adm-set-account" class="adm-section__title">
            Account
          </h2>
        </div>
        <dl class="list-group adm-list">
          <div class="list-row adm-kv">
            <dt class="adm-kv__label">Name</dt>
            <dd class="adm-kv__value">{user.name}</dd>
          </div>
          <div class="list-row adm-kv">
            <dt class="adm-kv__label">Email</dt>
            <dd class="adm-kv__value adm-break">{user.email}</dd>
          </div>
        </dl>
        <div class="adm-section__foot">
          <button type="button" class="btn btn--gray" onClick={signOut}>
            <Icon name="log-out" />
            Sign Out
          </button>
        </div>
      </section>

      <section class="adm-section" aria-labelledby="adm-set-password">
        <div class="adm-section__head">
          <h2 id="adm-set-password" class="adm-section__title">
            Change password
          </h2>
        </div>
        {SHOW_DEMO && (
          <p class="adm-banner adm-banner--info">
            <Icon name="lock" />
            <span>Password changes are off in the demo, so the demo sign-in keeps working for everyone.</span>
          </p>
        )}
        <PasswordForm disabled={SHOW_DEMO} />
      </section>

      {SHOW_DEMO && (
        <section class="adm-section" aria-labelledby="adm-set-demo">
          <div class="adm-section__head">
            <h2 id="adm-set-demo" class="adm-section__title">
              Demo data
            </h2>
          </div>
          <div class="adm-card">
            <p>The demo keeps its requests and calendar in this browser only. Reset it to start over with the sample data.</p>
            <div class="adm-section__foot">
              <button
                type="button"
                class="btn adm-btn--destructive"
                onClick={() => {
                  setResetError(null);
                  setResetOpen(true);
                }}
              >
                Reset Demo Data
              </button>
            </div>
          </div>
          <ConfirmDialog
            open={resetOpen}
            title="Reset demo data?"
            body={<p>Your changes in this browser are replaced with the sample requests and calendar.</p>}
            confirmLabel="Reset"
            busyLabel={`Resetting${ELLIPSIS}`}
            destructive
            busy={resetBusy}
            error={resetError}
            onConfirm={doReset}
            onClose={() => setResetOpen(false)}
          />
        </section>
      )}
    </div>
  );
}
