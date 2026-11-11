/**
 * The admin's mail: the venue mailbox's threads, replies, new emails, and attachments.
 * Mounted under /api/admin/mail by adminRoutes, so the session and X-Requested-With checks apply.
 */
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { Hono } from 'hono';
import { formatLong, todayKey } from '../../src/shared/dates';
import type { DraftEmail, DraftInput } from '../../src/shared/draft';
import { fieldErrors, inquiryEmailSchema, mailComposeSchema, mailDraftSchema, mailReplySchema, mailThreadUpdateSchema, parseRecipients } from '../../src/shared/schemas';
import type { InquiryStatus, MailAddress, MailBox } from '../../src/shared/types';
import { INQUIRY_STATUSES } from '../../src/shared/types';
import { apiError, iso, readBody, type AppContextT, type AppEnv, type ServerContext } from '../context';
import { DraftError } from '../mail/draft';
import { replySubject } from '../mail/text';

const statusLabel = (s: InquiryStatus) => INQUIRY_STATUSES.find((x) => x.id === s)?.label ?? s;

function parseId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9][0-9]{0,14}$/.test(raw)) return null;
  return Number(raw);
}

/** The words shown when sending fails: the reason, and that nothing was lost. */
export const SEND_FAILED = (reason: string) => `The email was not sent: ${reason.replace(/\s+/g, ' ').slice(0, 200)} Your message is still here; try again.`;

/** The guest's subject line for a first email about a request. */
export const inquirySubject = (reference: string, date: string) => `Your request for ${formatLong(date)} at The Venue @ NCC (${reference})`;

export function mailRoutes(ctx: ServerContext): Hono<AppEnv> {
  const mail = new Hono<AppEnv>();
  const { repo, now } = ctx;

  const sendLimited = (c: AppContextT) => {
    const key = `admin:${c.get('session').user.id}`;
    const nowMs = now();
    if (ctx.limits.mailSend.consume(key, nowMs)) return null;
    c.header('Retry-After', String(Math.max(1, Math.ceil(ctx.limits.mailSend.retryAfterMs(key, nowMs) / 1000))));
    return apiError(c, 429, 'That is a lot of email in one hour. Wait a while, then send again.');
  };

  const sendFailed = (c: AppContextT, err: unknown) => {
    const reason = err instanceof Error ? err.message : String(err);
    ctx.log.error('[mail] sending failed:', reason);
    return apiError(c, 502, SEND_FAILED(reason.endsWith('.') ? reason : `${reason}.`));
  };

  mail.get('/threads', (c) => {
    const box = (c.req.query('box') || 'inbox') as MailBox;
    if (box !== 'inbox' && box !== 'archived') return apiError(c, 400, 'Unknown mailbox.');
    const q = (c.req.query('q') ?? '').slice(0, 200);
    return c.json({ threads: repo.mailThreads({ box, q }), status: ctx.mail.status() });
  });

  mail.get('/status', (c) => c.json(ctx.mail.status()));

  /** Check the mailbox now (waits for it, up to about half a minute). */
  mail.post('/sync', async (c) => {
    const key = `admin:${c.get('session').user.id}`;
    if (!ctx.limits.mailSync.consume(key, now())) return apiError(c, 429, 'Checking too often. Wait a minute, then try again.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([ctx.mail.sync(), new Promise((resolve) => (timer = setTimeout(resolve, 30_000)))]);
    clearTimeout(timer);
    return c.json(ctx.mail.status());
  });

  /** A thread, marked read (here and in the mailbox). */
  mail.get('/threads/:id', (c) => {
    const id = parseId(c.req.param('id'));
    const thread = id ? repo.mailThread(id) : null;
    if (!id || !thread) return apiError(c, 404, 'That email was not found.');
    const changed = repo.setMailThreadRead(id, true);
    ctx.mail.markInMailbox(changed, true);
    return c.json(repo.mailThread(id)!);
  });

  mail.patch('/threads/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id || !repo.mailThread(id)) return apiError(c, 404, 'That email was not found.');
    const parsed = mailThreadUpdateSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) return apiError(c, 400, 'Nothing to change.');
    if (parsed.data.archived !== undefined) repo.setMailThreadArchived(id, parsed.data.archived);
    if (parsed.data.read !== undefined) ctx.mail.markInMailbox(repo.setMailThreadRead(id, parsed.data.read), parsed.data.read);
    return c.json(repo.mailThread(id)!);
  });

  mail.post('/threads/:id/reply', async (c) => {
    const id = parseId(c.req.param('id'));
    const thread = id ? repo.mailThread(id) : null;
    if (!id || !thread) return apiError(c, 404, 'That email was not found.');
    const parsed = mailReplySchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      return apiError(c, 400, fields.body ?? 'Write your message first.', fields);
    }
    const limited = sendLimited(c);
    if (limited) return limited;
    const target = repo.mailReplyTarget(id)!;
    // Answer whoever wrote last; for a thread the venue started, the person it was sent to.
    const to: MailAddress[] =
      target.direction === 'in' ? [{ name: target.from_name, address: target.from_address }] : [{ name: thread.counterpart.name, address: thread.counterpart.address }];
    try {
      await ctx.mail.send({ to, subject: replySubject(thread.subject), body: parsed.data.body, admin: c.get('session').user, threadId: id });
    } catch (err) {
      return sendFailed(c, err);
    }
    return c.json(repo.mailThread(id)!);
  });

  /** A new email. Joins the latest thread with the same person and subject, if there is one. */
  mail.post('/send', async (c) => {
    const parsed = mailComposeSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      const messages = Object.values(fields);
      return apiError(c, 400, messages.length === 1 ? messages[0] : 'Check the highlighted fields.', fields);
    }
    const inquiryId = parsed.data.inquiryId ?? null;
    if (inquiryId !== null && !repo.getInquiry(inquiryId)) return apiError(c, 400, 'That request was not found.', { inquiryId: 'That request was not found.' });
    const limited = sendLimited(c);
    if (limited) return limited;
    const to = parseRecipients(parsed.data.to)!.map((address) => ({ name: '', address }));
    let sent;
    try {
      sent = await ctx.mail.send({ to, subject: parsed.data.subject, body: parsed.data.body, admin: c.get('session').user, inquiryId });
    } catch (err) {
      return sendFailed(c, err);
    }
    return c.json(repo.mailThread(sent.threadId)!, 201);
  });

  /**
   * Email a request's guest from the request: a reply in their latest thread, or a new email.
   * A New request becomes Contacted.
   */
  mail.post('/inquiry/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    const inquiry = id ? repo.getInquiry(id) : null;
    if (!id || !inquiry) return apiError(c, 404, 'That inquiry was not found.');
    const parsed = inquiryEmailSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      return apiError(c, 400, fields.body ?? fields.subject ?? 'Write your message first.', fields);
    }
    const limited = sendLimited(c);
    if (limited) return limited;
    const who = c.get('session').user;
    const threadId = repo.latestMailThreadWith(inquiry.email);
    const thread = threadId ? repo.mailThread(threadId) : null;
    const subject = parsed.data.subject || (thread ? replySubject(thread.subject) : inquirySubject(inquiry.reference, inquiry.date));
    try {
      await ctx.mail.send({ to: [{ name: inquiry.name, address: inquiry.email }], subject, body: parsed.data.body, admin: who, threadId, inquiryId: id });
    } catch (err) {
      return sendFailed(c, err);
    }
    if (inquiry.status === 'new') {
      const stamp = iso(now());
      repo.db.transaction(() => {
        repo.setInquiryStatus(id, 'contacted', stamp);
        repo.addEvent(id, 'status', `Status changed from ${statusLabel('new')} to ${statusLabel('contacted')} when ${who.name} emailed the guest.`, stamp);
      })();
    }
    return c.json(repo.getInquiryDetail(id)!);
  });

  /**
   * A reply draft for the reply box: from scratch, from the request and the emails so far, or a rewrite of
   * the text. Nothing is sent; the admin edits and sends it.
   */
  mail.post('/draft', async (c) => {
    const parsed = mailDraftSchema.safeParse((await readBody(c, false)) ?? {});
    if (!parsed.success) return apiError(c, 400, 'That draft request is not valid.');
    const { threadId, inquiryId, mode } = parsed.data;
    const text = (parsed.data.text ?? '').trim();
    const instructions = (parsed.data.instructions ?? '').trim();
    if (mode === 'rewrite' && !text) return apiError(c, 400, 'Write something to rewrite first.');
    if (mode === 'rewrite' && ctx.drafter.kind !== 'claude') return apiError(c, 400, 'Rewriting needs Claude, which is not set up on the server.');
    const thread = threadId ? repo.mailThread(threadId) : null;
    if (threadId && !thread) return apiError(c, 404, 'That email was not found.');
    const linked = inquiryId ?? thread?.inquiry?.id ?? null;
    const inquiry = linked ? repo.getInquiryDetail(linked) : null;
    if (inquiryId && !inquiry) return apiError(c, 404, 'That inquiry was not found.');
    if (!thread && !inquiry && mode === 'draft' && !instructions) {
      return apiError(c, 400, 'Say in a few words what the email should say, then press Draft.', { instructions: 'Say what the email should say.' });
    }
    const key = `admin:${c.get('session').user.id}`;
    if (!ctx.limits.mailDraft.consume(key, now())) return apiError(c, 429, 'That is a lot of drafts in one hour. Wait a while, then try again.');

    const messages = thread?.messages ?? inquiry?.emails ?? [];
    const emails: DraftEmail[] = messages.map((m) => ({ direction: m.direction, fromName: m.from.name || m.from.address, sentAt: m.sentAt, text: m.text }));
    const lastIn = [...messages].reverse().find((m) => m.direction === 'in');
    const input: DraftInput = {
      mode,
      text,
      instructions,
      inquiry,
      emails,
      adminName: c.get('session').user.name,
      guestName: inquiry?.name ?? lastIn?.from.name ?? thread?.counterpart.name ?? '',
      today: todayKey(new Date(now())),
    };
    try {
      return c.json(await ctx.drafter.write(input));
    } catch (err) {
      // The reason only, never the prompt or the draft.
      const reason = err instanceof DraftError ? err.message : 'Something went wrong while drafting. Try again.';
      ctx.log.error('[mail] drafting failed:', err instanceof Error ? `${err.name}: ${err.message.slice(0, 200)}` : 'unknown error');
      return apiError(c, 502, reason);
    }
  });

  mail.get('/attachments/:id', (c) => {
    const id = parseId(c.req.param('id'));
    const file = id ? repo.mailAttachment(id) : null;
    if (!id || !file) return apiError(c, 404, 'That attachment was not found.');
    const full = ctx.mail.filePath(file.file);
    if (!fs.existsSync(full)) return apiError(c, 404, 'That attachment is no longer on the server.');
    const ascii = file.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    // Always a download, never shown in the admin's own origin.
    return c.body(Readable.toWeb(fs.createReadStream(full)) as ReadableStream, 200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(fs.statSync(full).size),
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'X-Content-Type-Options': 'nosniff',
    });
  });

  return mail;
}
