/**
 * Frequently asked questions.
 *
 * Only questions with an answer are published (on /faq/, in llms.txt, and as FAQPage structured data).
 * Questions with `a: null` are a to-do list for the venue team.
 */
import { site, fullAddress } from './site';
import { pricing, priceSummary, formatUSD } from '../shared/pricing';

export interface Faq {
  q: string;
  a: string | null;
  /** Groups questions on the FAQ page. */
  topic: 'booking' | 'space' | 'food' | 'pricing' | 'about';
}

const phone = site.contact.phone;
const { fromHourly } = priceSummary();
const indoor = site.spaces.find((s) => s.id === 'indoor');
const outdoor = site.spaces.find((s) => s.id === 'outdoor');
const deposit =
  pricing.bookingDeposit.type === 'percent'
    ? `The booking deposit is ${pricing.bookingDeposit.value}% of your total`
    : `The booking deposit is ${formatUSD(pricing.bookingDeposit.value)}`;
const balanceDays = pricing.bookingDeposit.balanceDueDaysBefore;
const payment =
  balanceDays > 0
    ? `${deposit}, and the balance is due ${balanceDays} days before your event. For an event within ${balanceDays} days, the full amount is due when you reserve.`
    : `${deposit}.`;

export const faqs: Faq[] = [
  {
    topic: 'booking',
    q: 'How do I check if my date is available?',
    a: `Open the availability calendar on our booking page. It shows which dates and spaces are open, gives you an instant estimate, and lets you send a request in about two minutes. You can also call ${phone}. We confirm every booking personally.`,
  },
  {
    topic: 'booking',
    q: 'Do I need to be a member of New Community Church to book?',
    a: 'No. Anyone can book The Venue at NCC.',
  },
  {
    topic: 'space',
    q: 'How many guests can the venue hold?',
    a: `The indoor hall holds up to ${indoor?.capacity} guests. The outdoor space holds up to ${outdoor?.capacity} guests.`,
  },
  {
    topic: 'space',
    q: 'Can I use both the indoor hall and the outdoor space?',
    a: 'Yes, you can request both spaces for the same event when you book. We confirm availability for both when we follow up.',
  },
  {
    topic: 'food',
    q: 'Is alcohol allowed?',
    a: "Yes. You can serve alcohol at your event. Virginia ABC may require a banquet license, so check its rules early, and we will talk through the details with you when you book.",
  },
  {
    topic: 'food',
    q: 'Is catering included?',
    a: 'No. Catering is not included, so you are free to choose your own caterer or bring your own food.',
  },
  {
    topic: 'space',
    q: 'Is parking included?',
    a: 'Yes. On-site parking is included with every booking.',
  },
  {
    topic: 'pricing',
    q: 'What is included in the rental?',
    a: 'Your rental includes the space you book and on-site parking. Catering is not included.',
  },
  {
    topic: 'pricing',
    q: 'How much does it cost to rent the venue?',
    a: `Rates start at ${formatUSD(fromHourly)} per hour and depend on the day, the space, and how long you need it. The pricing page has the full rate card and an instant estimate for your date.`,
  },
  {
    topic: 'pricing',
    q: 'How do deposits and payment work?',
    a: `Send your request, we confirm availability, then your booking deposit reserves the date. ${payment} A refundable damage deposit of ${formatUSD(pricing.fees.damageDepositRefundable)} is returned after the event if there is no damage.`,
  },
  {
    topic: 'booking',
    q: 'Can I see the space before I book?',
    a: `Yes. Ask for a visit when you send your request, or call ${phone}, and we will find a time that works.`,
  },
  {
    topic: 'about',
    q: 'Where is The Venue at NCC?',
    a: `The Venue at NCC is at New Community Church, ${fullAddress}.`,
  },
  {
    topic: 'about',
    q: 'What kinds of events can I host?',
    a: 'Weddings and receptions, banquets and anniversaries, baby and bridal showers, birthdays and milestone parties, repasts and celebrations of life, meetings and workshops, graduations and reunions, and church and community events. If your event is not on the list, ask us.',
  },
  {
    topic: 'about',
    q: 'Is The Venue at NCC part of New Community Church?',
    a: `Yes. The Venue at NCC is the event space of New Community Church, which has been part of the Suffolk community since ${site.parent.foundingYear}.`,
  },
  // To answer, then publish:
  { topic: 'space', q: 'Are tables and chairs included?', a: null },
  { topic: 'space', q: 'Is there a kitchen I can use?', a: null },
  { topic: 'space', q: 'Can I decorate, and when can I start setting up?', a: null },
  { topic: 'space', q: 'Is the venue wheelchair accessible?', a: null },
  { topic: 'booking', q: 'What is the cancellation policy?', a: null },
  { topic: 'booking', q: 'Do I need event insurance?', a: null },
  { topic: 'booking', q: 'What time does my event need to end?', a: null },
];

export const publishedFaqs = faqs.filter((f): f is Faq & { a: string } => Boolean(f.a));
