/**
 * The inquiry form on /pricing/ (Rates and inquiries), mounted client:load.
 *
 * One page, no steps: the space, the kind of event, a date (the same date field as the home page date
 * checker), guests, start time and hours, then how to reach the person. It sends through the same API
 * call, schema, and form-token flow as the booking wizard (src/lib/api, src/shared/schemas.ts), so every
 * inquiry lands in the admin CRM; in the demo build it goes to the in-browser demo backend.
 *
 * The venue does not publish prices, so nothing here shows an amount: the success state gives the
 * reference and what happens next. The API keeps its internal estimate for the team and never returns it.
 */
import './booking.css';
import './inquiry.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { OTHER_EVENT, eventTypeName, eventTypes } from '../../data/event-types';
import { site } from '../../data/site';
import { isDemo } from '../../lib/env';
import { href } from '../../lib/paths';
import { api, isError } from '../../lib/api';
import { spaceIsFree } from '../../shared/availability';
import { capacityError, suggestSpace } from '../../shared/capacity';
import { addDays, formatEndTime, formatShort, formatTime, todayKey } from '../../shared/dates';
import type { ContactPreference, DateKey, InquiryCreated } from '../../shared/types';
import { DateField } from './DateField';
import { FieldError, describe } from './fields';
import {
  ELLIPSIS,
  HOURS_MIN,
  SINGLE_SPACES,
  SPACES,
  SPACE_CHOICE_TITLE,
  SPACE_HINT,
  TIME_OPTIONS,
  focusField,
  formatLongKept,
  guestsLabel,
  hoursLabel,
  hoursMaxFor,
  latestBookableDate,
  partlyBookedNote,
  spaceLabel,
  spaceParts,
  telHref,
} from './lib';
import { ChoiceList, CountField, Note, Segmented, Spinner, Stepper, type ChoiceOption } from './ui';
import { useAvailability, useRefreshOnReturn } from './useAvailability';
import { DEFAULT_DRAFT, GUESTS_MAX, GUESTS_MIN, buildInput, emailError, errorId, fieldId, fitHours, validate, type Draft } from './wizard';

const EVENT_OPTIONS = [...eventTypes, OTHER_EVENT];

const PREFS: { value: ContactPreference; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'text', label: 'Text' },
];

const REACH: Record<ContactPreference, string> = { email: 'by email', phone: 'by phone', text: 'by text message' };

/** The order of the fields on the page, so the error summary reads top to bottom. */
const FIELD_ORDER = [
  'space',
  'eventType',
  'eventTypeOther',
  'date',
  'guests',
  'startTime',
  'hours',
  'name',
  'email',
  'phone',
  'contactPreference',
  'message',
];
const orderFields = (keys: string[]) => FIELD_ORDER.filter((k) => keys.includes(k));

/** Clearing one field's error also clears errors that depended on it. */
const RELATED: Record<string, string[]> = {
  date: ['space'],
  space: ['guests'],
  eventType: ['eventTypeOther'],
  contactPreference: ['phone'],
};

const NETWORK_MESSAGE = 'We could not reach the server. Check your connection and try again.';

/** The server only accepts a form token a few seconds old (FORM_TOKEN_MIN_AGE_MS, 3 s), plus a margin. */
const TOKEN_MIN_AGE_MS = 3200;

/** Availability loaded up front for the date field, as on the home page date checker. */
const WINDOW_DAYS = 120;

const FRESH: Draft = { ...DEFAULT_DRAFT, step: 4, reached: 4 };

type After = null | 'summary' | 'senderr' | 'success' | 'form';

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export default function InquiryForm() {
  const [today, setToday] = useState<DateKey | ''>('');
  const [d, setD] = useState<Draft>(FRESH);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<{ message: string; rateLimited: boolean } | null>(null);
  const [done, setDone] = useState<{ created: InquiryCreated; d: Draft } | null>(null);
  const [copied, setCopied] = useState(false);
  const [announce, setAnnounce] = useState('');
  const { days, loading, error, load, ensureMonths, retry } = useAvailability();

  const rootRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const after = useRef<After>(null);
  const tokenReq = useRef<Promise<string | null> | null>(null);
  const tokenAt = useRef(0);
  const sayTimer = useRef(0);

  const fetchToken = useCallback((): Promise<string | null> => {
    if (!tokenReq.current) {
      tokenReq.current = api.formToken().then((r) => {
        tokenReq.current = null;
        const t = isError(r) ? null : r.token;
        if (t) tokenAt.current = Date.now();
        setToken(t);
        return t;
      });
    }
    return tokenReq.current;
  }, []);

  const say = useCallback((msg: string) => {
    window.clearTimeout(sayTimer.current);
    setAnnounce('');
    sayTimer.current = window.setTimeout(() => setAnnounce(msg), 60);
  }, []);

  useEffect(() => {
    const t = todayKey();
    setToday(t);
    void load(t, addDays(t, WINDOW_DAYS));
    void fetchToken();
    return () => window.clearTimeout(sayTimer.current);
  }, [load, fetchToken]);

  // A date past the first window loads on its own.
  useEffect(() => {
    if (d.date && today && !days[d.date] && d.date > addDays(today, WINDOW_DAYS)) void load(d.date, d.date);
  }, [d.date, today]);

  useRefreshOnReturn(() => {
    if (!today || done) return;
    void load(today, addDays(today, WINDOW_DAYS));
    if (d.date && d.date > addDays(today, WINDOW_DAYS)) void load(d.date, d.date);
  });

  const day = d.date ? days[d.date] : undefined;

  const update = useCallback((patch: Partial<Draft>) => {
    // Keep the start time and hours within building hours (9:00 AM to 12:00 midnight).
    setD((prev) => fitHours({ ...prev, ...patch }, HOURS_MIN));
    const keys = Object.keys(patch).flatMap((k) => [k, ...(RELATED[k] ?? [])]);
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);

  // Focus after renders that change what the person needs to see next.
  useLayoutEffect(() => {
    const a = after.current;
    if (!a) return;
    after.current = null;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    if (a === 'summary') {
      summaryRef.current?.focus({ preventScroll: true });
      summaryRef.current?.scrollIntoView({ block: 'center', behavior });
    } else if (a === 'senderr') {
      rootRef.current?.querySelector('.bk-senderr')?.scrollIntoView({ block: 'center', behavior });
    } else if (a === 'success') {
      successRef.current?.focus({ preventScroll: true });
      rootRef.current?.scrollIntoView({ block: 'start', behavior });
    } else if (a === 'form') {
      focusField(fieldId('space'));
    }
  });

  const onGuests = (guests: number) => {
    const patch: Partial<Draft> = { guests };
    // Until the person picks a space, the space follows the guest count, as in the booking wizard.
    if (!d.spaceChosen) {
      const s = suggestSpace(guests);
      if (s && s !== d.space && (!day || spaceIsFree(day, s))) patch.space = s;
    }
    update(patch);
  };

  const showErrors = (errs: Record<string, string>) => {
    setErrors(errs);
    setSummary(orderFields(Object.keys(errs)));
    after.current = 'summary';
  };

  const tokenReady = async () => {
    const wait = TOKEN_MIN_AGE_MS - (Date.now() - tokenAt.current);
    if (wait > 0) await sleep(wait);
  };

  const submit = async () => {
    if (sending || !today) return;
    const errs = validate(d, [1, 2, 3], { today, day });
    // This form does not ask about a visit; the wizard's step 2 fields that are not on the page never apply.
    delete errs.wantsVisit;
    delete errs.visitNotes;
    delete errs.altDate;
    if (Object.keys(errs).length > 0) {
      setSendError(null);
      showErrors(errs);
      return;
    }
    setSending(true);
    say(`Sending your inquiry${ELLIPSIS}`);
    setSendError(null);
    setSummary(null);
    const website = honeypot.current?.value ?? '';
    let tk = token ?? (await fetchToken());
    if (!tk) {
      setSending(false);
      setSendError({ message: NETWORK_MESSAGE, rateLimited: false });
      after.current = 'senderr';
      return;
    }
    await tokenReady();
    let res = await api.submitInquiry(buildInput(d, tk, website));
    if (isError(res) && res.fields?.formToken) {
      // The token expired, or the server changed its secret: get a new one and send once more.
      setToken(null);
      tk = await fetchToken();
      if (tk) {
        await tokenReady();
        res = await api.submitInquiry(buildInput(d, tk, website));
      }
    }
    setSending(false);
    if (isError(res)) {
      const fields = res.fields ?? {};
      if (fields.formToken) {
        setToken(null);
        void fetchToken();
      }
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) if (FIELD_ORDER.includes(k)) mapped[k] = v;
      if (Object.keys(mapped).length > 0) {
        showErrors(mapped);
        return;
      }
      setSendError({ message: res.error || NETWORK_MESSAGE, rateLimited: res.status === 429 });
      after.current = 'senderr';
      return;
    }
    setDone({ created: res, d });
    setCopied(false);
    after.current = 'success';
  };

  const sendAnother = () => {
    const prev = done?.d ?? d;
    setD({ ...FRESH, name: prev.name, email: prev.email, phone: prev.phone, contactPreference: prev.contactPreference });
    setDone(null);
    setErrors({});
    setSummary(null);
    setSendError(null);
    setToken(null);
    void fetchToken();
    after.current = 'form';
  };

  const copy = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.created.reference);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (done) {
    const sent = done.d;
    const firstName = sent.name.trim().split(/\s+/)[0] ?? '';
    const rows: [string, string][] = [
      ['Space', spaceLabel(sent.space)],
      ['Event', eventTypeName(sent.eventType, sent.eventTypeOther.trim())],
      ['Date', sent.date ? formatLongKept(sent.date) : ''],
      ['Time', `${formatTime(sent.startTime)} to ${formatEndTime(sent.startTime, sent.hours)}`],
      ['Guests', guestsLabel(sent.guests)],
    ];
    return (
      <div class="bk bk-iq" ref={rootRef}>
        <div class="bk-iq__done">
          <div class="bk-iq__done-head">
            <span class="bk-success__badge" aria-hidden="true">
              <Icon name="check" />
            </span>
            <h3 class="bk-iq__done-title" tabIndex={-1} ref={successRef}>
              Inquiry sent
            </h3>
            <p class="bk-iq__done-lead">
              {firstName ? `Thank you, ${firstName}. ` : 'Thank you. '}
              We will contact you {REACH[sent.contactPreference]} about availability and pricing for your date.
            </p>
            <div class="bk-ref">
              <span class="bk-ref__label">Your reference</span>
              <span class="bk-ref__code">{done.created.reference}</span>
              <button type="button" class="btn btn--gray btn--sm" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <span class="visually-hidden" role="status">
                {copied ? 'Reference copied' : ''}
              </span>
            </div>
          </div>

          {/* Build-time gate first, so the production bundle carries none of this. */}
          {isDemo && done.created.demo && (
            <div class="bk-demo-note">
              <Icon name="info" />
              <p>
                This is a demo. Nothing was sent. <a href={href('/admin/')}>Sign in to the demo admin</a> to see your inquiry.
              </p>
            </div>
          )}

          <dl class="list-group bk-list bk-dl bk-iq__rows">
            {rows.map(([k, v]) => (
              <div class="bk-dl__row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <div class="btn-row bk-iq__done-actions">
            <button type="button" class="btn btn--gray btn--lg" onClick={sendAnother}>
              Send Another Inquiry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const taken = day ? SINGLE_SPACES.filter((s) => day.spaces[s] === 'taken') : [];
  const spaceOptions: ChoiceOption<(typeof SPACES)[number]>[] = SPACES.map((s) => ({
    value: s,
    title: SPACE_CHOICE_TITLE[s],
    hint: SPACE_HINT[s],
    disabled: day ? day.status !== 'past' && day.status !== 'closed' && !spaceIsFree(day, s) : false,
    disabledNote: spaceParts(s).length > 1 && spaceParts(s).some((p) => !taken.includes(p)) ? 'Partly booked' : 'Booked',
  }));
  const bookedNote = d.date ? partlyBookedNote(taken, formatShort(d.date)) : '';
  const capErr = capacityError(d.space, d.guests);
  const phoneNeeded = d.contactPreference !== 'email';
  const summaryItems = (summary ?? []).filter((f) => errors[f]);

  const spaceHintId = 'bk-iq-space-note';
  const capId = 'bk-iq-guests-cap';
  const timeHintId = 'bk-iq-time-hint';
  const dateHintId = 'bk-iq-date-hint';

  return (
    <div class="bk bk-iq" ref={rootRef}>
      <form
        class="bk-iq__form"
        noValidate
        aria-labelledby="inquiry-heading"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {summaryItems.length > 0 && (
          // Not a live region: focus moves here once, and fixing a field should not interrupt typing.
          <div class="bk-errsum" role="group" aria-labelledby="bk-iq-errsum-title" tabIndex={-1} ref={summaryRef}>
            <p class="bk-errsum__title" id="bk-iq-errsum-title">
              <Icon name="info" />
              {summaryItems.length === 1 ? 'Complete this item to send your inquiry' : `Complete these ${summaryItems.length} items to send your inquiry`}
            </p>
            <ul>
              {summaryItems.map((f) => (
                <li key={f}>
                  <a
                    href={`#${fieldId(f)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      focusField(fieldId(f));
                    }}
                  >
                    {errors[f]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset class="bk-iq__group">
          <legend class="bk-iq__legend">Your event</legend>

          <div class="field">
            <span class="field__label" id="bk-iq-space-label">
              Space
            </span>
            <ChoiceList
              id={fieldId('space')}
              labelId="bk-iq-space-label"
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

          <div class="field">
            <label class="field__label" for={fieldId('eventType')}>
              Event type
            </label>
            <select
              id={fieldId('eventType')}
              class="input bk-select"
              value={d.eventType}
              aria-invalid={errors.eventType ? 'true' : undefined}
              aria-describedby={errors.eventType ? errorId('eventType') : undefined}
              onChange={(e) => update({ eventType: e.currentTarget.value })}
            >
              <option value="" disabled>
                Choose an event type
              </option>
              {EVENT_OPTIONS.map((t) => (
                <option value={t.slug} key={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
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
                placeholder="For example, a fundraiser or a club meeting"
                value={d.eventTypeOther}
                aria-invalid={errors.eventTypeOther ? 'true' : undefined}
                aria-describedby={errors.eventTypeOther ? errorId('eventTypeOther') : undefined}
                onInput={(e) => update({ eventTypeOther: e.currentTarget.value })}
              />
              <FieldError errors={errors} field="eventTypeOther" />
            </div>
          )}

          <div class="bk-iq__pair">
            <div class="field">
              <span class="field__label" id="bk-iq-date-label">
                Preferred date
              </span>
              <DateField
                id={fieldId('date')}
                labelId="bk-iq-date-label"
                value={d.date}
                onChange={(date) => update({ date })}
                today={today}
                latest={today ? latestBookableDate(today) : ''}
                statusOf={(k) => days[k]?.status}
                loading={loading}
                error={error}
                onRetry={retry}
                onMonth={(view) => ensureMonths(view, 1)}
                describedBy={describe(dateHintId, errors.date ? errorId('date') : '')}
              />
              <p class="field__hint" id={dateHintId}>
                Booked dates and Sundays cannot be chosen.
              </p>
              <FieldError errors={errors} field="date" />
            </div>

            <div class="field">
              <label class="field__label" for={fieldId('guests')}>
                Approximate guests
              </label>
              <CountField
                id={fieldId('guests')}
                value={d.guests}
                min={GUESTS_MIN}
                max={GUESTS_MAX}
                onChange={onGuests}
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
                </Note>
              )}
            </div>
          </div>

          <div class="bk-iq__pair">
            <div class="field">
              <label class="field__label" for={fieldId('startTime')}>
                Start time
              </label>
              <select
                id={fieldId('startTime')}
                class="input bk-select"
                value={d.startTime}
                aria-invalid={errors.startTime ? 'true' : undefined}
                aria-describedby={describe(timeHintId, errors.startTime ? errorId('startTime') : '')}
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
              <span class="field__label" id="bk-iq-hours-label">
                Hours
              </span>
              <Stepper
                id={fieldId('hours')}
                labelId="bk-iq-hours-label"
                value={d.hours}
                min={HOURS_MIN}
                max={hoursMaxFor(d.startTime)}
                onChange={(hours) => update({ hours })}
                format={hoursLabel}
                decLabel="Fewer hours"
                incLabel="More hours"
                describedBy={describe(timeHintId, errors.hours ? errorId('hours') : '')}
              />
              <FieldError errors={errors} field="hours" />
            </div>
          </div>
          <p class="field__hint bk-iq__time" id={timeHintId}>
            <span class="num">
              {formatTime(d.startTime)} to {formatEndTime(d.startTime, d.hours)}
            </span>
            . Include time to set up and clean up. Events end by 12:00 midnight.
          </p>
        </fieldset>

        <fieldset class="bk-iq__group">
          <legend class="bk-iq__legend">Your details</legend>

          <div class="bk-iq__pair">
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
                  if (!v.trim()) return;
                  const msg = emailError(v);
                  setErrors((prev) => {
                    const next = { ...prev };
                    if (msg) next.email = msg;
                    else delete next.email;
                    return next;
                  });
                }}
              />
              <FieldError errors={errors} field="email" />
            </div>
          </div>

          <div class="bk-iq__pair">
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
              <span class="field__label" id="bk-iq-pref-label">
                Preferred contact method
              </span>
              <Segmented
                id={fieldId('contactPreference')}
                labelId="bk-iq-pref-label"
                options={PREFS}
                value={d.contactPreference}
                onChange={(contactPreference) => update({ contactPreference })}
                describedBy={describe(errors.contactPreference && errorId('contactPreference'))}
                full
              />
              <FieldError errors={errors} field="contactPreference" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for={fieldId('message')}>
              Message <span class="bk-optional">Optional</span>
            </label>
            <textarea
              id={fieldId('message')}
              class="input"
              maxLength={4000}
              rows={4}
              placeholder="Tell us about your plans, or ask us anything"
              value={d.message}
              aria-invalid={errors.message ? 'true' : undefined}
              aria-describedby={describe(errors.message && errorId('message'))}
              onInput={(e) => update({ message: e.currentTarget.value })}
            />
            <FieldError errors={errors} field="message" />
          </div>
        </fieldset>

        <div class="bk-hp" aria-hidden="true">
          <label for="bk-iq-website">Leave this field empty</label>
          <input id="bk-iq-website" name="website" type="text" tabIndex={-1} autoComplete="off" ref={honeypot} />
        </div>

        {sendError && (
          <div class="bk-senderr" role="alert">
            <div class="bk-senderr__head">
              <Icon name="info" />
              <p class="bk-senderr__title">Your inquiry was not sent</p>
            </div>
            <p>{sendError.message}</p>
            <p>
              {sendError.rateLimited
                ? 'Your details are still on this page.'
                : 'Your details are still on this page. Try again, or call us and we will take your inquiry by phone.'}
            </p>
            <div class="btn-row">
              {!sendError.rateLimited && (
                <button
                  type="button"
                  class="btn btn--filled"
                  onClick={() => {
                    sendRef.current?.focus();
                    void submit();
                  }}
                  disabled={sending}
                >
                  Try Again
                </button>
              )}
              <a class={sendError.rateLimited ? 'btn btn--filled' : 'btn btn--gray'} href={telHref(site.contact.phoneE164)}>
                <Icon name="phone" />
                Call {site.contact.phone}
              </a>
            </div>
          </div>
        )}

        {isDemo && (
          <div class="bk-demo-note">
            <Icon name="info" />
            <p>This is a demo. Inquiries are kept in this browser and appear in the demo admin.</p>
          </div>
        )}

        <div class="bk-iq__send">
          <button type="submit" class="btn btn--filled btn--lg bk-iq__submit" ref={sendRef} aria-disabled={sending || !today ? 'true' : undefined}>
            {sending ? (
              <>
                <Spinner />
                {`Sending${ELLIPSIS}`}
              </>
            ) : (
              'Send Inquiry'
            )}
          </button>
          <p class="bk-iq__fine">An inquiry does not reserve a date. We confirm availability with you personally.</p>
        </div>
      </form>

      <p class="visually-hidden" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
