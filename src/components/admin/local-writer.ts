/**
 * The free writer: Chrome's built-in model (Gemini Nano, through the Prompt API), which runs on the admin's
 * own computer. Nothing it reads leaves the computer, and it costs nothing. Chrome on a desktop or laptop
 * with enough memory has it (Windows, macOS, Linux, Chromebook Plus); phones and other browsers do not,
 * and there the template and Tidy do the work (src/shared/draft.ts).
 *
 * Nobody waits for it:
 *   - The first Draft starts Chrome's one-time download of the model (a few GB, managed by Chrome). Until
 *     it is on the computer, the admin drafts with the template and Tidy, and the progress shows.
 *   - Once the model is on the computer, it is loaded as soon as the admin opens (warmLocalWriter), so a
 *     draft does not wait for it to load.
 *   - The draft is written into the box as the model writes it (localWrite's onText).
 *
 * Every draft starts from a session that has read the venue's facts and rules, so only the request and the
 * thread are read again.
 */
import { draftSystemPrompt, draftUserPrompt, type DraftInput, type PromptLimits } from '../../shared/draft';

export type LocalAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface LmSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming?(input: string, options?: { signal?: AbortSignal }): ReadableStream<string>;
  clone(options?: { signal?: AbortSignal }): Promise<LmSession>;
  destroy(): void;
}

interface LmMonitor {
  addEventListener(type: 'downloadprogress', listener: (e: { loaded: number }) => void): void;
}

interface LanguageModelApi {
  availability(options?: object): Promise<string>;
  create(options?: object): Promise<LmSession>;
}

const OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

/** A small model reads less of the thread; the second try reads less again. */
export const LOCAL_LIMITS: PromptLimits[] = [
  { maxEmails: 4, maxEmailChars: 1500 },
  { maxEmails: 1, maxEmailChars: 700 },
];

/** A draft gives up (and the template takes over) when the model writes nothing for this long. */
export const LOCAL_STALL_MS = 45_000;

const api = (): LanguageModelApi | null => (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel ?? null;

/** Where the writer is: not started, downloading or loading (with the download's fraction), ready, or failed. */
export interface LocalState {
  phase: 'idle' | 'loading' | 'ready' | 'failed';
  /** The download's fraction, 0 to 1, while loading. */
  progress: number;
}

let state: LocalState = { phase: 'idle', progress: 0 };
const listeners = new Set<(s: LocalState) => void>();
const setState = (next: LocalState) => {
  state = next;
  for (const l of listeners) l(state);
};

export const localState = (): LocalState => state;

/** Be told when the writer's state changes; returns the unsubscribe. */
export function onLocalState(listener: (s: LocalState) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

let checked: Promise<LocalAvailability> | null = null;

/** Whether this browser can write drafts on this computer. */
export function localAvailability(refresh = false): Promise<LocalAvailability> {
  if (checked && !refresh) return checked;
  checked = (async () => {
    const lm = api();
    if (!lm) return 'unavailable';
    try {
      const a = await lm.availability(OPTIONS);
      return a === 'available' || a === 'downloadable' || a === 'downloading' ? a : 'unavailable';
    } catch {
      return 'unavailable';
    }
  })();
  return checked;
}

let base: Promise<LmSession> | null = null;

/**
 * Start the writer. When the model still has to be downloaded, call it from a click: Chrome downloads it
 * only after one. Later calls reuse the same session (or the download already under way).
 */
export function prepareLocalWriter(): Promise<LmSession> {
  const lm = api();
  if (!lm) return Promise.reject(new Error('unavailable'));
  if (base) return base;
  setState({ phase: 'loading', progress: 0 });
  base = lm
    .create({
      ...OPTIONS,
      initialPrompts: [{ role: 'system', content: draftSystemPrompt() }],
      monitor(m: LmMonitor) {
        m.addEventListener('downloadprogress', (e) => setState({ phase: 'loading', progress: e.loaded }));
      },
    })
    .then((s) => {
      checked = Promise.resolve('available');
      setState({ phase: 'ready', progress: 1 });
      return s;
    })
    .catch((err: unknown) => {
      base = null;
      setState({ phase: 'failed', progress: 0 });
      throw err;
    });
  return base;
}

/**
 * When the model is already on this computer, load it now (no click needed), so the first draft does not
 * wait for it. Does nothing when it would have to be downloaded.
 */
export async function warmLocalWriter(): Promise<void> {
  if (base || (await localAvailability()) !== 'available') return;
  await prepareLocalWriter().catch(() => undefined);
}

/** Words for the admin when the writer fails. */
export function localWriterError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError') return 'Chrome did not allow its built-in writer here. Press Draft again, or use the template.';
  if (name === 'QuotaExceededError') return 'This thread is too long for the built-in writer. Write the reply yourself, then press Tidy.';
  if (name === 'NetworkError') return "Chrome could not download its writer. Check the computer's connection and try again.";
  if (name === 'TimeoutError') return 'The built-in writer was too slow this time.';
  return "The computer's built-in writer could not draft this. Try again, or write it yourself.";
}

/** An answer that does not come within ms is given up (TimeoutError). */
async function withTimeout<T>(work: Promise<T>, controller: AbortController, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error('too slow'), { name: 'TimeoutError' }));
    }, ms);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** Read a streamed answer, telling onText the text so far, and give up when nothing comes for stallMs. */
async function readStream(stream: ReadableStream<string>, controller: AbortController, stallMs: number, onText?: (text: string) => void): Promise<string> {
  const reader = stream.getReader();
  let text = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectStall: (err: Error) => void = () => undefined;
  const stall = new Promise<never>((_, reject) => {
    rejectStall = reject;
  });
  stall.catch(() => undefined);
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort();
      rejectStall(Object.assign(new Error('stalled'), { name: 'TimeoutError' }));
    }, stallMs);
  };
  arm();
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), stall]);
      if (done) break;
      arm();
      // Chrome sends each new piece; an older Chrome sent the whole text so far each time.
      text = value.startsWith(text) && text ? value : text + value;
      onText?.(text);
    }
    return text;
  } finally {
    clearTimeout(timer);
    try {
      reader.releaseLock();
    } catch {
      // Already released.
    }
  }
}

/**
 * Write a draft or a rewrite on this computer. Returns the raw text; finishDraft cleans and checks it.
 * onText gets the text so far while the model writes.
 */
export async function localWrite(input: DraftInput, onText?: (text: string) => void, stallMs = LOCAL_STALL_MS): Promise<string> {
  const root = await prepareLocalWriter();
  let lastError: unknown = null;
  for (const limits of LOCAL_LIMITS) {
    const session = await root.clone();
    const controller = new AbortController();
    try {
      const prompt = draftUserPrompt(input, limits);
      const raw = session.promptStreaming
        ? await readStream(session.promptStreaming(prompt, { signal: controller.signal }), controller, stallMs, onText)
        : await withTimeout(session.prompt(prompt, { signal: controller.signal }), controller, stallMs * 2);
      const text = raw.trim();
      if (text) return text;
      lastError = new Error('empty');
    } catch (err) {
      lastError = err;
      // A thread too long for the model: try again with less of it.
      if ((err as { name?: string } | null)?.name !== 'QuotaExceededError') throw err;
    } finally {
      session.destroy();
    }
  }
  throw lastError;
}

/** Tests: forget the session, the state, and the check. */
export function resetLocalWriter(): void {
  base = null;
  checked = null;
  state = { phase: 'idle', progress: 0 };
  listeners.clear();
}
