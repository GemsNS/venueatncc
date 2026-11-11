/**
 * Reply drafts on the server: Claude writes a reply from the request and the emails so far, or rewrites
 * what the admin typed (optional, ANTHROPIC_API_KEY). Without a key, the server only drafts from the
 * template; the admin's browser writes and rewrites for free with Chrome's built-in model where the computer
 * has it (src/components/admin/local-writer.ts), and Tidy cleans up typed text everywhere.
 *
 * A draft only fills the reply box; nothing is sent until the admin presses Send. The guest's words go to
 * Claude marked as the guest's, never as instructions. Prompts and drafts are not logged.
 */
import Anthropic from '@anthropic-ai/sdk';
import { draftSystemPrompt, draftUserPrompt, finishDraft, templateDraft, type DraftInput, type DraftResult } from '../../src/shared/draft';
import { DEFAULT_DRAFT_MODEL } from '../config';

export { DEFAULT_DRAFT_MODEL, draftSystemPrompt, draftUserPrompt };

/** What the drafter needs from the SDK client; tests pass a fake. */
export interface DraftClient {
  beta: { messages: { create(params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming): PromiseLike<Anthropic.Beta.Messages.BetaMessage> } };
}

export interface Drafter {
  /** 'claude' when an API key is set; 'basic' is the template, which cannot rewrite. */
  readonly kind: 'claude' | 'basic';
  write(input: DraftInput): Promise<DraftResult>;
}

/** A failure the admin can read; the route returns it as the error. */
export class DraftError extends Error {}

/** Map an SDK failure to words the admin can act on. */
function explain(err: unknown): DraftError {
  if (err instanceof DraftError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new DraftError('Claude did not accept the API key (ANTHROPIC_API_KEY on the server).');
  }
  if (err instanceof Anthropic.RateLimitError) return new DraftError('Claude is busy with too many drafts right now. Try again in a minute.');
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new DraftError('Claude took too long to answer. Try again.');
  if (err instanceof Anthropic.APIConnectionError) return new DraftError('The server could not reach Claude. Try again in a moment.');
  if (err instanceof Anthropic.BadRequestError) return new DraftError(`Claude could not take this request: ${err.message.slice(0, 160)}`);
  if (err instanceof Anthropic.APIError) return new DraftError(`Claude had a problem (${err.status ?? 'no status'}). Try again in a moment.`);
  return new DraftError('Something went wrong while drafting. Try again.');
}

export function createDrafter(opts: {
  apiKey: string | null;
  model?: string;
  /** Tests pass a fake client. */
  client?: DraftClient;
}): Drafter {
  const model = opts.model || DEFAULT_DRAFT_MODEL;
  if (!opts.apiKey && !opts.client) {
    return {
      kind: 'basic',
      async write(input) {
        if (input.mode === 'rewrite') throw new DraftError('Rewriting needs Claude, which is not set up (ANTHROPIC_API_KEY on the server).');
        return finishDraft(templateDraft(input), input, 'basic');
      },
    };
  }
  let client: DraftClient | undefined = opts.client;
  const system = draftSystemPrompt();
  return {
    kind: 'claude',
    async write(input) {
      // One try within 55 seconds, so the answer comes back before the web server's proxy gives up.
      client ??= new Anthropic({ apiKey: opts.apiKey!, timeout: 55_000, maxRetries: 0 });
      let res: Anthropic.Beta.Messages.BetaMessage;
      try {
        res = await client.beta.messages.create({
          model,
          max_tokens: 8000,
          output_config: { effort: 'medium' },
          // If a safety check declines, the API retries on a fallback model in the same call.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system,
          messages: [{ role: 'user', content: draftUserPrompt(input) }],
        });
      } catch (err) {
        throw explain(err);
      }
      if (res.stop_reason === 'refusal') throw new DraftError('Claude would not draft this one. Write it yourself, or change the instructions.');
      const text = res.content
        .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (!text) throw new DraftError('Claude returned an empty draft. Try again.');
      if (res.stop_reason === 'max_tokens') throw new DraftError('The draft came out too long. Try again with shorter instructions.');
      return finishDraft(text, input, 'claude');
    },
  };
}
