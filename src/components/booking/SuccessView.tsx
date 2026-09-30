/**
 * Confirmation after a request is sent: a Caslon Display title, the reference, the request in a white panel
 * and what happens next in a Petal panel. It shows no amounts: we confirm availability and send each quote
 * personally.
 */
import type { Ref } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import { eventTypeName } from '../../data/event-types';
import { isDemo } from '../../lib/env';
import { href } from '../../lib/paths';
import type { InquiryCreated } from '../../shared/types';
import { formatLongKept, guestsLabel, spaceLabel } from './lib';
import type { Draft } from './wizard';

const REACH = { email: 'by email', phone: 'by phone', text: 'by text message' } as const;

export function SuccessView(props: {
  created: InquiryCreated;
  d: Draft;
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
    ['Date', d.date ? formatLongKept(d.date) : ''],
    ['Space', spaceLabel(d.space)],
    ['Guests', guestsLabel(d.guests)],
    ['Event', eventTypeName(d.eventType, d.eventTypeOther.trim())],
  ];

  const steps = [
    ['We confirm availability.', 'We check the calendar and your details.'],
    ['We send your quote personally.', `We contact you ${REACH[d.contactPreference]} with your quote and to confirm the details.`],
    ['Accept the quote to reserve the date.', 'Your quote explains how to hold the date.'],
  ];

  return (
    <div class="bk-success">
      <div class="bk-success__hero">
        <p class="eyebrow">Request sent</p>
        <h2 class="bk-success__title" tabIndex={-1} ref={props.headingRef}>
          {firstName ? `Thank you, ${firstName}.` : 'Thank you.'}
        </h2>
        <p class="bk-success__lead t-lead">We have your request for {d.date ? formatLongKept(d.date) : 'your date'} and will be in touch soon.</p>
        <div class="bk-ref">
          <span class="bk-ref__label">Your reference</span>
          <span class="bk-ref__code num">{created.reference}</span>
          <button type="button" class="btn btn--outline btn--sm" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span class="visually-hidden" role="status">
            {copied ? 'Reference copied' : ''}
          </span>
        </div>
      </div>

      {/* Build-time gate first, so the production bundle carries none of this. */}
      {isDemo && props.demo && (
        <div class="bk-demo-note">
          <Icon name="info" />
          <p>
            This is a demo. Nothing was sent. <a href={href('/admin/')}>Sign in to the demo admin</a> to see your request.
          </p>
        </div>
      )}

      <div class="bk-success__grid">
        <section class="bk-panel bk-group" aria-labelledby="bk-success-summary">
          <h3 id="bk-success-summary" class="bk-panel__title">
            Your request
          </h3>
          <dl class="bk-dl">
            {rows.map(([k, v]) => (
              <div class="bk-dl__row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section class="bk-facts" aria-labelledby="bk-next-title">
          <h3 id="bk-next-title" class="bk-facts__title">
            What happens next
          </h3>
          <ol class="bk-next">
            {steps.map(([head, text], i) => (
              <li key={head}>
                <span class="bk-next__n num" aria-hidden="true">
                  {i + 1}
                </span>
                <span class="bk-fact__text">
                  <span>{head}</span>
                  <span class="bk-fact__hint">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div class="btn-row bk-success__actions">
        <a class="btn btn--filled btn--lg" href={href('/')}>
          Done
        </a>
        <button type="button" class="btn btn--outline btn--lg" onClick={props.onPlanAnother}>
          Plan Another Event
        </button>
      </div>
    </div>
  );
}
