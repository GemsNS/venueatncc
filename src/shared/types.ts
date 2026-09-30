/**
 * The API contract shared by the Node API server (server/), the browser clients
 * (src/lib/api/http.ts and the in-browser demo backend src/lib/api/demo.ts), and the UI islands.
 * Change a shape here and TypeScript will point at every place that must follow.
 */

/**
 * The bookable spaces: three single spaces, plus one combined choice.
 *   indoor  The Hall (indoor, up to 100 guests)
 *   main    The Main Hall (the indoor auditorium with stage seating, up to 100 guests)
 *   outdoor The Grove (outdoor, up to 150 guests)
 *   both    The Hall and The Grove together (the slug predates The Main Hall and is kept)
 * The Main Hall is booked on its own; it is not part of 'both'.
 */
export type SpaceChoice = 'indoor' | 'main' | 'outdoor' | 'both';

/** A single space: one room or area on the calendar. */
export type SingleSpace = 'indoor' | 'main' | 'outdoor';

/** The single spaces in the order the site lists them. */
export const SINGLE_SPACE_IDS: SingleSpace[] = ['indoor', 'main', 'outdoor'];

/** Every space choice in the order the booking forms offer them. */
export const SPACE_CHOICES = ['indoor', 'main', 'outdoor', 'both'] as const satisfies readonly SpaceChoice[];

export const isSpaceChoice = (v: unknown): v is SpaceChoice => typeof v === 'string' && (SPACE_CHOICES as readonly string[]).includes(v);

/**
 * The public names of the spaces (docs/design/brand.md). The data slugs stay indoor, outdoor,
 * and both; The Main Hall is main. Every label the booking app, the admin, the emails, and the
 * CSV export show for a space comes from here, so the names read the same everywhere.
 */
export const SPACE_NAMES: Record<SpaceChoice, string> = {
  indoor: 'The Hall',
  main: 'The Main Hall',
  outdoor: 'The Grove',
  both: 'The Hall and The Grove',
};

/** The single spaces a choice occupies: 'both' is The Hall and The Grove. */
export function spaceParts(space: SpaceChoice): SingleSpace[] {
  return space === 'both' ? ['indoor', 'outdoor'] : [space];
}

/**
 * The choice that occupies exactly these single spaces, or null when none does (The Main Hall with
 * another space is not one choice; the admin books those as separate blocks).
 */
export function spaceFromParts(parts: SingleSpace[]): SpaceChoice | null {
  const set = new Set(parts);
  if (set.size === 1) return [...set][0];
  if (set.size === 2 && set.has('indoor') && set.has('outdoor')) return 'both';
  return null;
}

/** Whether two space choices share any ground. */
export function spacesOverlap(a: SpaceChoice, b: SpaceChoice): boolean {
  const pb = spaceParts(b);
  return spaceParts(a).some((p) => pb.includes(p));
}

/** YYYY-MM-DD in the venue's local time (America/New_York). */
export type DateKey = string;

/** Public availability for one date. */
/** 'closed': the building is not open for events that day (Sundays; see src/shared/booking-rules.ts). */
export type DayStatus = 'open' | 'partial' | 'booked' | 'past' | 'closed';

export interface AvailabilityDay {
  date: DateKey;
  status: DayStatus;
  /** Per-space state. 'taken' means booked, held, or closed by the team. */
  spaces: Record<SingleSpace, 'free' | 'taken'>;
}

export interface AvailabilityResponse {
  from: DateKey;
  to: DateKey;
  days: AvailabilityDay[];
}

export type InquiryStatus = 'new' | 'contacted' | 'visit' | 'quoted' | 'booked' | 'declined' | 'archived';

export const INQUIRY_STATUSES: { id: InquiryStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'visit', label: 'Visit scheduled' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'booked', label: 'Booked' },
  { id: 'declined', label: 'Declined' },
  { id: 'archived', label: 'Archived' },
];

export type ContactPreference = 'email' | 'phone' | 'text';

/** What the public booking wizard submits. Validated by inquiryInputSchema in schemas.ts. */
export interface InquiryInput {
  eventType: string; // an event slug from src/data/events.ts, or 'other'
  eventTypeOther?: string;
  date: DateKey;
  altDate?: DateKey;
  startTime: string; // HH:MM, 24h
  hours: number; // total rental hours including setup and cleanup
  space: SpaceChoice;
  guests: number;
  name: string;
  email: string;
  phone?: string;
  contactPreference: ContactPreference;
  message?: string;
  wantsVisit: boolean;
  visitNotes?: string;
  /** Anti-spam: a signed token from GET /api/form-token, and a honeypot that must stay empty. */
  formToken: string;
  website?: string;
}

export interface EstimateLine {
  label: string;
  amount: number; // whole dollars
  kind: 'rental' | 'fee' | 'discount' | 'deposit';
}

export interface Estimate {
  currency: 'USD';
  dayType: 'weekday' | 'friday' | 'saturday' | 'sunday';
  dayTypeLabel: string;
  space: SpaceChoice;
  hours: number;
  billableHours: number;
  /** Rental plus fees minus discounts. Excludes the refundable damage deposit. */
  total: number;
  /** Amount due to reserve the date. */
  bookingDeposit: number;
  /** Refundable damage deposit, returned after the event. */
  refundableDeposit: number;
  lines: EstimateLine[];
  notes: string[];
  packageName?: string;
}

export interface InquiryCreated {
  ok: true;
  reference: string;
  /** Demo mode only: true when nothing was sent anywhere. */
  demo?: boolean;
}

export interface ApiError {
  ok: false;
  error: string; // human-readable, safe to show
  fields?: Record<string, string>;
  /** HTTP status when the server answered (the browser client sets it). */
  status?: number;
  /** True when the request never got an answer (offline, DNS, server down). */
  network?: boolean;
}

export interface InquiryNote {
  id: number;
  body: string;
  author: string;
  createdAt: string; // ISO
}

export interface InquiryEvent {
  id: number;
  kind: 'created' | 'status' | 'note' | 'email' | 'block';
  detail: string;
  createdAt: string;
}

export interface Inquiry extends Omit<InquiryInput, 'formToken' | 'website'> {
  id: number;
  reference: string;
  status: InquiryStatus;
  estimateTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryDetail extends Inquiry {
  estimate: Estimate;
  notes: InquiryNote[];
  events: InquiryEvent[];
  /** Calendar blocks linked to this request (optional so older payloads still type-check). */
  blocks?: CalendarBlock[];
}

export type BlockKind = 'booked' | 'held' | 'closed';

/** A date the team has taken off the public calendar. */
export interface CalendarBlock {
  id: number;
  date: DateKey;
  space: SpaceChoice;
  kind: BlockKind;
  label: string;
  inquiryId: number | null;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
}

export interface AdminStats {
  byStatus: Record<InquiryStatus, number>;
  newThisWeek: number;
  upcomingBooked: { date: DateKey; label: string; space: SpaceChoice }[];
  pipelineValue: number; // sum of estimates for new/contacted/visit/quoted
  bookedValue: number; // sum of estimates for booked
}

export interface InquiryListQuery {
  status?: InquiryStatus | 'open' | 'all';
  q?: string;
}
