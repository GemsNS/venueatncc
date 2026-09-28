import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import { capacityError } from '../../shared/capacity';
import { formatLong, formatShort } from '../../shared/dates';
import type { IconName } from '../../shared/icons';
import { INQUIRY_STATUSES, type InquiryDetail, type InquiryEvent, type InquiryStatus } from '../../shared/types';
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

const SPACE_PHRASE = { indoor: 'the indoor hall', outdoor: 'the outdoor space', both: 'the indoor hall and outdoor space' } as const;

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
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

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

  const changeStatus = async (next: InquiryStatus) => {
    if (!detail || next === detail.status) return;
    if (next === 'booked') {
      if (selectRef.current) selectRef.current.value = detail.status;
      setBookError(null);
      setConfirmOpen(true);
      return;
    }
    setStatusBusy(true);
    const res = await run(api.admin.setStatus(detail.id, next));
    setStatusBusy(false);
    if (isError(res)) {
      if (selectRef.current) selectRef.current.value = detail.status;
      toast(res.error, 'error');
      return;
    }
    setDetail(res);
    refreshStats();
    toast(`Status changed to ${statusLabel(next)}.`);
  };

  const markBooked = async () => {
    if (!detail || bookBusy) return;
    setBookBusy(true);
    setBookError(null);
    const res = await run(api.admin.setStatus(detail.id, 'booked'));
    setBookBusy(false);
    if (isError(res)) {
      setBookError(res.error);
      return;
    }
    setDetail(res);
    setConfirmOpen(false);
    refreshStats();
    toast(`Booked. ${formatShort(res.date)} is now blocked on the calendar.`);
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
  const events = d.events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notes = d.notes.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const est = d.estimate;

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

      <div class="adm-statusbar">
        <div class="adm-statusbar__field">
          <label for="adm-status" class="adm-statusbar__label">
            Status
          </label>
          <div class="adm-selectwrap">
            <select
              ref={selectRef}
              id="adm-status"
              class="input adm-select"
              value={d.status}
              disabled={statusBusy}
              onChange={(e) => changeStatus((e.target as HTMLSelectElement).value as InquiryStatus)}
            >
              {INQUIRY_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" class="adm-selectwrap__icon" />
          </div>
          <StatusBadge status={d.status} />
        </div>
        {d.status === 'booked' ? (
          <a class="btn btn--tinted" href={calendarHash(d.date.slice(0, 7), d.date)}>
            <Icon name="calendar-check" />
            View on Calendar
          </a>
        ) : (
          <button
            type="button"
            class="btn btn--filled"
            onClick={() => {
              setBookError(null);
              setConfirmOpen(true);
            }}
          >
            <Icon name="check" />
            Mark Booked
          </button>
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
              <Row label="Alcohol">{d.servingAlcohol ? 'Yes, serving alcohol' : 'No'}</Row>
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
              <Row label="Refundable damage deposit">
                <span class="adm-num">{formatUSD(est.refundableDeposit)}</span>
              </Row>
            </dl>
            <p class="adm-footnote">
              {est.dayTypeLabel} rates, {plural(est.billableHours, 'billable hour')}.{' '}
              {est.billableHours > est.hours ? `${plural(est.hours, 'hour')} requested. ` : ''}
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
              <Row label="Phone">{d.phone ? d.phone : <span class="adm-muted">Not given</span>}</Row>
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
        title="Mark this request booked?"
        body={
          <p>
            {d.name}
            {String.fromCharCode(8217)}s request will be marked booked, and {SPACE_PHRASE[d.space]} on {formatLong(d.date)} will be blocked on
            the calendar.
          </p>
        }
        confirmLabel="Mark Booked"
        busyLabel={`Booking${ELLIPSIS}`}
        busy={bookBusy}
        error={bookError}
        onConfirm={markBooked}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
