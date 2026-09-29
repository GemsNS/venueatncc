/**
 * Frequently asked questions.
 *
 * Only questions with an answer are published (on /faq/, in llms.txt, and as FAQPage structured data).
 * Questions with `a: null` are a to-do list for the venue team.
 *
 * Voice: professional and neutral (docs/design/brand.md). State facts; do not market permissive policies.
 * Catering is mentioned in exactly one entry, "Is catering provided?". It is shown on /faq/ only:
 * llms.txt and the FAQPage structured data leave it out (mentionsCatering in src/lib/schema.ts).
 *
 * Each answer says a fact once. Parking lives in "What is included in the rental?". The 'pricing' group is
 * the question form of /pricing/, which states rates, deposits, the balance, and fees in full (Rental terms
 * and Fees) and does not repeat these questions; the deposit answer gives the headline and points there
 * instead of copying the paragraph (brand.md, Redundancy rules). How booking works is said by the closing
 * band on each page, so the availability answer only points to the calendar. The phone is in the visit
 * answer and the footer.
 */
import { site, fullAddress } from './site';
import { pricing, priceSummary, formatUSD } from '../shared/pricing';

export interface Faq {
  q: string;
  a: string | null;
  /** Groups questions on the FAQ page. */
  topic: 'booking' | 'space' | 'pricing' | 'about';
}

const phone = site.contact.phone;
const { fromHourly } = priceSummary();
const hall = site.spaces.find((s) => s.id === 'indoor');
const grove = site.spaces.find((s) => s.id === 'outdoor');
const deposit =
  pricing.bookingDeposit.type === 'percent'
    ? `A ${pricing.bookingDeposit.value}% booking deposit`
    : `A booking deposit of ${formatUSD(pricing.bookingDeposit.value)}`;
/** What the pricing page adds to the deposit answer, named only when the rate card has it. */
const pricingDetails = [
  pricing.bookingDeposit.balanceDueDaysBefore > 0 ? 'the balance terms' : null,
  pricing.fees.damageDepositRefundable > 0 ? 'the refundable damage deposit' : null,
  'every fee',
].filter((d): d is string => d !== null);
const andList = (items: string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;

export const faqs: Faq[] = [
  {
    topic: 'booking',
    q: 'How do I check if my date is available?',
    a: `Use the availability calendar on our booking page to see open dates for ${hall?.name} and ${grove?.name}.`,
  },
  {
    topic: 'booking',
    q: 'Who can book the venue?',
    a: 'The Venue at NCC is open to the public. Families, businesses, nonprofits, and faith groups can all book.',
  },
  {
    topic: 'booking',
    q: 'Can I see the venue before I book?',
    a: `Yes. Ask for a visit when you send your request, or call ${phone}, and we will arrange a time to walk through the space with you.`,
  },
  {
    topic: 'space',
    q: 'How many guests can the venue hold?',
    a: `${hall?.name}, our indoor space, holds up to ${hall?.capacity} guests. ${grove?.name}, our outdoor space, holds up to ${grove?.capacity} guests.`,
  },
  {
    topic: 'space',
    q: `Can I book ${hall?.name} and ${grove?.name} together?`,
    a: 'Yes. Choose both spaces when you request a date, and we confirm availability for each when we follow up.',
  },
  {
    topic: 'space',
    q: 'Can you help with tables, chairs, and room setup?',
    a: 'Please ask when you request a date. Share your guest count and the layout you have in mind, and we will review the setup with you before you reserve.',
  },
  {
    topic: 'space',
    q: 'Is catering provided?',
    a: 'No. You arrange food service separately.',
  },
  {
    topic: 'pricing',
    q: 'How much does it cost to rent the venue?',
    a: `Rates start at ${formatUSD(fromHourly)} an hour and depend on the space, the day, and the length of your event. Packages for set blocks of time are also available. The pricing page lists every rate and fee and gives an instant estimate for your date.`,
  },
  {
    topic: 'pricing',
    q: 'How do deposits and payments work?',
    a: `${deposit} reserves your date once we confirm availability. The pricing page lists ${andList(pricingDetails)}.`,
  },
  {
    topic: 'pricing',
    q: 'What is included in the rental?',
    a: 'Every rental includes the space you book and on-site parking.',
  },
  {
    topic: 'about',
    q: 'Where is The Venue at NCC?',
    a: `The Venue at NCC is at ${fullAddress}.`,
  },
  {
    topic: 'about',
    q: 'What kinds of events can I host?',
    a: 'Weddings and receptions, banquets and anniversaries, baby and bridal showers, birthdays and milestones, repasts and celebrations of life, meetings and workshops, graduations and reunions, and community events. For another kind of event, describe it in your request, and we will confirm which space suits it.',
  },
  // To answer, then publish:
  { topic: 'space', q: 'Can I decorate, and when can I start setting up?', a: null },
  { topic: 'space', q: 'Is the venue wheelchair accessible?', a: null },
  { topic: 'booking', q: 'What is the cancellation policy?', a: null },
  { topic: 'booking', q: 'Do I need event insurance?', a: null },
  { topic: 'booking', q: 'What time does my event need to end?', a: null },
];

export const publishedFaqs = faqs.filter((f): f is Faq & { a: string } => Boolean(f.a));
