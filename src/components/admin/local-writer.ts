/**
 * The free writer: Chrome's built-in model (Gemini Nano, through the Prompt API), which runs on the admin's
 * own computer. Nothing it reads leaves the computer, and it costs nothing. Chrome on a desktop or laptop
 * with enough memory has it (Windows, macOS, Linux, Chromebook Plus); phones and other browsers do not,
 * and there the template and Tidy do the work (src/shared/draft.ts).
 *
 * The first use downloads the model once (Chrome manages it). Every draft starts from a session that has
 * read the venue's facts and rules, so only the request and the thread are read again.
 */
import { draftSystemPrompt, draftUserPrompt, type DraftInput, type PromptLimits } from '../../shared/draft';

export type LocalAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface LmSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
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

const api = (): LanguageModelApi | null => (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel ?? null;

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
let onProgress: ((fraction: number) => void) | null = null;

/**
 * Start the writer: call it straight from the click, because Chrome downloads the model only after a
 * click. Later calls reuse the same session.
 */
export function prepareLocalWriter(progress?: (fraction: number) => void): Promise<LmSession> {
  onProgress = progress ?? null;
  const lm = api();
  if (!lm) return Promise.reject(new Error('unavailable'));
  base ??= lm
    .create({
      ...OPTIONS,
      initialPrompts: [{ role: 'system', content: draftSystemPrompt() }],
      monitor(m: LmMonitor) {
        m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded));
      },
    })
    .then((s) => {
      checked = Promise.resolve('available');
      return s;
    })
    .catch((err: unknown) => {
      base = null;
      throw err;
    });
  return base;
}

/** Words for the admin when the writer fails. */
export function localWriterError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError') return 'Chrome did not allow its built-in writer here. Press Draft again, or use the template.';
  if (name === 'QuotaExceededError') return 'This thread is too long for the built-in writer. Write the reply yourself, then press Tidy.';
  if (name === 'NetworkError') return "Chrome could not download its writer. Check the computer's connection and try again.";
  return "The computer's built-in writer could not draft this. Try again, or write it yourself.";
}

/** Write a draft or a rewrite on this computer. Returns the raw text; finishDraft cleans and checks it. */
export async function localWrite(input: DraftInput, progress?: (fraction: number) => void): Promise<string> {
  const root = await prepareLocalWriter(progress);
  let lastError: unknown = null;
  for (const limits of LOCAL_LIMITS) {
    const session = await root.clone();
    try {
      const text = (await session.prompt(draftUserPrompt(input, limits))).trim();
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

/** Tests: forget the session and the check. */
export function resetLocalWriter(): void {
  base = null;
  checked = null;
  onProgress = null;
}
