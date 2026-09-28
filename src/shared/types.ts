/**
 * The API contract shared by the Node API server (server/), the browser clients
 * (src/lib/api/http.ts and the in-browser demo backend src/lib/api/demo.ts), and the UI islands.
 * Change a shape here and TypeScript will point at every place that must follow.
 */

export type SpaceChoice = 'indoor' | 'outdoor' | 'both';

/** YYYY-MM-DD in the venue's local time (America/New_York). */
export type DateKey = string;

/** Public availability for one date. */
export type DayStatus = 'open' | 'partial' | 'booked' | 'past';

export interface AvailabilityDay {
  date: DateKey;
  status: DayStatus;
  /** Per-space state. 'taken' means booked, held, or closed by the team. */
  spaces: { indoor: 'free' | 'taken'; outdoor: 'free' | 'taken' };
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
  servingAlcohol: boolean;
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
  estimate: Estimate;
  /** Demo mode only: true when nothing was sent anywhere. */
  demo?: boolean;
}

export interface ApiError {
  ok: false;
  error: string; // human-readable, safe to show
  fields?: Record<string, string>;
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
