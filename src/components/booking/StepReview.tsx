/** Step 4: an inset grouped summary with Edit links, the honeypot, and any send error. */
import type { Ref } from 'preact';
import { Icon } from '../islands/Icon';
import { eventTypeName } from '../../data/event-types';
import { site } from '../../data/site';
import { addHours, formatLong, formatTime } from '../../shared/dates';
import { guestsLabel, hoursLabel, spaceLabel, telHref } from './lib';
import type { Draft, Step } from './wizard';

const PREF_LABEL = { email: 'Email', phone: 'Phone call', text: 'Text message' } as const;

function Group(props: { title: string; step: Step; onEdit: (step: Step) => void; rows: [string, string][] }) {
  const headId = `bk-review-${props.step}`;
  return (
    <section class="bk-group" aria-labelledby={headId}>
      <div class="bk-group__head">
        <h3 id={headId} class="bk-group__title">
          {props.title}
        </h3>
        <button type="button" class="btn btn--plain btn--sm bk-edit" onClick={() => props.onEdit(props.step)}>
          Edit<span class="visually-hidden"> {props.title.toLowerCase()}</span>
        </button>
      </div>
      <dl class="list-group bk-list bk-dl">
        {props.rows.map(([k, v]) => (
          <div class="bk-dl__row" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function StepReview(props: {
  d: Draft;
  onEdit: (step: Step) => void;
  honeypot: Ref<HTMLInputElement>;
  submitError: string | null;
  onRetry: () => void;
  sending: boolean;
}) {
  const { d } = props;
  const rows1: [string, string][] = [
    ['Date', d.date ? formatLong(d.date) : 'Not chosen'],
    ['Time', `${formatTime(d.startTime)} to ${formatTime(addHours(d.startTime, d.hours))} (${hoursLabel(d.hours)})`],
    ['Space', spaceLabel(d.space)],
    ['Guests', guestsLabel(d.guests)],
  ];
  const rows2: [string, string][] = [
    ['Event', d.eventType ? eventTypeName(d.eventType, d.eventTypeOther.trim()) : 'Not chosen'],
    ['Alcohol', d.servingAlcohol ? 'We plan to serve alcohol' : 'No alcohol planned'],
    ['Visit first', d.wantsVisit ? (d.visitNotes.trim() ? `Yes. ${d.visitNotes.trim()}` : 'Yes') : 'No'],
  ];
  const rows3: [string, string][] = [
    ['Name', d.name.trim()],
    ['Email', d.email.trim()],
    ...(d.phone.trim() ? ([['Phone', d.phone.trim()]] as [string, string][]) : []),
    ['Reach me by', PREF_LABEL[d.contactPreference]],
    ...(d.message.trim() ? ([['Message', d.message.trim()]] as [string, string][]) : []),
  ];

  return (
    <div class="bk-step4">
      <Group title="Date and space" step={1} onEdit={props.onEdit} rows={rows1} />
      <Group title="Your event" step={2} onEdit={props.onEdit} rows={rows2} />
      <Group title="Contact" step={3} onEdit={props.onEdit} rows={rows3} />

      <p class="bk-review__fine">
        This is a request, not a booking yet. We follow up to confirm the date and details, then your date is reserved for you.
      </p>

      <div class="bk-hp" aria-hidden="true">
        <label for="bk-website">Leave this field empty</label>
        <input id="bk-website" name="website" type="text" tabIndex={-1} autoComplete="off" ref={props.honeypot} />
      </div>

      {props.submitError && (
        <div class="bk-senderr" role="alert">
          <div class="bk-senderr__head">
            <Icon name="info" />
            <p class="bk-senderr__title">Your request was not sent</p>
          </div>
          <p>{props.submitError}</p>
          <p>
            Your details are saved on this page. Try again, or call us and we will take your request by phone.
          </p>
          <div class="btn-row">
            <button type="button" class="btn btn--filled" onClick={props.onRetry} disabled={props.sending}>
              Try Again
            </button>
            <a class="btn btn--gray" href={telHref(site.contact.phoneE164)}>
              <Icon name="phone" />
              Call {site.contact.phone}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
