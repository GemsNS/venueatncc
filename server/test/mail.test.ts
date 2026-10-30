import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createTransport } from 'nodemailer';
import type { InquiryCreated, InquiryDetail, MailThread, MailThreadList } from '../../src/shared/types';
import type { ImapClient, ImapFactory, ImapMessage } from '../mail/service';
import { replySubject, snippetOf, subjectKey } from '../mail/text';
import { createHarness, login, submitInquiry, type Harness } from './helpers';

// ------------------------------------------------------------------ a fake mailbox

interface FakeMessage {
  uid: number;
  raw: Buffer;
  flags: Set<string>;
  internalDate: Date;
}

class FakeMailbox {
  folders = new Map<string, { uidValidity: bigint; uidNext: number; messages: FakeMessage[] }>();
  appended: { folder: string; raw: Buffer }[] = [];
  connects = 0;

  folder(name: string) {
    let f = this.folders.get(name);
    if (!f) this.folders.set(name, (f = { uidValidity: 7n, uidNext: 1, messages: [] }));
    return f;
  }

  deliver(name: string, raw: Buffer, date: Date, flags: string[] = []): number {
    const f = this.folder(name);
    const uid = f.uidNext++;
    f.messages.push({ uid, raw, flags: new Set(flags), internalDate: date });
    return uid;
  }

  factory: ImapFactory = () => {
    const box = this;
    let open: string | null = null;
    const client: ImapClient = {
      async connect() {
        box.connects++;
      },
      async logout() {},
      close() {},
      on() {
        return client;
      },
      get mailbox() {
        if (!open) return false;
        const f = box.folder(open);
        return { uidValidity: f.uidValidity, uidNext: f.uidNext, exists: f.messages.length };
      },
      async getMailboxLock(name) {
        open = name;
        return { release() {} };
      },
      async search(query) {
        const f = box.folder(open!);
        if (query.since) return f.messages.filter((m) => m.internalDate >= query.since!).map((m) => m.uid);
        const from = Number(query.uid!.split(':')[0]);
        const found = f.messages.filter((m) => m.uid >= from).map((m) => m.uid);
        // IMAP answers N:* with the last message even when N is past it.
        return found.length ? found : f.messages.slice(-1).map((m) => m.uid);
      },
      async fetchOne(uid, query) {
        const m = box.folder(open!).messages.find((x) => x.uid === Number(uid));
        if (!m) return false;
        const out: ImapMessage = { uid: m.uid, size: m.raw.length, flags: new Set(m.flags), internalDate: m.internalDate };
        if (query.source) out.source = m.raw;
        return out;
      },
      async messageFlagsAdd(range, flags) {
        for (const m of box.folder(open!).messages) if (range.includes(m.uid)) flags.forEach((fl) => m.flags.add(fl));
        return true;
      },
      async messageFlagsRemove(range, flags) {
        for (const m of box.folder(open!).messages) if (range.includes(m.uid)) flags.forEach((fl) => m.flags.delete(fl));
        return true;
      },
      async append(name, content) {
        box.appended.push({ folder: name, raw: content });
        return true;
      },
    };
    return client;
  };
}

const composer = createTransport({ streamTransport: true, buffer: true });

async function rawMail(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  messageId?: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer }[];
  date?: Date;
}): Promise<Buffer> {
  const info = await composer.sendMail({ ...opts, date: opts.date ?? new Date('2026-10-01T15:00:00Z') });
  return info.message as Buffer;
}

// ------------------------------------------------------------------ tests

describe('mail', () => {
  let h: Harness;
  let mailbox: FakeMailbox;
  let cookie: string;

  before(async () => {
    mailbox = new FakeMailbox();
    h = await createHarness({ IMAP_HOST: 'imap.example.org', IMAP_PASS: 'secret', IMAP_SENT: 'Sent' }, { imapFactory: mailbox.factory });
    cookie = await login(h);
  });
  after(() => h.close());

  const get = async <T>(p: string) => {
    const res = await h.request(p, { cookie });
    assert.equal(res.status, 200, await res.clone().text());
    return (await res.json()) as T;
  };
  const threads = (box = 'inbox', q = '') => get<MailThreadList>(`/api/admin/mail/threads?box=${box}${q ? `&q=${encodeURIComponent(q)}` : ''}`);

  async function newInquiry(email: string) {
    const res = await submitInquiry(h, { email, name: 'Morgan Lee' });
    assert.equal(res.status, 201);
    await h.whenIdle();
    const { reference } = (await res.json()) as InquiryCreated;
    return h.db.prepare('SELECT id, reference FROM inquiries WHERE reference = ?').get(reference) as { id: number; reference: string };
  }

  test('text helpers', () => {
    assert.equal(subjectKey('RE: Fwd: re:  Your request'), 'your request');
    assert.equal(replySubject('Re: Hello'), 'Re: Hello');
    assert.equal(replySubject('Hello'), 'Re: Hello');
    assert.equal(snippetOf('Thanks!\n\nOn Thu, Oct 1, 2026, Faith wrote:\n> old'), 'Thanks!');
  });

  test('every mail route needs a session, and writes need X-Requested-With', async () => {
    for (const [method, p] of [
      ['GET', '/api/admin/mail/threads'],
      ['GET', '/api/admin/mail/threads/1'],
      ['GET', '/api/admin/mail/attachments/1'],
      ['POST', '/api/admin/mail/sync'],
      ['POST', '/api/admin/mail/send'],
    ] as const) {
      const res = await h.request(p, { method, body: method === 'POST' ? {} : undefined });
      assert.equal(res.status, 401, `${method} ${p}`);
    }
    const res = await h.request('/api/admin/mail/send', { body: {}, cookie, xrw: false });
    assert.equal(res.status, 403);
  });

  test('a guest confirmation starts a thread, and the guest reply joins it and the request', async () => {
    const inq = await newInquiry('morgan@example.com');
    const before = await get<InquiryDetail>(`/api/admin/inquiries/${inq.id}`);
    assert.equal(before.emails?.length, 1);
    const confirmation = h.db.prepare("SELECT message_id, thread_id FROM mail_messages WHERE inquiry_id = ? AND direction = 'out'").get(inq.id) as {
      message_id: string;
      thread_id: number;
    };
    assert.ok(confirmation.message_id);

    mailbox.deliver(
      'INBOX',
      await rawMail({
        from: 'Morgan Lee <morgan@example.com>',
        to: 'faith@venueatncc.org',
        subject: `Re: Your request to The Venue @ NCC (${inq.reference})`,
        text: 'Is the Saturday after still open?\n\nOn Thu, Faith wrote:\n> earlier',
        inReplyTo: `<${confirmation.message_id}>`,
        date: new Date(h.clock.now + 60_000),
      }),
      new Date(h.clock.now),
    );
    await h.request('/api/admin/mail/sync', { method: 'POST', body: {}, cookie });

    const list = await threads();
    const t = list.threads.find((x) => x.id === confirmation.thread_id)!;
    assert.ok(t, 'the reply joined the confirmation thread');
    assert.equal(t.count, 2);
    assert.equal(t.unread, 1);
    assert.equal(t.snippet, 'Is the Saturday after still open?');
    assert.equal(t.inquiry?.reference, inq.reference);
    assert.equal(list.status.receiving, 'ok');

    const after = await get<InquiryDetail>(`/api/admin/inquiries/${inq.id}`);
    assert.equal(after.emails?.length, 2);
    assert.ok(after.events.some((e) => e.kind === 'email' && e.detail.startsWith('Email received from Morgan Lee')));
    const stats = await get<{ unreadMail: number }>('/api/admin/stats');
    assert.equal(stats.unreadMail, 1);
  });

  test('opening a thread marks it read here and in the mailbox; syncing again copies nothing twice', async () => {
    const { threads: list } = await threads();
    const t = list.find((x) => x.unread > 0)!;
    const thread = await get<MailThread>(`/api/admin/mail/threads/${t.id}`);
    assert.ok(thread.messages.every((m) => m.read));
    await h.whenIdle();
    assert.ok(mailbox.folder('INBOX').messages[0].flags.has('\\Seen'));

    const count = () => (h.db.prepare('SELECT COUNT(*) AS n FROM mail_messages').get() as { n: number }).n;
    const n = count();
    await h.request('/api/admin/mail/sync', { method: 'POST', body: {}, cookie });
    assert.equal(count(), n);
  });

  test('a reply is threaded, signed, and saved (outbox while SMTP is not set up)', async () => {
    h.clock.advance(120_000);
    const { threads: list } = await threads();
    const t = list.find((x) => x.count === 2)!;
    const res = await h.request(`/api/admin/mail/threads/${t.id}/reply`, { body: { body: 'Yes, it is open. Shall I hold it?' }, cookie });
    assert.equal(res.status, 200, await res.clone().text());
    const thread = (await res.json()) as MailThread;
    assert.equal(thread.messages.length, 3);
    const sent = thread.messages[2];
    assert.equal(sent.direction, 'out');
    assert.equal(sent.status, 'outbox');
    assert.equal(sent.to[0].address, 'morgan@example.com');
    assert.equal(sent.sentBy, 'Faith');
    assert.match(sent.text, /Shall I hold it\?\n\nFaith\nThe Venue @ NCC/);

    const eml = fs
      .readdirSync(h.config.outboxDir)
      .filter((f) => f.endsWith('.eml'))
      .map((f) => fs.readFileSync(path.join(h.config.outboxDir, f), 'utf8'))
      .find((s) => s.includes('Shall I hold it?'))!;
    assert.match(eml, /^In-Reply-To: <.+>$/m);
    assert.match(eml, /^References: /m);
    assert.match(eml, /^From: "The Venue @ NCC" <faith@venueatncc\.org>$/m);
    assert.match(eml, /^Subject: Re: Your request/m);
    assert.match(eml, /> Is the Saturday after still open\?/);
    // Not copied to the sent folder: it was not delivered.
    assert.equal(mailbox.appended.length, 0);

    // The same message found later in the sent folder (copied there, or by another mail app) is not stored twice.
    const count = () => (h.db.prepare('SELECT COUNT(*) AS n FROM mail_messages').get() as { n: number }).n;
    const n = count();
    mailbox.deliver('Sent', Buffer.from(eml), new Date(h.clock.now));
    await h.ctx.mail.sync();
    assert.equal(count(), n);
  });

  test('emailing from a request replies in the guest thread and moves New to Contacted', async () => {
    const inq = await newInquiry('casey@example.com');
    const res = await h.request(`/api/admin/mail/inquiry/${inq.id}`, { body: { body: 'Thanks for your request.' }, cookie });
    assert.equal(res.status, 200, await res.clone().text());
    const d = (await res.json()) as InquiryDetail;
    assert.equal(d.status, 'contacted');
    assert.equal(d.emails?.length, 2);
    assert.equal(d.emails?.[1].subject, `Re: Your request to The Venue @ NCC (${inq.reference})`);
    assert.equal(d.emails?.[0].threadId, d.emails?.[1].threadId);
    assert.ok(d.events.some((e) => e.kind === 'status' && /emailed the guest/.test(e.detail)));
  });

  test('new emails are validated', async () => {
    let res = await h.request('/api/admin/mail/send', { body: { to: 'not an address', subject: 'Hi', body: 'Hello' }, cookie });
    assert.equal(res.status, 400);
    assert.ok(((await res.json()) as { fields: Record<string, string> }).fields.to);
    res = await h.request('/api/admin/mail/send', { body: { to: 'a@example.com', subject: 'Line\nbreak', body: 'Hello' }, cookie });
    assert.equal(res.status, 400);
    res = await h.request('/api/admin/mail/send', { body: { to: 'Pat <pat@example.com>, sam@example.com', subject: 'Tour', body: 'Hello' }, cookie });
    assert.equal(res.status, 201, await res.clone().text());
    const t = (await res.json()) as MailThread;
    assert.deepEqual(
      t.messages[0].to.map((a) => a.address),
      ['pat@example.com', 'sam@example.com'],
    );
  });

  test('only venue mail is copied from a shared mailbox; the venue notifications are skipped', async () => {
    const mb = new FakeMailbox();
    const shared = await createHarness({ IMAP_HOST: 'imap.example.org', IMAP_USER: 'faith@wearencc.org', IMAP_PASS: 'x' }, { imapFactory: mb.factory });
    try {
      const at = new Date(shared.clock.now);
      mb.deliver('INBOX', await rawMail({ from: 'a@example.com', to: 'faith@wearencc.org', subject: 'Church business', text: 'Private' }), at);
      mb.deliver('INBOX', await rawMail({ from: 'b@example.com', to: 'faith@venueatncc.org', subject: 'Venue question', text: 'Hello' }), at);
      mb.deliver(
        'INBOX',
        await rawMail({ from: 'faith@venueatncc.org', to: 'faith@venueatncc.org', subject: 'New inquiry', text: 'x', headers: { 'X-Venue-Mail': 'notification' } }),
        at,
      );
      await shared.ctx.mail.sync();
      const subjects = (shared.db.prepare('SELECT subject FROM mail_messages').all() as { subject: string }[]).map((r) => r.subject);
      assert.deepEqual(subjects, ['Venue question']);
    } finally {
      await shared.close();
    }
  });

  test('archive, and a new message brings the thread back', async () => {
    const at = new Date(h.clock.now);
    mailbox.deliver('INBOX', await rawMail({ from: 'Riley <riley@example.com>', to: 'faith@venueatncc.org', subject: 'Parking', text: 'How many cars?' }), at);
    await h.ctx.mail.sync();
    const t = (await threads()).threads.find((x) => x.subject === 'Parking')!;
    let res = await h.request(`/api/admin/mail/threads/${t.id}`, { method: 'PATCH', body: { archived: true }, cookie });
    assert.equal(res.status, 200);
    assert.ok(!(await threads()).threads.some((x) => x.id === t.id));
    assert.ok((await threads('archived')).threads.some((x) => x.id === t.id));
    mailbox.deliver('INBOX', await rawMail({ from: 'riley@example.com', to: 'faith@venueatncc.org', subject: 'RE: Parking', text: 'Also, buses?' }), at);
    await h.ctx.mail.sync();
    assert.ok((await threads()).threads.some((x) => x.id === t.id && x.count === 2));
    res = await h.request(`/api/admin/mail/threads/${t.id}`, { method: 'PATCH', body: {}, cookie });
    assert.equal(res.status, 400);
  });

  test('attachments download as attachments; search finds threads', async () => {
    mailbox.deliver(
      'INBOX',
      await rawMail({
        from: 'jo@example.com',
        to: 'faith@venueatncc.org',
        subject: 'Floor plan',
        text: 'See attached.',
        attachments: [{ filename: 'plan<1>.pdf', content: Buffer.from('%PDF-1.4 test') }],
      }),
      new Date(h.clock.now),
    );
    await h.ctx.mail.sync();
    const found = await threads('inbox', 'floor plan');
    assert.equal(found.threads.length, 1);
    assert.ok(found.threads[0].hasAttachments);
    const thread = await get<MailThread>(`/api/admin/mail/threads/${found.threads[0].id}`);
    const a = thread.messages[0].attachments[0];
    assert.equal(a.filename, 'plan<1>.pdf');
    const res = await h.request(`/api/admin/mail/attachments/${a.id}`, { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/octet-stream');
    assert.match(res.headers.get('content-disposition') ?? '', /^attachment; filename="plan<1>\.pdf"/);
    assert.equal(await res.text(), '%PDF-1.4 test');
  });

  test('a mailbox that refuses the sign-in shows as an error, without the password', async () => {
    const broken = await createHarness(
      { IMAP_HOST: 'imap.example.org', IMAP_PASS: 'hunter22' },
      {
        imapFactory: () => {
          const c = new FakeMailbox().factory({} as never, { user: '', pass: '' });
          c.connect = async () => {
            throw Object.assign(new Error('Command failed'), { authenticationFailed: true });
          };
          return c;
        },
      },
    );
    try {
      await broken.ctx.mail.sync();
      const status = broken.ctx.mail.status();
      assert.equal(status.receiving, 'error');
      assert.match(status.error ?? '', /refused the sign-in/);
      assert.ok(!(status.error ?? '').includes('hunter22'));
    } finally {
      await broken.close();
    }
  });

  test('without IMAP, sending still works and receiving is off', async () => {
    const plain = await createHarness();
    try {
      assert.equal(plain.ctx.mail.status().receiving, 'off');
      const c = await login(plain);
      const res = await plain.request('/api/admin/mail/send', { body: { to: 'x@example.com', subject: 'Hello', body: 'Hi' }, cookie: c });
      assert.equal(res.status, 201);
    } finally {
      await plain.close();
    }
  });
});
