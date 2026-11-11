import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { draftSystemPrompt, type DraftInput } from '../../shared/draft';
import { LOCAL_LIMITS, localAvailability, localWrite, localWriterError, resetLocalWriter } from './local-writer';

const input: DraftInput = {
  mode: 'draft',
  text: '',
  instructions: '',
  inquiry: null,
  emails: Array.from({ length: 8 }, (_, i) => ({ direction: 'in' as const, fromName: 'Sam', sentAt: `2026-10-0${(i % 9) + 1}T12:00:00Z`, text: `Question ${i}` })),
  adminName: 'Faith',
  guestName: 'Sam Okafor',
  today: '2026-10-10',
};

/** A stand-in for Chrome's LanguageModel. */
function fakeModel(opts: { availability?: string; failFirst?: string } = {}) {
  const log = { created: [] as Record<string, unknown>[], prompts: [] as string[], clones: 0, destroyed: 0 };
  let fails = opts.failFirst ? 1 : 0;
  const session = {
    async prompt(text: string) {
      log.prompts.push(text);
      if (fails > 0) {
        fails--;
        throw Object.assign(new Error('too long'), { name: opts.failFirst });
      }
      return '  Hi Sam,\n\nYes.\n\nWarm regards,  ';
    },
    async clone() {
      log.clones++;
      return { ...session, destroy: () => void log.destroyed++ };
    },
    destroy() {},
  };
  (globalThis as Record<string, unknown>).LanguageModel = {
    async availability() {
      return opts.availability ?? 'available';
    },
    async create(o: Record<string, unknown>) {
      log.created.push(o);
      (o.monitor as (m: { addEventListener: (t: string, l: (e: { loaded: number }) => void) => void }) => void)?.({
        addEventListener: (_t, l) => l({ loaded: 1 }),
      });
      return session;
    },
  };
  return log;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).LanguageModel;
  resetLocalWriter();
});

test('no LanguageModel means no on-device writer', async () => {
  assert.equal(await localAvailability(true), 'unavailable');
});

test('the writer reads the facts once, then each draft from a copy of that session', async () => {
  const log = fakeModel({ availability: 'downloadable' });
  assert.equal(await localAvailability(true), 'downloadable');
  const progress: number[] = [];
  assert.equal(await localWrite(input, (f) => progress.push(f)), 'Hi Sam,\n\nYes.\n\nWarm regards,');
  await localWrite(input);
  assert.equal(log.created.length, 1, 'one session with the system prompt');
  assert.deepEqual(log.created[0].initialPrompts, [{ role: 'system', content: draftSystemPrompt() }]);
  assert.equal(log.clones, 2);
  assert.equal(log.destroyed, 2);
  assert.deepEqual(progress, [1]);
  assert.equal(await localAvailability(), 'available');
  // The small model reads the last four emails only.
  assert.equal(log.prompts[0].match(/<email /g)?.length, LOCAL_LIMITS[0].maxEmails);
});

test('a thread too long for the model is tried again with less of it', async () => {
  const log = fakeModel({ failFirst: 'QuotaExceededError' });
  assert.match(await localWrite(input), /^Hi Sam/);
  assert.equal(log.prompts.length, 2);
  assert.equal(log.prompts[1].match(/<email /g)?.length, LOCAL_LIMITS[1].maxEmails);
});

test('other failures come back as words', async () => {
  fakeModel({ failFirst: 'NotAllowedError' });
  await assert.rejects(localWrite(input), (err: Error) => {
    assert.match(localWriterError(err), /did not allow/);
    return true;
  });
  assert.match(localWriterError(new Error('x')), /could not draft this/);
});
