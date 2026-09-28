/**
 * The booking wizard (mounted client:load on /book/).
 *
 * Four steps: date and space, your event, contact, review. On wide screens a sticky summary with the
 * live estimate sits beside the steps; on phones the steps come one at a time with Back and Next in a
 * bottom action bar. Progress is kept in sessionStorage so a refresh keeps it.
 * Prefill: ?date=YYYY-MM-DD&space=indoor|outdoor|both&guests=N&event=<slug>&hours=N
 */
import './booking.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { site } from '../../data/site';
import { api, isError } from '../../lib/api';
import { spaceIsFree } from '../../shared/availability';
import { capacityError, suggestSpace } from '../../shared/capacity';
import { formatShort, parseKey, todayKey } from '../../shared/dates';
import { estimate, formatUSD } from '../../shared/pricing';
import type { ApiError, DateKey, InquiryCreated, SpaceChoice } from '../../shared/types';
import type { CalStatus } from './Calendar';
import { ELLIPSIS, TOO_LATE_MESSAGE, focusField, guestsLabel, session, spaceLabel, telHref } from './lib';
import { Spinner } from './ui';
import { StepContact } from './StepContact';
import { StepDate } from './StepDate';
import { StepEvent } from './StepEvent';
import { StepReview } from './StepReview';
import { SuccessView } from './SuccessView';
import { SummaryCard } from './SummaryCard';
import { addMonths, lastDayOf, useAvailability, useRefreshOnReturn, ymOf, type YM } from './useAvailability';
import {
  DEFAULT_DRAFT,
  DRAFT_KEY,
  FIELD_STEP,
  STEPS,
  applySearch,
  buildInput,
  fieldId,
  orderFields,
  restoreDraft,
  validate,
  type Draft,
  type Step,
} from './wizard';

const SUBTITLES: Record<Step, string> = {
  1: 'Pick a day, then tell us how many guests and how long you need.',
  2: 'Tell us a little about your event.',
  3: 'So we can follow up about your request.',
  4: 'Check the details, then send your request.',
};

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

/** How long typing in Guests must pause before a space switch or capacity note is announced. */
const GUESTS_ANNOUNCE_MS = 700;

type After = null | 'heading' | 'summary' | 'success' | 'senderr' | { field: string };

/** The HTTP status on an error, when the API client passes it through. */
const statusOf = (res: ApiError): number | null => ('status' in res && typeof res.status === 'number' ? res.status : null);

/** Open on the current month, or on the next one when this month has less than a week left. */
function initialView(today: DateKey): YM {
  const ym = ymOf(today);
  return lastDayOf(ym) - parseKey(today).d < 7 ? addMonths(ym, 1) : ym;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function Progress(props: { step: Step; reached: Step; onGo: (s: Step) => void }) {
  return (
    <>
      <div class="bk-progress-bar" aria-hidden="true">
        {STEPS.map((s) => (
          <span key={s.n} data-on={s.n <= props.step ? 'true' : undefined} />
        ))}
      </div>
      <nav class="bk-progress" aria-label="Booking steps">
        <ol>
          {STEPS.map((s) => {
            const current = s.n === props.step;
            const done = s.n < props.step;
            const canGo = !current && s.n <= props.reached;
            const inner = (
              <>
                <span class="bk-progress__n" aria-hidden="true">
                  {done ? <Icon name="check" /> : s.n}
                </span>
                <span class="bk-progress__label">{s.nav}</span>
                {done && <span class="visually-hidden"> (done)</span>}
              </>
            );
            return (
              <li key={s.n} data-state={current ? 'current' : done ? 'done' : canGo ? 'reachable' : 'todo'} aria-current={current ? 'step' : undefined}>
                {canGo ? (
                  <button type="button" class="bk-progress__item" onClick={() => props.onGo(s.n)}>
                    {inner}
                  </button>
                ) : (
                  <span class="bk-progress__item">{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

function Skeleton() {
  return (
    <div class="bk-app bk-app--loading" aria-busy="true">
      <div class="bk-skel" aria-hidden="true">
        <div class="bk-skel__main">
          <span class="bk-skel__line bk-skel__line--short" />
          <span class="bk-skel__line bk-skel__line--title" />
          <span class="bk-skel__block" />
        </div>
        <div class="bk-skel__aside">
          <span class="bk-skel__block bk-skel__block--short" />
        </div>
      </div>
      <p class="visually-hidden">Loading the booking calendar</p>
      <noscript>
        Booking online needs JavaScript. Call {site.contact.phone} or email {site.contact.email} and we will help you book.
      </noscript>
    </div>
  );
}

export default function BookingApp() {
  const [today, setToday] = useState<DateKey>('');
  const [d, setD] = useState<Draft>(DEFAULT_DRAFT);
  const [view, setView] = useState<YM>({ y: 2000, m: 1 });
  const avail = useAvailability();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summaryFields, setSummaryFields] = useState<string[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<number | null>(null);
  const [done, setDone] = useState<{ created: InquiryCreated; d: Draft } | null>(null);
  const [announce, setAnnounce] = useState('');
  const [calMsg, setCalMsg] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const after = useRef<After>(null);
  const tokenReq = useRef<Promise<string | null> | null>(null);
  /** When the current form token arrived, so a send can wait until the server will accept it. */
  const tokenAt = useRef(0);
  const sayTimer = useRef(0);
  /** Set when a guest count change picked the space, so the switch can be announced. */
  const autoSpace = useRef(false);
  const prevCapErr = useRef<string | null | undefined>(undefined);

  const mounted = today !== '';

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

  /** Announce through the status region. Clearing first makes a repeated message speak again. */
  const say = useCallback((msg: string) => {
    window.clearTimeout(sayTimer.current);
    setAnnounce('');
    sayTimer.current = window.setTimeout(() => setAnnounce(msg), 60);
  }, []);

  // Mount: today's date, saved draft, URL prefill, and a form token.
  useEffect(() => {
    const t = todayKey();
    const search = window.location.search;
    let draft = restoreDraft(session.get<unknown>(DRAFT_KEY)) ?? { ...DEFAULT_DRAFT };
    if (search && draft.appliedSearch !== search) draft = applySearch(draft, new URLSearchParams(search), t);
    draft.appliedSearch = search;
    if (draft.date && draft.date < t) draft.date = '';
    if (!draft.date && draft.step > 1) draft.step = 1;
    setToday(t);
    setD(draft);
    setView(draft.date ? ymOf(draft.date) : initialView(t));
    void fetchToken();
    return () => window.clearTimeout(sayTimer.current);
  }, [fetchToken]);

  // Keep the draft through a refresh.
  useEffect(() => {
    if (mounted && !done) session.set(DRAFT_KEY, d);
  }, [d, mounted, done]);

  // Three months of availability around the visible month.
  const { ensureMonths, invalidate } = avail;
  useEffect(() => {
    if (mounted) ensureMonths(view);
  }, [mounted, view.y, view.m, ensureMonths]);

  // Coming back to the tab: dates may have been booked meanwhile, so load them again.
  useRefreshOnReturn(() => {
    if (!mounted || done) return;
    invalidate();
    ensureMonths(view);
  });

  const day = d.date ? avail.days[d.date] : undefined;

  const update = useCallback((patch: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch).flatMap((k) => [k, ...(RELATED[k] ?? [])]);
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    if ('date' in patch) setCalMsg('');
  }, []);

  const onUnavailable = (date: DateKey, status: CalStatus) => {
    const msg =
      status === 'past'
        ? 'That date has passed. Choose another date.'
        : status === 'later'
          ? TOO_LATE_MESSAGE
          : `${formatShort(date)} is booked. Choose another date.`;
    setCalMsg(msg);
    say(msg);
  };

  // If the chosen space is taken on the chosen date, move to one that is free.
  useEffect(() => {
    if (!d.date || !day || day.status === 'past' || day.status === 'booked') return;
    if (spaceIsFree(day, d.space)) return;
    const singles: SpaceChoice[] = ['indoor', 'outdoor'];
    const free = singles.filter((s) => spaceIsFree(day, s));
    const alt = free.find((s) => !capacityError(s, d.guests)) ?? free[0];
    if (!alt) return;
    setD((p) => ({ ...p, space: alt }));
    say(`${spaceLabel(d.space)} is booked on ${formatShort(d.date)}, so we switched to ${spaceLabel(alt)}.`);
  }, [d.date, day]);

  // A date that arrived booked (a link, an old tab, or a refresh that found it taken): let it go and say why.
  useEffect(() => {
    if (d.step !== 1 || !d.date || !day) return;
    if (day.status !== 'booked' && day.status !== 'past') return;
    const date = d.date;
    update({ date: '' });
    onUnavailable(date, day.status);
  }, [d.date, day]);

  // Guests: announce a space the count switched to, or a capacity note, once typing pauses.
  const capErr = capacityError(d.space, d.guests);
  useEffect(() => {
    if (!mounted || d.step !== 1) {
      prevCapErr.current = undefined;
      autoSpace.current = false;
      return;
    }
    const prev = prevCapErr.current;
    prevCapErr.current = capErr;
    const switched = autoSpace.current && !capErr;
    const capNews = prev !== undefined && capErr !== null && capErr !== prev;
    if (!switched && !capNews) return;
    const timer = window.setTimeout(() => {
      autoSpace.current = false;
      say(switched ? `${spaceLabel(d.space)} fits ${guestsLabel(d.guests)}, so we switched to it.` : (capErr ?? ''));
    }, GUESTS_ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [mounted, d.step, capErr, d.space, d.guests]);

  // Focus after renders that change the view (layout effect, so focus moves before the next input).
  useLayoutEffect(() => {
    const a = after.current;
    if (!a) return;
    after.current = null;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    const toTop = () => {
      const root = rootRef.current;
      if (root && root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start', behavior });
    };
    if (a === 'heading') {
      headingRef.current?.focus({ preventScroll: true });
      toTop();
    } else if (a === 'success') {
      successRef.current?.focus({ preventScroll: true });
      toTop();
    } else if (a === 'summary') {
      summaryRef.current?.focus({ preventScroll: true });
      summaryRef.current?.scrollIntoView({ block: 'center', behavior });
    } else if (a === 'senderr') {
      // Keep focus on Send; bring the explanation into view above the action bar.
      rootRef.current?.querySelector('.bk-senderr')?.scrollIntoView({ block: 'center', behavior });
    } else {
      focusField(fieldId(a.field));
    }
  });

  const setError = useCallback((field: string, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }, []);

  const onGuests = (guests: number) => {
    const patch: Partial<Draft> = { guests };
    if (!d.spaceChosen) {
      const s = suggestSpace(guests);
      if (s && s !== d.space && (!day || spaceIsFree(day, s))) {
        patch.space = s;
        autoSpace.current = true;
      }
    }
    update(patch);
  };

  const ctx = { today, day };

  const goStep = (step: Step, focusHeading = true) => {
    setD((p) => ({ ...p, step, reached: Math.max(p.reached, step) as Step }));
    setSummaryFields(null);
    setSubmitError(null);
    setSubmitStatus(null);
    if (focusHeading) after.current = 'heading';
  };

  const showErrors = (errs: Record<string, string>, steps: Step[]) => {
    setErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (!steps.includes(FIELD_STEP[k])) next[k] = v;
      return { ...next, ...errs };
    });
    setSummaryFields(orderFields(Object.keys(errs)));
    after.current = 'summary';
  };

  const clearStepErrors = (step: Step) =>
    setErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (FIELD_STEP[k] !== step) next[k] = v;
      return next;
    });

  const next = () => {
    const errs = validate(d, [d.step], ctx);
    if (Object.keys(errs).length > 0) {
      showErrors(errs, [d.step]);
      return;
    }
    clearStepErrors(d.step);
    goStep((d.step + 1) as Step);
  };

  const jumpTo = (target: Step) => {
    if (target < d.step) {
      goStep(target);
      return;
    }
    for (let s = d.step; s < target; s++) {
      const errs = validate(d, [s as Step], ctx);
      if (Object.keys(errs).length > 0) {
        if (s !== d.step) goStep(s as Step, false);
        showErrors(errs, [s as Step]);
        return;
      }
    }
    goStep(target);
  };

  const jumpToField = (field: string) => {
    const s = FIELD_STEP[field];
    if (s && s !== d.step) {
      setD((p) => ({ ...p, step: s }));
      after.current = { field };
    } else {
      focusField(fieldId(field));
    }
  };

  /** Wait until the current token is old enough for the server's minimum age. */
  const tokenReady = async () => {
    const wait = TOKEN_MIN_AGE_MS - (Date.now() - tokenAt.current);
    if (wait > 0) await sleep(wait);
  };

  const submit = async () => {
    if (sending) return;
    const errs = validate(d, [1, 2, 3], ctx);
    const keys = Object.keys(errs);
    if (keys.length > 0) {
      const first = Math.min(...keys.map((k) => FIELD_STEP[k] ?? 4)) as Step;
      if (first !== d.step) setD((p) => ({ ...p, step: first }));
      showErrors(errs, [1, 2, 3]);
      return;
    }
    setSending(true);
    setSubmitError(null);
    setSubmitStatus(null);
    setSummaryFields(null);
    const website = honeypot.current?.value ?? '';
    let tk = token ?? (await fetchToken());
    if (!tk) {
      setSending(false);
      setSubmitError(NETWORK_MESSAGE);
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
      for (const [k, v] of Object.entries(fields)) if (FIELD_STEP[k]) mapped[k] = v;
      const mappedKeys = Object.keys(mapped);
      if (mappedKeys.length > 0) {
        const first = Math.min(...mappedKeys.map((k) => FIELD_STEP[k])) as Step;
        if (first !== d.step) setD((p) => ({ ...p, step: first }));
        showErrors(mapped, [1, 2, 3]);
        return;
      }
      setSubmitError(res.error || NETWORK_MESSAGE);
      setSubmitStatus(statusOf(res));
      after.current = 'senderr';
      return;
    }
    session.remove(DRAFT_KEY);
    setDone({ created: res, d });
    after.current = 'success';
  };

  const retry = () => {
    sendRef.current?.focus();
    void submit();
  };

  const planAnother = () => {
    const prev = done?.d ?? d;
    const fresh: Draft = {
      ...DEFAULT_DRAFT,
      name: prev.name,
      email: prev.email,
      phone: prev.phone,
      contactPreference: prev.contactPreference,
      appliedSearch: window.location.search,
    };
    setD(fresh);
    setDone(null);
    setErrors({});
    setSummaryFields(null);
    setSubmitError(null);
    setSubmitStatus(null);
    setCalMsg('');
    setToken(null);
    void fetchToken();
    setView(initialView(today));
    after.current = 'heading';
  };

  const est = useMemo(
    () => (d.date && today ? estimate({ date: d.date, space: d.space, hours: d.hours, eventType: d.eventType || undefined }, undefined, today) : null),
    [d.date, d.space, d.hours, d.eventType, today],
  );

  if (!mounted) return <Skeleton />;

  if (done) {
    return (
      <div class="bk-app" ref={rootRef}>
        <SuccessView
          created={done.created}
          d={done.d}
          demo={api.demo || done.created.demo === true}
          headingRef={successRef}
          onPlanAnother={planAnother}
        />
      </div>
    );
  }

  const summaryItems = (summaryFields ?? []).filter((f) => errors[f]);
  const stepInfo = STEPS[d.step - 1];

  return (
    <div class="bk-app" ref={rootRef} data-step={d.step}>
      <form
        class="bk-wizard"
        noValidate
        aria-label="Booking request"
        onSubmit={(e) => {
          e.preventDefault();
          if (d.step < 4) next();
          else void submit();
        }}
      >
        <div class="bk-main">
          <Progress step={d.step} reached={d.reached} onGo={jumpTo} />
          <div class="bk-step-head">
            <p class="bk-step-count">
              Step {d.step} of {STEPS.length}
            </p>
            <h2 class="bk-step-title" tabIndex={-1} ref={headingRef}>
              {stepInfo.title}
            </h2>
            <p class="bk-step-sub">{SUBTITLES[d.step]}</p>
          </div>

          {summaryItems.length > 0 && (
            // Not a live region: focus moves here once, and fixing a field should not interrupt typing.
            <div class="bk-errsum" role="group" aria-labelledby="bk-errsum-title" tabIndex={-1} ref={summaryRef}>
              <p class="bk-errsum__title" id="bk-errsum-title">
                <Icon name="info" />
                {summaryItems.length === 1 ? 'Check this to continue' : `Check these ${summaryItems.length} things to continue`}
              </p>
              <ul>
                {summaryItems.map((f) => (
                  <li key={f}>
                    <a
                      href={`#${fieldId(f)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        jumpToField(f);
                      }}
                    >
                      {errors[f]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.step === 1 && (
            <StepDate
              d={d}
              update={update}
              errors={errors}
              today={today}
              view={view}
              onView={setView}
              days={avail.days}
              loading={avail.loading}
              error={avail.error}
              onRetry={avail.retry}
              onUnavailable={onUnavailable}
              onGuests={onGuests}
              calMsg={calMsg}
            />
          )}
          {d.step === 2 && <StepEvent d={d} update={update} errors={errors} />}
          {d.step === 3 && <StepContact d={d} update={update} errors={errors} setError={setError} />}
          {d.step === 4 && (
            <StepReview
              d={d}
              onEdit={(s) => goStep(s)}
              honeypot={honeypot}
              submitError={submitError}
              rateLimited={submitStatus === 429}
              onRetry={retry}
              sending={sending}
            />
          )}
        </div>

        <aside class="bk-aside" aria-labelledby="bk-summary-title">
          <SummaryCard d={d} est={est} />
        </aside>

        <div class="bk-actions">
          <div class="bk-actions__inner">
            {d.step > 1 ? (
              <button type="button" class="btn btn--gray bk-actions__back" onClick={() => goStep((d.step - 1) as Step)}>
                <Icon name="chevron-left" />
                Back
              </button>
            ) : (
              <span class="bk-actions__spacer" />
            )}
            <div class="bk-actions__total" aria-hidden="true">
              <span class="bk-actions__cap">Estimate</span>
              {est ? <span class="bk-actions__amt num">{formatUSD(est.total)}</span> : <span class="bk-actions__none">Pick a date</span>}
            </div>
            {d.step < 4 ? (
              <button type="submit" class="btn btn--filled bk-actions__next">
                Next
                <Icon name="chevron-right" />
              </button>
            ) : (
              <button type="submit" class="btn btn--filled bk-actions__next" ref={sendRef} aria-disabled={sending ? 'true' : undefined}>
                {sending ? (
                  <>
                    <Spinner />
                    {`Sending${ELLIPSIS}`}
                  </>
                ) : (
                  'Send Request'
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      <p class="visually-hidden" role="status" aria-live="polite">
        {announce}
      </p>
      <p class="bk-help">
        Prefer to talk? Call <a href={telHref(site.contact.phoneE164)}>{site.contact.phone}</a> or email{' '}
        <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.
      </p>
    </div>
  );
}
