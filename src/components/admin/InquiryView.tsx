import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import { capacityError } from '../../shared/capacity';
import { formatLong, formatShort, todayKey } from '../../shared/dates';
import { formatPhone } from '../../shared/phone';
import { pricing } from '../../shared/pricing';
import type { IconName } from '../../shared/icons';
import { INQUIRY_STATUSES, type CalendarBlock, type InquiryDetail, type InquiryEvent, type InquiryStatus } from '../../shared/types';
import { Icon } from '../islands/Icon';
import { useAdmin } from './context';
import { ConfirmDialog } from './Dialog';
import { ELLIPSIS, dialable, eventTypeName, formatStamp, formatUSD, plural, spaceLabel, statusLabel, timeRange } from './format';
import { calendarHash } from './route';
import { ErrorBanner, PageHeader, Skeleton, SkeletonRows, StatusBadge } from './ui';

const EVENT_ICON: Record<InquiryEvent['kind'], IconName> = {
  created: 'inbox',
  status: 'tag',
  note: 'message',
  email: 'mail',
  block: 'calendar-check',
};

const PREF_LABEL = { email: 'Email', phone: 'Phone call', text: 'Text message' } as const;

function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="list-row adm-kv">
      <dt class="adm-kv__label">{label}</dt>
      <dd class="adm-kv__value">{children}</dd>
    </div>
  );
}

function Section({ id, title, children, action }: { id: string; title: string; children: ComponentChildren; action?: ComponentChildren }) {
  return (
    <section class="adm-section" aria-labelledby={id}>
      <div class="adm-section__head">
        <h2 id={id} class="adm-section__title">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The calendar blocks linked to this request, or null when the API does not send them. */
function linkedBlocks(d: InquiryDetail): CalendarBlock[] | null {
  const blocks = (d as InquiryDetail & { blocks?: CalendarBlock[] }).blocks;
  return Array.isArray(blocks) ? blocks : null;
}

/** Whether the request's date has its booked block on the calendar; null when the API does not say. */
function onCalendar(d: InquiryDetail): boolean | null {
  const blocks = linkedBlocks(d);
  return blocks ? blocks.some((b) => b.kind === 'booked' && b.date === d.date) : null;
}

/** Newest first. Entries written together share a timestamp, so the later id goes first. */
function newestFirst(a: InquiryEvent, b: InquiryEvent): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
}

function mailSubject(d: InquiryDetail): string {
  return `Your request for ${formatLong(d.date)} at The Venue at NCC (${d.reference})`;
}

function ContactActions({ d, class: className }: { d: InquiryDetail; class?: string }) {
  const first = d.name.split(' ')[0];
  return (
    <div class={`adm-contact-actions${className ? ` ${className}` : ''}`}>
      {d.phone && (
        <a class="btn btn--tinted" href={`tel:${dialable(d.phone)}`} aria-label={`Call ${first}`}>
          <Icon name="phone" />
          Call
        </a>
      )}
      {d.phone && (
        <a class="btn btn--tinted" href={`sms:${dialable(d.phone)}`} aria-label={`Text ${first}`}>
          <Icon name="message" />
          Text
        </a>
      )}
      <a class="btn btn--tinted" href={`mailto:${d.email}?subject=${encodeURIComponent(mailSubject(d))}`} aria-label={`Email ${first}`}>
        <Icon name="mail" />
        Email
      </a>
    </div>
  );
}

export function InquiryView({ id }: { id: number }) {
  const { run, toast, refreshStats, inboxHref } = useAdmin();
  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The status select only picks a status; Update Status saves it. Saving on every change would save
  // each status a keyboard user arrows past.
  const [pending, setPending] = useState<InquiryStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reblock, setReblock] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const actionRef = useRef<HTMLAnchorElement>(null);
  const focusAction = useRef(false);

  const load = async () => {
    setError(null);
    const res = await run(api.admin.getInquiry(id));
    if (isError(res)) {
      setError(res.error);
      return;
    }
    setDetail(res);
  };

  useEffect(() => {
    setDetail(null);
    load();
  }, [id]);

  useEffect(() => {
    setPending(detail ? detail.status : null);
  }, [detail?.status]);

  // After booking, the button that opened the dialog is gone; put focus on View on Calendar instead.
  useEffect(() => {
    if (!focusAction.current) return;
    focusAction.current = false;
    actionRef.current?.focus();
  }, [detail]);

  const openBookDialog = () => {
    if (!detail) return;
    // Already booked means the block went missing; the dialog then only puts it back.
    setReblock(detail.status === 'booked');
    setBookError(null);
    setConfirmOpen(true);
  };

  const changeStatus = async (next: InquiryStatus) => {
    if (!detail || statusBusy || next === detail.status) return;
    if (next === 'booked') {
      openBookDialog();
      return;
    }
    setStatusBusy(true);
    const wasOnCalendar = onCalendar(detail);
    const res = await run(api.admin.setStatus(detail.id, next));
    setStatusBusy(false);
    if (isError(res)) {
      toast(res.error, 'error');
      return;
    }
    setDetail(res);
    refreshStats();
    const nowOnCalendar = onCalendar(res);
    let calendar = '';
    if (wasOnCalendar && nowOnCalendar === false) calendar = ` The booked block for ${formatShort(res.date)} was removed from the calendar.`;
    else if (nowOnCalendar && res.date >= todayKey()) calendar = ` ${formatShort(res.date)} is still blocked on the calendar.`;
    toast(`Status changed to ${statusLabel(next)}.${calendar}`);
  };

  const markBooked = async () => {
    if (!detail || bookBusy) return;
    setBookBusy(true);
    setBookError(null);
    const wasBooked = detail.status === 'booked';
    const res = await run(api.admin.setStatus(detail.id, 'booked'));
    setBookBusy(false);
    if (isError(res)) {
      setBookError(res.error);
      return;
    }
    focusAction.current = true;
    setDetail(res);
    setConfirmOpen(false);
    refreshStats();
    const when = formatShort(res.date);
    if (onCalendar(res) === false) {
      toast(`${wasBooked ? '' : 'Marked booked, but '}${when} is not blocked on the calendar. Check Activity for the reason.`, 'error');
    } else {
      toast(wasBooked ? `${when} is now blocked on the calendar.` : `Booked. ${when} is now blocked on the calendar.`);
    }
  };

  const addNote = async (e: Event) => {
    e.preventDefault();
    if (!detail || noteBusy) return;
    if (!note.trim()) {
      setNoteError('Write a note first.');
      return;
    }
    setNoteBusy(true);
    setNoteError(null);
    const res = await run(api.admin.addNote(detail.id, note.trim()));
    setNoteBusy(false);
    if (isError(res)) {
      setNoteError(res.fields?.body ?? res.error);
      return;
    }
    setDetail(res);
    setNote('');
    toast('Note added.');
  };

  const back = (
    <a class="btn btn--plain adm-back" href={inboxHref}>
      <Icon name="chevron-left" />
      Inbox
    </a>
  );

  if (error && !detail) {
    return (
      <div class="adm-screen">
        {back}
        <PageHeader title="Request" />
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div class="adm-screen" aria-busy="true">
        {back}
        <PageHeader
          title={
            <>
              <span class="visually-hidden">Loading request</span>
              <Skeleton width="14rem" height="2rem" />
            </>
          }
          subtitle={<Skeleton width="10rem" height="0.9rem" />}
        />
        <div class="adm-detail">
          <div class="adm-detail__main">
            <SkeletonRows count={6} label="" />
          </div>
          <div class="adm-detail__side">
            <SkeletonRows count={3} label="" />
          </div>
        </div>
      </div>
    );
  }

  const d = detail;
  const over = capacityError(d.space, d.guests);
  const events = d.events.slice().sort(newestFirst);
  const notes = d.notes.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const est = d.estimate;
  const selected = pending ?? d.status;
  const unchanged = selected === d.status;
  const calendarState = onCalendar(d);
  // Booked, but its block was deleted: the date shows as open to the public.
  const needsBlock = d.status === 'booked' && calendarState === false;
  // No longer booked, but the booked block is still on an upcoming date.
  const staleBlock = d.status !== 'booked' && calendarState === true && d.date >= todayKey();

  return (
    <div class="adm-screen">
      {back}
      <PageHeader
        title={d.name}
        subtitle={
          <>
            <span class="adm-ref">{d.reference}</span> <span aria-hidden="true">{String.fromCharCode(183)}</span> Received{' '}
            {formatStamp(d.createdAt)}
          </>
        }
      />

      <div class="adm-statusbar" aria-busy={statusBusy ? 'true' : undefined}>
        <div class="adm-statusbar__field">
          <label for="adm-status" class="adm-statusbar__label">
            Status
          </label>
          <div class="adm-selectwrap">
            <select
              id="adm-status"
              class="input adm-select"
              value={selected}
              aria-describedby="adm-status-saved"
              onChange={(e) => setPending((e.target as HTMLSelectElement).value as InquiryStatus)}
            >
              {INQUIRY_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" class="adm-selectwrap__icon" />
          </div>
          <button
            type="button"
            class="btn btn--gray adm-btn-44"
            aria-disabled={unchanged || statusBusy ? 'true' : undefined}
            aria-busy={statusBusy ? 'true' : undefined}
            onClick={() => {
              if (!unchanged) changeStatus(selected);
            }}
          >
            {statusBusy ? `Updating${ELLIPSIS}` : 'Update Status'}
          </button>
          {/* The saved status shows only while the select holds an unsaved change; otherwise it would repeat the select. */}
          <span id="adm-status-saved" class="adm-statusbar__saved" hidden={unchanged}>
            <span class="visually-hidden">Saved status: </span>
            <StatusBadge status={d.status} />
          </span>
        </div>
        {needsBlock ? (
          <button type="button" class="btn btn--filled" onClick={openBookDialog}>
            <Icon name="calendar-check" />
            Block on Calendar
          </button>
        ) : d.status === 'booked' ? (
          <a ref={actionRef} class="btn btn--tinted" href={calendarHash(d.date.slice(0, 7), d.date)}>
            <Icon name="calendar-check" />
            View on Calendar
          </a>
        ) : (
          <button type="button" class="btn btn--filled" onClick={openBookDialog}>
            <Icon name="check" />
            Mark Booked
          </button>
        )}
        {needsBlock && (
          <p class="adm-statusbar__note adm-statusbar__note--warn">
            <Icon name="info" />
            <span>
              {formatShort(d.date)} is not blocked on the calendar, so it shows as open to the public.
            </span>
          </p>
        )}
        {staleBlock && (
          <p class="adm-statusbar__note">
            <Icon name="info" />
            <span>
              {formatShort(d.date)} is still blocked on the calendar for this request.{' '}
              <a href={calendarHash(d.date.slice(0, 7), d.date)}>View on Calendar</a>
            </span>
          </p>
        )}
      </div>

      <ContactActions d={d} class="adm-quick-contact" />

      <div class="adm-detail">
        <div class="adm-detail__main">
          <Section id="adm-sec-event" title="Event">
            <dl class="list-group adm-list">
              <Row label="Event">{eventTypeName(d.eventType, d.eventTypeOther)}</Row>
              <Row label="Date">{formatLong(d.date)}</Row>
              <Row label="Alternate date">{d.altDate ? formatLong(d.altDate) : <span class="adm-muted">None</span>}</Row>
              <Row label="Time">{timeRange(d.startTime, d.hours)}</Row>
              <Row label="Space">{spaceLabel(d.space)}</Row>
              <Row label="Guests">
                {d.guests}
                {over && <span class="adm-warn">{over}</span>}
              </Row>
              <Row label="Visit">
                {d.wantsVisit ? 'Wants to visit first' : 'No visit requested'}
                {d.wantsVisit && d.visitNotes && <span class="adm-kv__extra">{d.visitNotes}</span>}
              </Row>
            </dl>
          </Section>

          <Section id="adm-sec-estimate" title="Estimate">
            <dl class="list-group adm-list adm-money">
              {est.lines.map((l, i) => (
                <Row key={i} label={l.label}>
                  <span class="adm-num">{formatUSD(l.amount)}</span>
                </Row>
              ))}
              <div class="list-row adm-kv adm-kv--total">
                <dt class="adm-kv__label">Total</dt>
                <dd class="adm-kv__value adm-num">{formatUSD(est.total)}</dd>
              </div>
              <Row label="Due to reserve">
                <span class="adm-num">{formatUSD(est.bookingDeposit)}</span>
              </Row>
              {/* Within the balance window the full amount is due to reserve, so there is no balance row; the footnote says why. */}
              {est.total - est.bookingDeposit > 0 && (
                <Row label="Balance">
                  <span class="adm-num">{formatUSD(est.total - est.bookingDeposit)}</span>
                </Row>
              )}
              <Row label="Refundable damage deposit">
                <span class="adm-num">{formatUSD(est.refundableDeposit)}</span>
              </Row>
            </dl>
            <p class="adm-footnote">
              {est.dayTypeLabel} rates, {plural(est.billableHours, 'billable hour')}.{' '}
              {est.billableHours > est.hours ? `${plural(est.hours, 'hour')} requested. ` : ''}
              {est.total > 0 && est.bookingDeposit >= est.total
                ? `Requested within ${pricing.bookingDeposit.balanceDueDaysBefore} days of the event, so the full amount is due to reserve. `
                : ''}
              Estimate saved when the request came in.
            </p>
          </Section>

          <Section id="adm-sec-message" title="Message">
            <div class="list-group adm-list adm-prose">
              {d.message ? <p class="adm-message">{d.message}</p> : <p class="adm-muted">No message.</p>}
            </div>
          </Section>

          <Section id="adm-sec-notes" title="Notes">
            <div class="list-group adm-list">
              {notes.length === 0 ? (
                <p class="list-row adm-muted">No notes yet. Notes are for your team only.</p>
              ) : (
                <ul class="adm-notes">
                  {notes.map((n) => (
                    <li class="list-row adm-note" key={n.id}>
                      <p class="adm-note__body">{n.body}</p>
                      <p class="adm-note__meta">
                        {n.author} {String.fromCharCode(183)} {formatStamp(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form class="adm-noteform" onSubmit={addNote}>
              <label class="field__label" for="adm-note">
                Add a note
              </label>
              <textarea
                id="adm-note"
                class="input"
                rows={3}
                value={note}
                placeholder="Called and left a message."
                aria-invalid={noteError ? 'true' : undefined}
                aria-describedby={noteError ? 'adm-note-error' : undefined}
                onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(e);
                }}
              />
              {noteError && (
                <p id="adm-note-error" class="adm-error" role="alert">
                  {noteError}
                </p>
              )}
              <div class="adm-noteform__actions">
                <button type="submit" class="btn btn--tinted" disabled={noteBusy} aria-busy={noteBusy ? 'true' : undefined}>
                  {noteBusy ? `Adding${ELLIPSIS}` : 'Add Note'}
                </button>
              </div>
            </form>
          </Section>
        </div>

        <div class="adm-detail__side">
          <Section id="adm-sec-contact" title="Contact">
            <dl class="list-group adm-list">
              <Row label="Name">{d.name}</Row>
              <Row label="Email">
                <span class="adm-break">{d.email}</span>
              </Row>
              <Row label="Phone">{d.phone ? formatPhone(d.phone) : <span class="adm-muted">Not given</span>}</Row>
              <Row label="Prefers">{PREF_LABEL[d.contactPreference] ?? d.contactPreference}</Row>
            </dl>
            <ContactActions d={d} />
          </Section>

          <Section id="adm-sec-activity" title="Activity">
            <ol class="list-group adm-list adm-timeline">
              {events.map((ev) => (
                <li class="list-row adm-timeline__item" key={`${ev.id}-${ev.createdAt}`}>
                  <span class="adm-timeline__icon" aria-hidden="true">
                    <Icon name={EVENT_ICON[ev.kind] ?? 'info'} />
                  </span>
                  <span class="list-row__main">
                    <span class="adm-timeline__text">{ev.detail}</span>
                    <span class="adm-timeline__time">{formatStamp(ev.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={reblock ? 'Block this date on the calendar?' : 'Mark this request booked?'}
        body={
          reblock ? (
            <p>
              {spaceLabel(d.space)} on {formatLong(d.date)} will be blocked on the calendar for{' '}
              {d.name}
              {String.fromCharCode(8217)}s booking.
            </p>
          ) : (
            <p>
              {d.name}
              {String.fromCharCode(8217)}s request will be marked booked, and {spaceLabel(d.space)} on {formatLong(d.date)} will be blocked on
              the calendar.
            </p>
          )
        }
        confirmLabel={reblock ? 'Block on Calendar' : 'Mark Booked'}
        busyLabel={reblock ? `Blocking${ELLIPSIS}` : `Booking${ELLIPSIS}`}
        busy={bookBusy}
        error={bookError}
        onConfirm={markBooked}
        onClose={() => {
          setConfirmOpen(false);
          // Cancelled: show the saved status again.
          setPending(d.status);
        }}
      />
    </div>
  );
}
