import { useEffect, useRef, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import type { AdminUser } from '../../shared/types';
import { Icon } from '../islands/Icon';
import { SHOW_DEMO, loadDemoCredentials } from './demo-tools';
import { ELLIPSIS } from './format';

const GENERIC = 'That email and password did not work. Check them and try again.';
// Messages from src/lib/api/http.ts that are more useful than the generic one.
const PASS_THROUGH = /too many requests|could not reach the server/i;

export function SignIn({ notice, onSignedIn }: { notice: string | null; onSignedIn: (user: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ email: string; password: string } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (SHOW_DEMO) loadDemoCredentials().then(setDemo);
    // Signing out or an ended session lands here; start keyboard users at the top of the form.
    if (notice) titleRef.current?.focus();
    else emailRef.current?.focus();
  }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setBusy(false);
      setError('You seem to be offline. Check your connection and try again.');
      return;
    }
    const res = await api.admin.login(email.trim(), password);
    setBusy(false);
    if (isError(res)) {
      setError(PASS_THROUGH.test(res.error) ? res.error : GENERIC);
      return;
    }
    onSignedIn(res);
  };

  const fillIn = () => {
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  };

  return (
    <div class="adm-signin">
      <div class="adm-signin__card card">
        <div class="adm-signin__mark" aria-hidden="true">
          <Icon name="lock" />
        </div>
        <h1 class="adm-signin__title" tabIndex={-1} ref={titleRef}>
          Sign in
        </h1>
        <p class="adm-signin__lead">The Venue at NCC staff area</p>

        {notice && (
          <p class="adm-banner adm-banner--info" role="status">
            <Icon name="info" />
            <span>{notice}</span>
          </p>
        )}

        <form class="adm-form" onSubmit={submit} noValidate>
          <div class="field">
            <label class="field__label" for="adm-email">
              Email
            </label>
            <input
              ref={emailRef}
              id="adm-email"
              class="input"
              type="email"
              inputMode="email"
              autocomplete="username"
              autoCapitalize="none"
              spellcheck={false}
              placeholder="name@example.com"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'adm-signin-error' : undefined}
            />
          </div>
          <div class="field">
            <label class="field__label" for="adm-password">
              Password
            </label>
            <div class="adm-inputwrap">
              <input
                id="adm-password"
                class="input adm-input--trailing"
                type={showPassword ? 'text' : 'password'}
                autocomplete="current-password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'adm-signin-error' : undefined}
              />
              <button
                type="button"
                class="btn btn--plain adm-inputwrap__btn"
                aria-pressed={showPassword ? 'true' : 'false'}
                aria-controls="adm-password"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p id="adm-signin-error" class="adm-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" class="btn btn--filled btn--lg adm-signin__submit" disabled={busy} aria-busy={busy ? 'true' : undefined}>
            {busy ? `Signing In${ELLIPSIS}` : 'Sign In'}
          </button>
        </form>

        {SHOW_DEMO && demo && (
          <section class="adm-demo-creds" aria-labelledby="adm-demo-creds-title">
            <h2 id="adm-demo-creds-title" class="adm-demo-creds__title">
              Demo sign-in
            </h2>
            <dl class="adm-demo-creds__list">
              <div>
                <dt>Email</dt>
                <dd>{demo.email}</dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>{demo.password}</dd>
              </div>
            </dl>
            <button type="button" class="btn btn--tinted" onClick={fillIn}>
              Fill In
            </button>
          </section>
        )}
      </div>
      {SHOW_DEMO && <p class="adm-signin__foot">Demo data. Changes stay in this browser.</p>}
    </div>
  );
}
