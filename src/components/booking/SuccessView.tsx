/** Confirmation after a request is sent. */
import type { Ref } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { eventTypeName } from '../../data/event-types';
import { site } from '../../data/site';
import { href } from '../../lib/paths';
import { formatLong } from '../../shared/dates';
import { formatUSD } from '../../shared/pricing';
import type { DateKey, InquiryCreated } from '../../shared/types';
import { guestsLabel, spaceLabel, telHref } from './lib';
import { EstimateView } from './ui';
import type { Draft } from './wizard';

const REACH = { email: 'by email', phone: 'by phone', text: 'by text message' } as const;

export function SuccessView(props: {
  created: InquiryCreated;
  d: Draft;
  today: DateKey;
  demo: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onPlanAnother: () => void;
}) {
  const { created, d } = props;
  const [copied, setCopied] = useState(false);
  const firstName = d.name.trim().split(/\s+/)[0] ?? '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.reference);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const rows: [string, string][] = [
    ['Date', d.date ? formatLong(d.date) : ''],
    ['Space', spaceLabel(d.space)],
    ['Guests', guestsLabel(d.guests)],
    ['Event', eventTypeName(d.eventType, d.eventTypeOther.trim())],
    ['Estimated total', formatUSD(created.estimate.total)],
  ];

  return (
    <div class="bk-success">
      <div class="bk-success__hero">
        <span class="bk-success__badge" aria-hidden="true">
          <Icon name="check" />
        </span>
        <h2 class="bk-success__title" tabIndex={-1} ref={props.headingRef}>
          Request sent
        </h2>
        <p class="bk-success__lead">
          {firstName ? `Thank you, ${firstName}. ` : 'Thank you. '}
          We have your request for {d.date ? formatLong(d.date) : 'your date'}.
        </p>
        <div class="bk-ref">
          <span class="bk-ref__label">Your reference</span>
          <span class="bk-ref__code">{created.reference}</span>
          <button type="button" class="btn btn--gray btn--sm" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span class="visually-hidden" role="status">
            {copied ? 'Reference copied' : ''}
          </span>
        </div>
      </div>

      {props.demo && (
        <div class="bk-demo-note">
          <Icon name="info" />
          <p>
            This is a demo. Nothing was sent. <a href={href('/admin/')}>Sign in to the demo admin</a> to see your request.
          </p>
        </div>
      )}

      <div class="bk-success__grid">
        <section class="bk-group" aria-labelledby="bk-success-summary">
          <h3 id="bk-success-summary" class="bk-group__title">
            Your request
          </h3>
          <dl class="list-group bk-list bk-dl">
            {rows.map(([k, v]) => (
              <div class="bk-dl__row" key={k}>
                <dt>{k}</dt>
                <dd class={k === 'Estimated total' ? 'num' : undefined}>{v}</dd>
              </div>
            ))}
          </dl>
          <details class="bk-details">
            <summary>See the Estimate</summary>
            <EstimateView est={created.estimate} date={d.date} today={props.today} />
          </details>
        </section>

        <section class="bk-group" aria-labelledby="bk-next-title">
          <h3 id="bk-next-title" class="bk-group__title">
            What happens next
          </h3>
          <ol class="bk-next">
            <li>
              <span class="bk-next__n" aria-hidden="true">
                1
              </span>
              <span>
                <strong>We review your request.</strong> We check the calendar and your details.
              </span>
            </li>
            <li>
              <span class="bk-next__n" aria-hidden="true">
                2
              </span>
              <span>
                <strong>We reach out.</strong> We contact you {REACH[d.contactPreference]} to confirm the details and your quote.
              </span>
            </li>
            <li>
              <span class="bk-next__n" aria-hidden="true">
                3
              </span>
              <span>
                <strong>Your date is reserved.</strong> Once the booking deposit is paid, the date is yours.
              </span>
            </li>
          </ol>
          <p class="bk-success__contact secondary">
            Questions? Call <a href={telHref(site.contact.phoneE164)}>{site.contact.phone}</a> or email{' '}
            <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.
          </p>
        </section>
      </div>

      <div class="btn-row bk-success__actions">
        <a class="btn btn--filled btn--lg" href={href('/')}>
          Done
        </a>
        <button type="button" class="btn btn--gray btn--lg" onClick={props.onPlanAnother}>
          Plan Another
        </button>
      </div>
    </div>
  );
}
