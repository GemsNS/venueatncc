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
 * The home page looks these questions up by their exact text, so keep them word for word:
 *   "How many guests can the venue hold?", "Who can book the venue?",
 *   "How do deposits and payments work?", "How do I check if my date is available?"
 */
import { site, fullAddress } from './site';
import { pricing, priceSummary, formatUSD } from '../shared/pricing';

export interface Faq {
  q: string;
  a: string | null;
  /** Groups questions on the FAQ page. The pricing page shows the 'pricing' group. */
  topic: 'booking' | 'space' | 'pricing' | 'about';
}

const phone = site.contact.phone;
const { fromHourly } = priceSummary();
const hall = site.spaces.find((s) => s.id === 'indoor');
const grove = site.spaces.find((s) => s.id === 'outdoor');
const deposit =
  pricing.bookingDeposit.type === 'percent'
    ? `The booking deposit is ${pricing.bookingDeposit.value}% of your total`
    : `The booking deposit is ${formatUSD(pricing.bookingDeposit.value)}`;
const balanceDays = pricing.bookingDeposit.balanceDueDaysBefore;
const payment =
  balanceDays > 0
    ? `${deposit}, and the balance is due ${balanceDays} days before your event. For an event within ${balanceDays} days, the full amount is due when you reserve.`
    : `${deposit}.`;
const damage =
  pricing.fees.damageDepositRefundable > 0
    ? ` A refundable damage deposit of ${formatUSD(pricing.fees.damageDepositRefundable)} is returned after the event if there is no damage.`
    : '';
const cleaning = pricing.fees.cleaning > 0 ? ` A cleaning fee of ${formatUSD(pricing.fees.cleaning)} applies to each event.` : '';

export const faqs: Faq[] = [
  {
    topic: 'booking',
    q: 'How do I check if my date is available?',
    a: `Use the availability calendar on our booking page. It shows open dates for ${hall?.name} and ${grove?.name}, gives you an instant estimate, and lets you send a request in about two minutes. You can also call ${phone}. We confirm every booking personally.`,
  },
  {
    topic: 'booking',
    q: 'Who can book the venue?',
    a: `The Venue at NCC is open to the public. Families, businesses, nonprofits, and churches can all book, and membership at ${site.parent.name} is not required.`,
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
    q: 'What about tables, chairs, and room setup?',
    a: 'Please ask when you request a date. Share your guest count and the layout you have in mind, and we will review the setup with you before you reserve.',
  },
  {
    topic: 'space',
    q: 'Is parking included?',
    a: 'Yes. Every booking includes on-site parking in our paved lot.',
  },
  {
    topic: 'space',
    q: 'Is catering provided?',
    a: 'Rentals include the space and on-site parking. Food service is arranged separately.',
  },
  {
    topic: 'pricing',
    q: 'How much does it cost to rent the venue?',
    a: `Rates start at ${formatUSD(fromHourly)} an hour and depend on the space, the day, and the length of your event. Packages for set blocks of time are also available. The pricing page lists every rate and fee and gives an instant estimate for your date.`,
  },
  {
    topic: 'pricing',
    q: 'How do deposits and payments work?',
    a: `Once we confirm availability, your booking deposit reserves the date. ${payment}${damage}`,
  },
  {
    topic: 'pricing',
    q: 'What is included in the rental?',
    a: `Every rental includes the space you book and on-site parking.${cleaning}`,
  },
  {
    topic: 'about',
    q: 'Where is The Venue at NCC?',
    a: `The Venue at NCC is at ${site.parent.name}, ${fullAddress}.`,
  },
  {
    topic: 'about',
    q: 'What kinds of events can I host?',
    a: 'Weddings and receptions, banquets and anniversaries, baby and bridal showers, birthdays and milestones, repasts and celebrations of life, meetings and workshops, graduations and reunions, and church and community events. For another kind of event, please call us to discuss it.',
  },
  {
    topic: 'about',
    q: 'Who operates The Venue at NCC?',
    a: `The Venue at NCC is operated by ${site.parent.name}, part of the Suffolk community since ${site.parent.foundingYear}.`,
  },
  // To answer, then publish:
  { topic: 'space', q: 'Can I decorate, and when can I start setting up?', a: null },
  { topic: 'space', q: 'Is the venue wheelchair accessible?', a: null },
  { topic: 'booking', q: 'What is the cancellation policy?', a: null },
  { topic: 'booking', q: 'Do I need event insurance?', a: null },
  { topic: 'booking', q: 'What time does my event need to end?', a: null },
];

export const publishedFaqs = faqs.filter((f): f is Faq & { a: string } => Boolean(f.a));
