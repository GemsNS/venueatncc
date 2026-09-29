/**
 * Seed data for the in-browser demo backend (demo.ts), built relative to today so the
 * GitHub Pages admin dashboard always looks alive: upcoming weekend bookings and holds,
 * and inquiries in every status, event type, and space.
 *
 * Everyone here is fictional. Emails use example.com and phone numbers use the 555-01xx
 * range reserved for fiction. Estimates come from estimate() in src/shared/pricing.ts,
 * so they follow the rate card whenever it changes.
 *
 * Pure module: nothing runs at import time.
 */
import { eventTypeName } from '../../data/event-types';
import { addDays, dayOfWeek, formatLong, todayKey } from '../../shared/dates';
import { estimate } from '../../shared/pricing';
import { INQUIRY_STATUSES, SPACE_NAMES } from '../../shared/types';
import type {
  BlockKind,
  CalendarBlock,
  DateKey,
  Inquiry,
  InquiryDetail,
  InquiryEvent,
  InquiryNote,
  InquiryStatus,
  SpaceChoice,
} from '../../shared/types';
import { DEMO_ADMIN_NAME } from './demo-credentials';

/**
 * Bumped whenever stored demo data must not survive: version 2 retired an inquiry field, and
 * version 3 renamed an event type to community-events and rewrote the calendar labels, so a
 * browser holding an older copy gets a fresh seed.
 */
export const DEMO_DB_VERSION = 3;

/** Everything the demo backend stores, as one JSON document. */
export interface DemoDb {
  v: typeof DEMO_DB_VERSION;
  /** The venue-local date the seed was built for. */
  seededOn: DateKey;
  nextInquiryId: number;
  nextBlockId: number;
  /** Shared id sequence for notes and timeline events. */
  nextEntryId: number;
  inquiries: InquiryDetail[];
  blocks: CalendarBlock[];
  /** Form tokens that already created an inquiry, so a retried request is not stored twice. */
  formTokenUses?: Record<string, { inquiryId: number; fingerprint: string; usedAt: string }>;
}

export function statusLabel(status: InquiryStatus): string {
  return INQUIRY_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** The event type as a person would say it: the list name, or the host's own words for "other". */
export function eventLabel(eventType: string, eventTypeOther?: string): string {
  if (eventType === 'other') return eventTypeOther?.trim() || 'Other event';
  return eventTypeName(eventType);
}

/** Calendar label for a block created from an inquiry: "<name>: <event type name>". */
export function blockLabelFor(inquiry: Pick<Inquiry, 'name' | 'eventType' | 'eventTypeOther'>): string {
  return `${inquiry.name}: ${eventLabel(inquiry.eventType, inquiry.eventTypeOther)}`;
}

/**
 * Timeline wording, shared by the seed and the live demo backend. Where the API server records
 * the same event, the words match it (server/routes/public.ts inquiryText and
 * server/routes/admin.ts bookingText; server/test/units.test.ts checks they stay equal).
 */
export const timelineText = {
  created: 'Request received through the website.',
  conflict: (date: DateKey, b: Pick<CalendarBlock, 'kind' | 'label' | 'space'>) =>
    `The calendar already shows ${formatLong(date)} as taken for ${SPACE_NAMES[b.space]} (${b.label ? `${b.kind}: ${b.label}` : b.kind}). Check it before you confirm this request.`,
  emailed: (email: string) => `Confirmation email sent to ${email}. The team was notified.`,
  demoEmail: 'Demo mode: no emails were sent.',
  status: (from: InquiryStatus, to: InquiryStatus) => `Status changed from ${statusLabel(from)} to ${statusLabel(to)}.`,
  note: (author: string) => `Note added by ${author}.`,
  blockAdded: (kind: BlockKind, date: DateKey) =>
    kind === 'held'
      ? `Held on the calendar for ${formatLong(date)}.`
      : kind === 'closed'
        ? `Closed on the calendar for ${formatLong(date)}.`
        : `Added to the calendar as booked for ${formatLong(date)}.`,
  /** Marking a request booked: the same words as the API server. */
  booked: {
    holdUpgraded: (date: DateKey) => `The hold on ${formatLong(date)} is now marked booked on the calendar.`,
    added: (date: DateKey, space: SpaceChoice, requested: SpaceChoice) =>
      space === requested
        ? `Added to the calendar as booked for ${formatLong(date)}.`
        : `Added to the calendar as booked for ${formatLong(date)} (${SPACE_NAMES[space]}).`,
    released: (date: DateKey) => `Removed the booked block for ${formatLong(date)} from the calendar, so the date is open again.`,
    clash: (date: DateKey, b: Pick<CalendarBlock, 'kind' | 'label' | 'space'>) =>
      `${formatLong(date)} already has a ${b.kind} block for ${SPACE_NAMES[b.space]}${b.label ? ` (${b.label})` : ''}. Remove or change that block on the calendar, then mark this request booked.`,
  },
  blockRemoved: (date: DateKey) => `Removed from the calendar for ${formatLong(date)}.`,
};

type InquiryFields = Omit<Inquiry, 'id' | 'reference' | 'status' | 'estimateTotal' | 'createdAt' | 'updatedAt'>;

interface Step {
  /** Hours after the inquiry arrived. */
  h: number;
  status?: InquiryStatus;
  note?: string;
  block?: BlockKind;
}

interface SeedInquiry {
  reference: string;
  /** How long ago the inquiry arrived, in hours. */
  ageHours: number;
  fields: InquiryFields;
  steps: Step[];
}

const HOUR = 3600 * 1000;

/** The n-th given weekday strictly after today (n = 1 is the next one). */
function nextWeekday(today: DateKey, dow: number, n: number): DateKey {
  const ahead = (dow - dayOfWeek(today) + 7) % 7 || 7;
  return addDays(today, ahead + 7 * (n - 1));
}

/** Build a fresh demo database relative to `now`. */
export function buildSeed(now: Date = new Date()): DemoDb {
  const today = todayKey(now);
  const sat = (n: number) => nextWeekday(today, 6, n);
  const fri = (n: number) => addDays(sat(n), -1);
  const sun = (n: number) => addDays(sat(n), 1);
  const tue = (n: number) => nextWeekday(today, 2, n);
  const nowMs = now.getTime();
  const latest = nowMs - 10 * 60 * 1000;
  const at = (ms: number) => new Date(Math.min(ms, latest)).toISOString();

  const seeds: SeedInquiry[] = [
    {
      reference: 'NCC-7K3QX',
      ageHours: 3,
      fields: {
        eventType: 'birthday-parties',
        date: sat(3),
        startTime: '18:00',
        hours: 5,
        space: 'indoor',
        guests: 60,
        name: 'Tanya Whitfield',
        email: 'tanya.whitfield@example.com',
        phone: '(757) 555-0142',
        contactPreference: 'text',
        message: 'Planning a surprise 40th birthday for my husband. Most of the guests are family from Chesapeake and Norfolk.',
        wantsVisit: true,
        visitNotes: 'Weekday evenings after 5:30 work best.',
      },
      steps: [],
    },
    {
      reference: 'NCC-M4TRB',
      ageHours: 29,
      fields: {
        eventType: 'baby-bridal-showers',
        date: sun(2),
        startTime: '14:00',
        hours: 3,
        space: 'indoor',
        guests: 35,
        name: 'Keisha Barnes',
        email: 'keisha.barnes@example.com',
        contactPreference: 'email',
        message: 'Baby shower for my sister. An afternoon start works best since a lot of our guests are coming from out of town.',
        wantsVisit: false,
      },
      steps: [],
    },
    {
      reference: 'NCC-T9VPC',
      ageHours: 50,
      fields: {
        eventType: 'birthday-parties',
        date: sat(5),
        startTime: '16:00',
        hours: 5,
        space: 'outdoor',
        guests: 75,
        name: 'Marcus Ellison',
        email: 'marcus.ellison@example.com',
        phone: '(757) 555-0184',
        contactPreference: 'text',
        message: 'Sweet 16 for my daughter. She wants the whole party outside if the weather cooperates.',
        wantsVisit: false,
      },
      steps: [
        { h: 3, status: 'contacted', note: 'Texted Marcus. He is choosing between two Saturdays and will call back this week.' },
      ],
    },
    {
      reference: 'NCC-9WHDE',
      ageHours: 5 * 24 + 2,
      fields: {
        eventType: 'weddings',
        date: sat(8),
        altDate: sat(9),
        startTime: '15:00',
        hours: 8,
        space: 'both',
        guests: 140,
        name: 'Danielle Greene',
        email: 'danielle.greene@example.com',
        phone: '(757) 555-0118',
        contactPreference: 'phone',
        message: 'We would love the ceremony at the gazebo in The Grove, then the reception in The Hall.',
        wantsVisit: true,
        visitNotes: 'Saturday mornings are easiest for us.',
      },
      steps: [
        {
          h: 20,
          status: 'contacted',
          note: 'Called Danielle. She wants to see The Grove before deciding and asked about time to set up the day before.',
        },
      ],
    },
    {
      reference: 'NCC-P2LCV',
      ageHours: 9 * 24 + 4,
      fields: {
        eventType: 'graduations-reunions',
        date: sat(6),
        startTime: '12:00',
        hours: 6,
        space: 'outdoor',
        guests: 120,
        name: 'Robert Langley',
        email: 'r.langley@example.com',
        phone: '(757) 555-0167',
        contactPreference: 'phone',
        message: 'Langley family reunion. Relatives are driving in from three states, so parking matters to us.',
        wantsVisit: true,
        visitNotes: 'Any weekday after 5 PM.',
      },
      steps: [
        { h: 22, status: 'contacted', note: 'Reached Robert by phone. Confirmed parking is included with the rental.' },
        { h: 70, status: 'visit', block: 'held', note: 'Walkthrough scheduled for a weekday evening. Holding the date while the family decides.' },
      ],
    },
    {
      reference: 'NCC-X8NFA',
      ageHours: 12 * 24 + 6,
      fields: {
        eventType: 'receptions-banquets',
        date: fri(4),
        altDate: sat(4),
        startTime: '18:00',
        hours: 5,
        space: 'indoor',
        guests: 90,
        name: 'Gloria Patterson',
        email: 'gloria.patterson@example.com',
        phone: '(757) 555-0190',
        contactPreference: 'email',
        message: 'Our parents are celebrating their 50th wedding anniversary with a seated family dinner.',
        wantsVisit: false,
      },
      steps: [
        { h: 4, status: 'contacted', note: 'Spoke with Gloria. She would like two hours before the dinner to set up and decorate.' },
        { h: 50, status: 'quoted', block: 'held', note: 'Sent the estimate by email. She is checking the date with her siblings.' },
      ],
    },
    {
      reference: 'NCC-R5GJY',
      ageHours: 6 * 24 + 3,
      fields: {
        eventType: 'repasts-memorials',
        date: sat(1),
        startTime: '13:00',
        hours: 4,
        space: 'indoor',
        guests: 80,
        name: 'Denise Holloway',
        email: 'denise.holloway@example.com',
        phone: '(757) 555-0135',
        contactPreference: 'phone',
        message: 'Repast for my father after the funeral service. Family will arrive from the cemetery around 1 PM.',
        wantsVisit: false,
      },
      steps: [
        { h: 1, status: 'contacted', note: 'Called Denise with our condolences and walked her through the estimate.' },
        { h: 20, status: 'quoted' },
        { h: 26, status: 'booked', block: 'booked', note: 'Payment received. Arrival time confirmed with the family.' },
      ],
    },
    {
      reference: 'NCC-B6ZKT',
      ageHours: 20 * 24 + 5,
      fields: {
        eventType: 'community-events',
        date: sat(2),
        startTime: '11:00',
        hours: 6,
        space: 'outdoor',
        guests: 130,
        name: 'Anthony Brooks',
        email: 'anthony.brooks@example.com',
        phone: '(757) 555-0173',
        contactPreference: 'email',
        message: 'Our neighborhood association is planning its fall gathering and has outgrown the park shelter we usually use.',
        wantsVisit: true,
        visitNotes: 'Saturday late morning.',
      },
      steps: [
        { h: 26, status: 'contacted' },
        { h: 75, status: 'visit', note: 'Toured The Grove with Anthony and two board members.' },
        { h: 122, status: 'quoted' },
        { h: 170, status: 'booked', block: 'booked', note: 'Payment received. Guest count confirmed.' },
      ],
    },
    {
      reference: 'NCC-H3SUE',
      ageHours: 15 * 24 + 7,
      fields: {
        eventType: 'meetings-trainings',
        date: tue(2),
        startTime: '09:00',
        hours: 6,
        space: 'indoor',
        guests: 25,
        name: 'Priya Raman',
        email: 'priya.raman@example.com',
        phone: '(757) 555-0126',
        contactPreference: 'email',
        message: 'Full-day training for our regional sales team.',
        wantsVisit: false,
      },
      steps: [
        { h: 6, status: 'contacted' },
        { h: 54, status: 'declined', note: 'Priya chose a space closer to the interstate. Invited her to reach out for future trainings.' },
      ],
    },
    {
      reference: 'NCC-D7QMW',
      ageHours: 45 * 24 + 2,
      fields: {
        eventType: 'other',
        eventTypeOther: 'Fundraiser dinner',
        date: addDays(sat(1), -21),
        startTime: '17:00',
        hours: 5,
        space: 'both',
        guests: 110,
        name: 'Carla Jennings',
        email: 'carla.jennings@example.com',
        phone: '(757) 555-0151',
        contactPreference: 'phone',
        message: 'Silent auction and dinner to raise money for our youth sports league.',
        wantsVisit: false,
      },
      steps: [
        { h: 30, status: 'contacted' },
        { h: 80, status: 'quoted' },
        { h: 200, status: 'archived', note: 'Carla postponed the fundraiser to next year. Archived for now.' },
      ],
    },
  ];

  let nextEntryId = 1;
  let nextBlockId = 1;
  const inquiries: InquiryDetail[] = [];
  const blocks: CalendarBlock[] = [];

  seeds.forEach((seed, index) => {
    const id = index + 1;
    const created = nowMs - seed.ageHours * HOUR;
    const createdAt = at(created);
    const est = estimate(
      { date: seed.fields.date, space: seed.fields.space, hours: seed.fields.hours, eventType: seed.fields.eventType },
      undefined,
      today,
    );
    const notes: InquiryNote[] = [];
    const events: InquiryEvent[] = [
      { id: nextEntryId++, kind: 'created', detail: timelineText.created, createdAt },
      { id: nextEntryId++, kind: 'email', detail: timelineText.emailed(seed.fields.email), createdAt: at(created + 60 * 1000) },
    ];
    let status: InquiryStatus = 'new';
    let updatedAt = createdAt;

    for (const step of seed.steps) {
      const when = at(created + step.h * HOUR);
      if (step.status && step.status !== status) {
        events.push({ id: nextEntryId++, kind: 'status', detail: timelineText.status(status, step.status), createdAt: when });
        status = step.status;
      }
      if (step.block) {
        blocks.push({
          id: nextBlockId++,
          date: seed.fields.date,
          space: seed.fields.space,
          kind: step.block,
          label: blockLabelFor(seed.fields),
          inquiryId: id,
          createdAt: when,
        });
        events.push({ id: nextEntryId++, kind: 'block', detail: timelineText.blockAdded(step.block, seed.fields.date), createdAt: when });
      }
      if (step.note) {
        notes.push({ id: nextEntryId++, body: step.note, author: DEMO_ADMIN_NAME, createdAt: when });
        events.push({ id: nextEntryId++, kind: 'note', detail: timelineText.note(DEMO_ADMIN_NAME), createdAt: when });
      }
      updatedAt = when;
    }

    inquiries.push({
      ...seed.fields,
      id,
      reference: seed.reference,
      status,
      estimateTotal: est.total,
      createdAt,
      updatedAt,
      estimate: est,
      notes,
      events,
    });
  });

  // Dates the team took off the calendar directly, without a web inquiry.
  blocks.push(
    {
      id: nextBlockId++,
      date: sun(3),
      space: 'both',
      kind: 'booked',
      label: 'Private family day',
      inquiryId: null,
      createdAt: at(nowMs - 30 * 24 * HOUR),
    },
    {
      id: nextBlockId++,
      date: sat(7),
      space: 'both',
      kind: 'booked',
      label: 'Private event (booked by phone)',
      inquiryId: null,
      createdAt: at(nowMs - 4 * 24 * HOUR),
    },
  );
  blocks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

  return {
    v: DEMO_DB_VERSION,
    seededOn: today,
    nextInquiryId: inquiries.length + 1,
    nextBlockId,
    nextEntryId,
    inquiries,
    blocks,
  };
}
