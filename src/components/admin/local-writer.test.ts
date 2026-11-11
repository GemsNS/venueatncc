import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { draftSystemPrompt, type DraftInput } from '../../shared/draft';
import {
  LOCAL_LIMITS,
  localAvailability,
  localState,
  localWrite,
  localWriterError,
  onLocalState,
  prepareLocalWriter,
  resetLocalWriter,
  warmLocalWriter,
  type LocalState,
} from './local-writer';

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
  const states: LocalState[] = [];
  onLocalState((s) => states.push(s));
  assert.equal(await localWrite(input), 'Hi Sam,\n\nYes.\n\nWarm regards,');
  await localWrite(input);
  assert.equal(log.created.length, 1, 'one session with the system prompt');
  assert.deepEqual(log.created[0].initialPrompts, [{ role: 'system', content: draftSystemPrompt() }]);
  assert.equal(log.clones, 2);
  assert.equal(log.destroyed, 2);
  assert.deepEqual(states, [
    { phase: 'loading', progress: 0 },
    { phase: 'loading', progress: 1 },
    { phase: 'ready', progress: 1 },
  ]);
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

/** A session that streams its answer in pieces, or stops after the first piece. */
function streamingModel(pieces: string[], opts: { stallAfterFirst?: boolean } = {}) {
  const session = {
    async prompt() {
      throw new Error('streaming only');
    },
    promptStreaming(_text: string, o?: { signal?: AbortSignal }) {
      let i = 0;
      return new ReadableStream<string>({
        pull(controller) {
          if (opts.stallAfterFirst && i === 1) {
            // Never answers again, until the writer gives up.
            return new Promise<void>((resolve) => o?.signal?.addEventListener('abort', () => resolve()));
          }
          if (i < pieces.length) controller.enqueue(pieces[i++]);
          else controller.close();
        },
      });
    },
    async clone() {
      return session;
    },
    destroy() {},
  };
  (globalThis as Record<string, unknown>).LanguageModel = {
    async availability() {
      return 'available';
    },
    async create() {
      return session;
    },
  };
}

test('a streamed draft fills the box as it is written', async () => {
  streamingModel(['Hi Sam,', '\n\nSaturday', ' works.']);
  const seen: string[] = [];
  assert.equal(await localWrite(input, (t) => seen.push(t)), 'Hi Sam,\n\nSaturday works.');
  assert.deepEqual(seen, ['Hi Sam,', 'Hi Sam,\n\nSaturday', 'Hi Sam,\n\nSaturday works.']);
});

test('an older Chrome that streams the whole text so far each time', async () => {
  streamingModel(['Hi Sam,', 'Hi Sam, yes', 'Hi Sam, yes.']);
  assert.equal(await localWrite(input), 'Hi Sam, yes.');
});

test('a writer that stops writing is given up, so the template can take over', async () => {
  streamingModel(['Hi Sam,'], { stallAfterFirst: true });
  await assert.rejects(localWrite(input, undefined, 30), (err: Error) => {
    assert.equal(err.name, 'TimeoutError');
    assert.match(localWriterError(err), /too slow/);
    return true;
  });
});

test('a model already on the computer is loaded before the first draft; one that needs a download is not', async () => {
  const log = fakeModel({ availability: 'downloadable' });
  await warmLocalWriter();
  assert.equal(log.created.length, 0, 'a download waits for a click');
  resetLocalWriter();
  const ready = fakeModel({ availability: 'available' });
  await warmLocalWriter();
  assert.equal(ready.created.length, 1);
  assert.equal(localState().phase, 'ready');
  await localWrite(input);
  assert.equal(ready.created.length, 1, 'the draft reuses the loaded writer');
});

test('a download that fails can be tried again', async () => {
  let tries = 0;
  (globalThis as Record<string, unknown>).LanguageModel = {
    async availability() {
      return 'downloadable';
    },
    async create() {
      tries++;
      if (tries === 1) throw Object.assign(new Error('offline'), { name: 'NetworkError' });
      return { prompt: async () => 'Hi', clone: async function () { return this; }, destroy() {} };
    },
  };
  await assert.rejects(prepareLocalWriter());
  assert.equal(localState().phase, 'failed');
  await prepareLocalWriter();
  assert.equal(localState().phase, 'ready');
});
