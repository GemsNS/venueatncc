/**
 * The client-side API surface used by every island. Two implementations:
 *   http.ts  talks to the venue's API server (production)
 *   demo.ts  an in-browser backend on localStorage (GitHub Pages demo)
 * Both must behave the same way; both reuse src/shared for validation, availability, and pricing.
 */
import type {
  AdminStats,
  AdminUser,
  ApiError,
  AvailabilityResponse,
  CalendarBlock,
  DateKey,
  Inquiry,
  InquiryCreated,
  InquiryDetail,
  InquiryInput,
  InquiryListQuery,
  InquiryStatus,
  MailBox,
  MailCompose,
  MailStatus,
  MailThread,
  MailThreadList,
  SpaceChoice,
  BlockKind,
} from '../../shared/types';
import type { DraftInput, DraftMode, DraftResult } from '../../shared/draft';

/** A reply draft: for a thread, a request, or (with instructions) a new email. */
export interface MailDraftRequest {
  mode: DraftMode;
  threadId?: number;
  inquiryId?: number;
  /** What is in the reply box (rewritten in rewrite mode). */
  text?: string;
  /** What the email should say, in a few words. */
  instructions?: string;
}

export type Result<T> = T | ApiError;

export function isError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && (value as ApiError).ok === false;
}

export interface BlockInput {
  date: DateKey;
  space: SpaceChoice;
  kind: BlockKind;
  label: string;
  inquiryId?: number | null;
}

export interface VenueApi {
  /** True for the in-browser demo backend. */
  readonly demo: boolean;

  availability(from: DateKey, to: DateKey): Promise<Result<AvailabilityResponse>>;
  /** A signed token the inquiry must carry (anti-spam minimum fill time). */
  formToken(): Promise<Result<{ token: string }>>;
  submitInquiry(input: InquiryInput): Promise<Result<InquiryCreated>>;

  admin: {
    session(): Promise<AdminUser | null>;
    login(email: string, password: string): Promise<Result<AdminUser>>;
    logout(): Promise<void>;
    stats(): Promise<Result<AdminStats>>;
    listInquiries(query: InquiryListQuery): Promise<Result<Inquiry[]>>;
    getInquiry(id: number): Promise<Result<InquiryDetail>>;
    setStatus(id: number, status: InquiryStatus): Promise<Result<InquiryDetail>>;
    addNote(id: number, body: string): Promise<Result<InquiryDetail>>;
    listBlocks(from: DateKey, to: DateKey): Promise<Result<CalendarBlock[]>>;
    createBlock(input: BlockInput): Promise<Result<CalendarBlock>>;
    deleteBlock(id: number): Promise<Result<{ ok: true }>>;
    exportCsv(): Promise<Result<Blob>>;
    changePassword(current: string, next: string): Promise<Result<{ ok: true }>>;
    mail: {
      threads(box: MailBox, q?: string): Promise<Result<MailThreadList>>;
      /** Opens a thread, which marks it read. */
      thread(id: number): Promise<Result<MailThread>>;
      update(id: number, change: { archived?: boolean; read?: boolean }): Promise<Result<MailThread>>;
      reply(id: number, body: string): Promise<Result<MailThread>>;
      send(input: MailCompose): Promise<Result<MailThread>>;
      /** Email a request's guest; a New request becomes Contacted. */
      emailInquiry(id: number, body: string): Promise<Result<InquiryDetail>>;
      /** Check the mailbox now. */
      sync(): Promise<Result<MailStatus>>;
      /** Write a reply draft on the server: Claude, or the template (nothing is sent). */
      draft(input: MailDraftRequest): Promise<Result<DraftResult>>;
      /** What a draft is written from, for the writer built into the admin's browser. */
      draftInput(input: MailDraftRequest): Promise<Result<DraftInput>>;
      /** A link that downloads an attachment, or null where there is none (the demo). */
      attachmentUrl(id: number): string | null;
    };
  };
}
