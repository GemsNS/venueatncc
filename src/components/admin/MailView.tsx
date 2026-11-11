/**
 * Mail: the venue mailbox (faith@venueatncc.org) inside the admin. A thread list with search and an
 * archive, a thread with a reply box, and a new-email form. Bodies are plain text only (the server keeps
 * no HTML), so nothing in an email can run here or load remote images.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, isError } from '../../lib/api';
import type { MailBox, MailMessage, MailStatus, MailThread, MailThreadSummary } from '../../shared/types';
import { Icon } from '../islands/Icon';
import { useAdmin } from './context';
import { ELLIPSIS, LDQUO, RDQUO, SEP, formatStamp, plural } from './format';
import { mailHash } from './route';
import { EmptyState, ErrorBanner, PageHeader, SegmentedRadio, SkeletonRows } from './ui';

const BOXES: { id: MailBox; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'archived', label: 'Archived' },
];

const who = (a: { name: string; address: string }) => a.name || a.address;

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The new text of a message, and the quoted history under it (hidden until asked for). */
export function splitQuoted(text: string): { fresh: string; quoted: string } {
  const lines = text.split('\n');
  let cut = lines.findIndex((l, i) => /^On .{4,200} wrote:\s*$/.test(l.trim()) || (/^\s*>/.test(l) && lines.slice(i).every((x) => /^\s*(>|$)/.test(x))));
  if (cut <= 0) return { fresh: text, quoted: '' };
  while (cut > 0 && lines[cut - 1].trim() === '') cut--;
  return { fresh: lines.slice(0, cut).join('\n'), quoted: lines.slice(cut).join('\n').trim() };
}

/** What a sent message's status means, in words; null when it went out normally. */
function deliveryNote(m: MailMessage): string | null {
  if (m.status === 'outbox') return 'Saved on the server, not delivered: email sending is not set up yet.';
  return null;
}

/** One email in a thread. */
export function MailMessageItem({ m, open = true }: { m: MailMessage; open?: boolean }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const { fresh, quoted } = splitQuoted(m.text);
  const note = deliveryNote(m);
  const to = m.to.map(who).join(', ');
  return (
    <article class={`adm-mailmsg adm-mailmsg--${m.direction}`} aria-label={`${m.direction === 'in' ? who(m.from) : (m.sentBy ?? 'The Venue @ NCC')}, ${formatStamp(m.sentAt)}`}>
      <header class="adm-mailmsg__head">
        <p class="adm-mailmsg__from">
          {m.direction === 'in' ? who(m.from) : (m.sentBy ?? 'The Venue @ NCC')}
          {m.direction === 'in' && m.from.name && <span class="adm-mailmsg__addr"> {m.from.address}</span>}
        </p>
        <p class="adm-mailmsg__meta">
          <time dateTime={m.sentAt}>{formatStamp(m.sentAt)}</time>
          {to && (
            <>
              {SEP}
              <span class="adm-break">To {to}</span>
            </>
          )}
        </p>
      </header>
      {note && (
        <p class="adm-mailmsg__note">
          <Icon name="info" />
          <span>{note}</span>
        </p>
      )}
      {open && <p class="adm-message adm-mailmsg__body">{fresh || <span class="adm-muted">No text.</span>}</p>}
      {open && quoted && (
        <>
          <button type="button" class="btn btn--plain btn--sm adm-mailmsg__more" aria-expanded={showQuoted ? 'true' : 'false'} onClick={() => setShowQuoted((v) => !v)}>
            {showQuoted ? 'Hide earlier text' : 'Show earlier text'}
          </button>
          {showQuoted && <p class="adm-message adm-mailmsg__quoted">{quoted}</p>}
        </>
      )}
      {m.attachments.length > 0 && (
        <ul class="adm-mailmsg__files" aria-label="Attachments">
          {m.attachments.map((a) => {
            const url = api.admin.mail.attachmentUrl(a.id);
            const label = (
              <>
                <Icon name="paperclip" />
                <span class="adm-break">{a.filename}</span>
                <span class="adm-muted">{fileSize(a.size)}</span>
              </>
            );
            return (
              <li key={a.id}>
                {url ? (
                  <a class="adm-mailfile" href={url} download={a.filename}>
                    {label}
                  </a>
                ) : (
                  <span class="adm-mailfile">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

/** The mailbox's state, when it needs saying. */
export function MailStatusBanner({ status }: { status: MailStatus | null }) {
  if (!status) return null;
  if (status.sending === 'demo') {
    return (
      <div class="adm-banner adm-banner--info" role="note">
        <Icon name="info" />
        <p>Demo mailbox. Nothing is sent or received; replies stay in this browser.</p>
      </div>
    );
  }
  const notes: string[] = [];
  if (status.sending === 'outbox') notes.push('Email sending is not set up yet, so emails you send are saved on the server and not delivered.');
  if (status.receiving === 'off') notes.push(`Receiving is not set up yet, so replies to ${status.address} do not show here.`);
  return (
    <>
      {status.receiving === 'error' && <ErrorBanner message={`The mailbox could not be checked. ${status.error ?? ''}`.trim()} />}
      {notes.length > 0 && (
        <div class="adm-banner adm-banner--info" role="note">
          <Icon name="info" />
          <p>{notes.join(' ')}</p>
        </div>
      )}
    </>
  );
}

export function MailListView({ box, q }: { box: MailBox; q: string }) {
  const { run, navigate, toast, refreshStats } = useAdmin();
  const [rows, setRows] = useState<MailThreadSummary[] | null>(null);
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const [checking, setChecking] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    setSearch((cur) => (cur.trim() === q.trim() ? cur : q));
  }, [q]);

  const load = async (quiet = false) => {
    const id = ++reqId.current;
    setError(null);
    if (!quiet) setRows(null);
    const res = await run(api.admin.mail.threads(box, q.trim() || undefined));
    if (id !== reqId.current) return;
    if (isError(res)) {
      setError(res.error);
      setRows([]);
      return;
    }
    setRows(res.threads);
    setStatus(res.status);
  };

  useEffect(() => {
    load();
  }, [box, q]);

  // New mail shows up without a reload while the screen is open.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 60_000);
    return () => window.clearInterval(t);
  }, [box, q]);

  useEffect(() => {
    if (search.trim() === q.trim()) return;
    const t = window.setTimeout(() => navigate(mailHash(box, search), true), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const check = async () => {
    if (checking) return;
    setChecking(true);
    const res = await run(api.admin.mail.sync());
    setChecking(false);
    if (isError(res)) {
      toast(res.error, 'error');
      return;
    }
    setStatus(res);
    await load(true);
    refreshStats();
    if (res.receiving === 'error') toast('The mailbox could not be checked.', 'error');
    else if (res.receiving === 'off') toast('Receiving is not set up yet.', 'info');
    else toast('Mail is up to date.');
  };

  const searching = q.trim().length > 0;

  return (
    <div class="adm-screen">
      <PageHeader title="Mail" subtitle={status ? status.address : 'The venue mailbox.'}>
        <button type="button" class="btn btn--outline" onClick={check} disabled={checking} aria-busy={checking ? 'true' : undefined}>
          <Icon name="refresh-cw" />
          {checking ? `Checking${ELLIPSIS}` : 'Check for Mail'}
        </button>
        <a class="btn btn--filled" href="#/mail/new">
          <Icon name="pencil" />
          New Email
        </a>
      </PageHeader>

      <MailStatusBanner status={status} />

      <div class="adm-toolbar">
        <div class="adm-toolbar__filters">
          <SegmentedRadio label="Show" options={BOXES} value={box} onChange={(b) => navigate(mailHash(b, search), true)} />
        </div>
        <div class="adm-search">
          <label for="adm-mail-search" class="visually-hidden">
            Search mail
          </label>
          <Icon name="search" class="adm-search__icon" />
          <input
            ref={searchRef}
            id="adm-mail-search"
            class="input adm-search__input"
            type="search"
            placeholder="Name, email, or words in a message"
            autocomplete="off"
            spellcheck={false}
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                navigate(mailHash(box, search), true);
              }
            }}
          />
          {search && (
            <button
              type="button"
              class="adm-iconbtn adm-search__clear"
              aria-label="Clear Search"
              onClick={() => {
                setSearch('');
                navigate(mailHash(box, ''), true);
                searchRef.current?.focus();
              }}
            >
              <Icon name="x" />
            </button>
          )}
        </div>
      </div>

      <p class="adm-count-line" aria-live="polite">
        {rows && !error ? `${plural(rows.length, 'conversation')}${searching ? ` matching ${LDQUO}${q.trim()}${RDQUO}` : ''}` : ''}
      </p>

      {error && <ErrorBanner message={error} onRetry={() => load()} />}

      {!rows ? (
        <SkeletonRows count={6} label="Loading mail" />
      ) : rows.length === 0 ? (
        !error && (
          <div class="list-group adm-list">
            {searching ? (
              <EmptyState icon="search" title="No matches">
                No {box === 'archived' ? 'archived ' : ''}mail matches {LDQUO}
                {q.trim()}
                {RDQUO}.
              </EmptyState>
            ) : box === 'archived' ? (
              <EmptyState icon="archive" title="Nothing archived">
                Archive a conversation to clear it from the inbox. A new reply brings it back.
              </EmptyState>
            ) : (
              <EmptyState
                icon="mail"
                title="No mail yet"
                action={
                  <a class="btn btn--outline" href="#/mail/new">
                    New Email
                  </a>
                }
              >
                Emails to and from {status?.address ?? 'the venue'} show up here.
              </EmptyState>
            )}
          </div>
        )
      ) : (
        <ul class="list-group adm-list adm-mailist" aria-label="Conversations">
          {rows.map((t) => (
            <li key={t.id}>
              <a class={`list-row adm-row adm-row--link adm-mailrow${t.unread ? ' is-unread' : ''}`} href={`#/mail/${t.id}`}>
                <span class="adm-mailrow__top">
                  <span class="adm-row__title adm-mailrow__who">
                    {t.unread > 0 && <span class="adm-dot" aria-hidden="true" />}
                    {who(t.counterpart)}
                    {t.count > 1 && <span class="adm-mailrow__count">{t.count}</span>}
                    {t.unread > 0 && <span class="visually-hidden">, {t.unread} unread</span>}
                  </span>
                  <time class="adm-mailrow__time" dateTime={t.lastAt}>
                    {formatStamp(t.lastAt)}
                  </time>
                </span>
                <span class="adm-mailrow__subject">
                  {t.hasAttachments && <Icon name="paperclip" class="adm-mailrow__clip" />}
                  {t.hasAttachments && <span class="visually-hidden">Has attachments. </span>}
                  {t.subject || '(no subject)'}
                </span>
                <span class="adm-row__meta adm-mailrow__snippet">
                  {t.lastDirection === 'out' && 'You: '}
                  {t.snippet}
                </span>
                {t.inquiry && <span class="adm-ref adm-mailrow__ref">{t.inquiry.reference}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The reply box under a thread or a request. */
/** Where a draft's facts come from: a thread, a request, or neither (a new email, from instructions only). */
export interface DraftContext {
  threadId?: number;
  inquiryId?: number;
}

/**
 * Draft and Rewrite above a reply box. Claude (on a server with ANTHROPIC_API_KEY) drafts from the request
 * and the emails, or rewrites what is in the box; otherwise the template drafts an empty box. The draft
 * replaces the box's text, Undo brings the text back, and nothing is sent until Send.
 */
export function DraftBar({
  id,
  context,
  value,
  onReplace,
  onBusy,
  needsInstructions = false,
}: {
  id: string;
  context: DraftContext;
  value: string;
  onReplace: (text: string) => void;
  onBusy?: (busy: boolean) => void;
  /** A new email has no request or thread to draft from, so it needs a few words. */
  needsInstructions?: boolean;
}) {
  const { run, stats } = useAdmin();
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ before: string; after: string; warnings: string[]; by: 'claude' | 'basic' } | null>(null);
  const drafting = stats?.drafting ?? 'basic';
  const claude = drafting === 'claude';
  const hasText = value.trim() !== '';
  const mode = claude && hasText ? 'rewrite' : 'draft';
  // The template only drafts an empty box, and only from a request or an email.
  if (!claude && (needsInstructions || (hasText && result?.after !== value))) return null;
  const current = result && result.after === value ? result : null;

  const go = async () => {
    if (busy) return;
    if (needsInstructions && !instructions.trim() && !hasText) {
      setError('Say in a few words what the email should say.');
      return;
    }
    setBusy(true);
    onBusy?.(true);
    setError(null);
    const res = await run(api.admin.mail.draft({ ...context, mode, text: mode === 'rewrite' ? value : undefined, instructions: instructions.trim() || undefined }));
    setBusy(false);
    onBusy?.(false);
    if (isError(res)) {
      setError(res.error);
      return;
    }
    setResult({ before: value, after: res.text, warnings: res.warnings, by: res.by });
    onReplace(res.text);
  };

  const undo = () => {
    if (!current) return;
    onReplace(current.before);
    setResult(null);
  };

  const label = busy ? (mode === 'rewrite' ? `Rewriting${ELLIPSIS}` : `Drafting${ELLIPSIS}`) : mode === 'rewrite' ? 'Rewrite' : 'Draft';
  return (
    <div class="adm-draft">
      <div class="adm-draft__bar">
        {claude && (
          <input
            id={`${id}-ask`}
            class="input"
            type="text"
            maxLength={500}
            value={instructions}
            placeholder={hasText ? 'What to change' : needsInstructions ? 'What should it say?' : 'What to say'}
            aria-label={hasText ? 'How Claude should change your text (optional)' : needsInstructions ? 'What the email should say' : 'What the draft should say (optional)'}
            aria-describedby={error ? `${id}-draft-error` : undefined}
            onInput={(e) => setInstructions((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                go();
              }
            }}
          />
        )}
        <button type="button" class="btn btn--outline" onClick={go} disabled={busy} aria-busy={busy ? 'true' : undefined}>
          <Icon name="sparkles" />
          {label}
        </button>
        {current && !busy && (
          <button type="button" class="btn btn--plain" onClick={undo}>
            <Icon name="undo-2" />
            Undo
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-draft-error`} class="adm-error" role="alert">
          {error}
        </p>
      )}
      {current && !busy && (
        <div class="adm-draft__check" role="status">
          <p>
            {current.by === 'claude' ? 'Drafted by Claude.' : 'Drafted from the template.'} Read it before sending{current.warnings.length ? ', and check:' : '.'}
          </p>
          {current.warnings.length > 0 && (
            <ul>
              {current.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!claude && !current && (
        <p class="adm-footnote">The template fills in the request and the rates. Claude can write and rewrite replies once it is set up on the server.</p>
      )}
    </div>
  );
}

export function ReplyBox({
  id,
  label,
  placeholder,
  busy,
  error,
  value,
  onInput,
  onSend,
  textareaRef,
  mailto,
  draft,
}: {
  id: string;
  label: string;
  placeholder?: string;
  busy: boolean;
  error: string | null;
  value: string;
  onInput: (v: string) => void;
  onSend: () => void;
  textareaRef?: { current: HTMLTextAreaElement | null };
  /** A mailto: link to write from a mail app instead (the way the request page worked before Mail). */
  mailto?: string;
  /** Show Draft and Rewrite, drafting from this thread or request. */
  draft?: DraftContext;
}) {
  const { user } = useAdmin();
  const [drafting, setDrafting] = useState(false);
  return (
    <form
      class="adm-noteform adm-replybox"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <label class="field__label" for={id}>
        {label}
      </label>
      {draft && <DraftBar id={id} context={draft} value={value} onReplace={onInput} onBusy={setDrafting} />}
      <textarea
        ref={textareaRef}
        id={id}
        class="input"
        rows={Math.min(18, Math.max(6, value.split('\n').length + 1))}
        readOnly={drafting}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <p id={`${id}-help`} class="adm-footnote">
        Your signature is added: {user.name}, The Venue @ NCC, and the phone number.
        {mailto && (
          <>
            {' '}
            <a href={mailto}>Write from your mail app instead</a>.
          </>
        )}
      </p>
      {error && (
        <p id={`${id}-error`} class="adm-error" role="alert">
          {error}
        </p>
      )}
      <div class="adm-noteform__actions">
        <button type="submit" class="btn btn--filled" disabled={busy || drafting} aria-busy={busy ? 'true' : undefined}>
          <Icon name="send" />
          {busy ? `Sending${ELLIPSIS}` : 'Send'}
        </button>
      </div>
    </form>
  );
}

/** The toast after sending, from what happened to the message. */
export function sentToast(m: MailMessage | undefined): [string, 'success' | 'info'] {
  if (m?.status === 'outbox') return ['Saved on the server. Email sending is not set up, so it was not delivered.', 'info'];
  return ['Sent.', 'success'];
}

export function MailThreadView({ id }: { id: number }) {
  const { run, toast, refreshStats, navigate } = useAdmin();
  const [thread, setThread] = useState<MailThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const load = async () => {
    setError(null);
    const res = await run(api.admin.mail.thread(id));
    if (isError(res)) {
      setError(res.error);
      return;
    }
    setThread(res);
    refreshStats();
  };

  useEffect(() => {
    setThread(null);
    load();
  }, [id]);

  const send = async () => {
    if (!thread || busy) return;
    if (!reply.trim()) {
      setReplyError('Write your message first.');
      return;
    }
    setBusy(true);
    setReplyError(null);
    const res = await run(api.admin.mail.reply(thread.id, reply.trim()));
    setBusy(false);
    if (isError(res)) {
      setReplyError(res.fields?.body ?? res.error);
      return;
    }
    setThread(res);
    setReply('');
    const [message, tone] = sentToast(res.messages[res.messages.length - 1]);
    toast(message, tone);
  };

  const setArchived = async (archived: boolean) => {
    if (!thread || moving) return;
    setMoving(true);
    const res = await run(api.admin.mail.update(thread.id, { archived }));
    setMoving(false);
    if (isError(res)) {
      toast(res.error, 'error');
      return;
    }
    if (archived) {
      toast('Archived.');
      navigate('#/mail');
    } else {
      setThread(res);
      toast('Moved to the inbox.');
    }
  };

  const markUnread = async () => {
    if (!thread) return;
    const res = await run(api.admin.mail.update(thread.id, { read: false }));
    if (isError(res)) {
      toast(res.error, 'error');
      return;
    }
    refreshStats();
    toast('Marked unread.');
    navigate('#/mail');
  };

  const back = (
    <a class="btn btn--plain adm-back" href="#/mail">
      <Icon name="chevron-left" />
      Mail
    </a>
  );

  if (error && !thread) {
    return (
      <div class="adm-screen">
        {back}
        <PageHeader title="Email" />
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }
  if (!thread) {
    return (
      <div class="adm-screen" aria-busy="true">
        {back}
        <PageHeader title={<span class="visually-hidden">Loading email</span>} />
        <SkeletonRows count={3} label="" />
      </div>
    );
  }

  const hasIncoming = thread.messages.some((m) => m.direction === 'in');
  return (
    <div class="adm-screen adm-mailthread">
      {back}
      <PageHeader
        title={thread.subject || '(no subject)'}
        subtitle={
          <>
            {who(thread.counterpart)}
            {thread.counterpart.name && <span class="adm-break"> {thread.counterpart.address}</span>}
          </>
        }
      >
        {hasIncoming && (
          <button type="button" class="btn btn--outline" onClick={markUnread}>
            Mark Unread
          </button>
        )}
        <button type="button" class="btn btn--outline" onClick={() => setArchived(!thread.archived)} disabled={moving} aria-busy={moving ? 'true' : undefined}>
          <Icon name={thread.archived ? 'inbox' : 'archive'} />
          {thread.archived ? 'Move to Inbox' : 'Archive'}
        </button>
      </PageHeader>

      {thread.inquiry && (
        <p class="adm-mailthread__link">
          <Icon name="inbox" />
          <span>
            About request{' '}
            <a href={`#/inquiry/${thread.inquiry.id}`}>
              <span class="adm-ref">{thread.inquiry.reference}</span> from {thread.inquiry.name}
            </a>
          </span>
        </p>
      )}

      <ol class="adm-mailthread__list" aria-label="Messages, oldest first">
        {thread.messages.map((m) => (
          <li key={m.id}>
            <MailMessageItem m={m} />
          </li>
        ))}
      </ol>

      <ReplyBox
        id="adm-mail-reply"
        label={`Reply to ${who(thread.messages.slice().reverse().find((m) => m.direction === 'in')?.from ?? thread.counterpart)}`}
        busy={busy}
        error={replyError}
        value={reply}
        onInput={setReply}
        onSend={send}
        draft={{ threadId: thread.id }}
      />
    </div>
  );
}

export function MailComposeView({ to: initialTo, subject: initialSubject }: { to: string; subject: string }) {
  const { run, toast, navigate, refreshStats, user } = useAdmin();
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState(false);

  const send = async (e?: Event) => {
    e?.preventDefault();
    if (busy || drafting) return;
    setBusy(true);
    setError(null);
    setFields({});
    const res = await run(api.admin.mail.send({ to: to.trim(), subject: subject.trim(), body: body.trim() }));
    setBusy(false);
    if (isError(res)) {
      setFields(res.fields ?? {});
      setError(res.fields && Object.keys(res.fields).length ? null : res.error);
      return;
    }
    const [message, tone] = sentToast(res.messages[res.messages.length - 1]);
    toast(message, tone);
    refreshStats();
    navigate(`#/mail/${res.id}`, true);
  };

  const field = (name: 'to' | 'subject' | 'body') => ({
    'aria-invalid': fields[name] ? ('true' as const) : undefined,
    'aria-describedby': fields[name] ? `adm-compose-${name}-error` : undefined,
  });
  const fieldError = (name: string) =>
    fields[name] && (
      <p id={`adm-compose-${name}-error`} class="adm-error" role="alert">
        {fields[name]}
      </p>
    );

  return (
    <div class="adm-screen">
      <a class="btn btn--plain adm-back" href="#/mail">
        <Icon name="chevron-left" />
        Mail
      </a>
      <PageHeader title="New Email" subtitle="From the venue address, with your signature." />
      <form class="adm-compose" onSubmit={send} noValidate>
        <div class="field">
          <label class="field__label" for="adm-compose-to">
            To
          </label>
          <input id="adm-compose-to" class="input" type="email" multiple autocomplete="off" spellcheck={false} value={to} onInput={(e) => setTo((e.target as HTMLInputElement).value)} {...field('to')} />
          {fieldError('to')}
        </div>
        <div class="field">
          <label class="field__label" for="adm-compose-subject">
            Subject
          </label>
          <input id="adm-compose-subject" class="input" type="text" maxLength={200} value={subject} onInput={(e) => setSubject((e.target as HTMLInputElement).value)} {...field('subject')} />
          {fieldError('subject')}
        </div>
        <div class="field">
          <label class="field__label" for="adm-compose-body">
            Message
          </label>
          <DraftBar id="adm-compose-body" context={{}} value={body} onReplace={setBody} onBusy={setDrafting} needsInstructions />
          <textarea
            id="adm-compose-body"
            class="input"
            rows={Math.min(20, Math.max(10, body.split('\n').length + 1))}
            readOnly={drafting}
            value={body}
            onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e);
            }}
            {...field('body')}
          />
          {fieldError('body')}
          <p class="adm-footnote">Your signature is added: {user.name}, The Venue @ NCC, and the phone number.</p>
        </div>
        {error && (
          <p class="adm-error" role="alert">
            {error}
          </p>
        )}
        <div class="adm-noteform__actions">
          <button type="submit" class="btn btn--filled" disabled={busy || drafting} aria-busy={busy ? 'true' : undefined}>
            <Icon name="send" />
            {busy ? `Sending${ELLIPSIS}` : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
