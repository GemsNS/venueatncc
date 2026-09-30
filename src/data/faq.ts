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
 * The venue does not publish prices: no answer names an amount, a percentage, a deposit figure, or a
 * discount. The rates answer uses the owner's approved wording with the phone number, and it is the one
 * answer that carries the number (the visit answer says "call us"; the footer has the number too).
 *
 * Each answer says a fact once. Parking lives in "What is included in the rental?". How booking works is
 * said by the closing band on each page, so the availability answer only points to the calendar. The two
 * rental policies each have one answer here (the deposit, the building hours) and are otherwise stated
 * only on /pricing/ (Rates).
 */
import { site, fullAddress } from './site';

export interface Faq {
  q: string;
  a: string | null;
  /** Groups questions on the FAQ page. */
  topic: 'booking' | 'space' | 'pricing' | 'about';
}

const phone = site.contact.phone;
const hall = site.spaces.find((s) => s.id === 'indoor');
const mainHall = site.spaces.find((s) => s.id === 'main');
const grove = site.spaces.find((s) => s.id === 'outdoor');

/** The owner's approved wording for rates, with the number to call. */
export const RATES_WORDING = `Our affordable rates vary with peak season, holidays, and the day of the week. For pricing and special offers, please call us at ${phone} and we will be happy to help you.`;

export const faqs: Faq[] = [
  {
    topic: 'booking',
    q: 'How do I check if my date is available?',
    a: `Use the availability calendar on our booking page to see open dates for ${hall?.name}, ${mainHall?.name}, and ${grove?.name}.`,
  },
  {
    topic: 'booking',
    q: 'Who can book the venue?',
    a: 'The Venue @ NCC is open to the public. Families, businesses, nonprofits, and faith groups can all book.',
  },
  {
    topic: 'booking',
    q: 'Can I see the venue before I book?',
    a: 'Yes. We would be glad to give you a personal tour. Ask for a visit when you send your request, or call us, and we will arrange a time to walk through the space with you.',
  },
  {
    topic: 'booking',
    q: 'What days and hours can I book?',
    a: `Building access for events is ${site.access.days}, ${site.access.hours}, so your event, with setup and cleanup, ends by midnight. We are closed on Sundays.`,
  },
  {
    topic: 'space',
    q: 'How many guests can the venue hold?',
    a: `Indoors, ${hall?.name} and ${mainHall?.name} each hold up to ${hall?.capacity} guests. Outdoors, ${grove?.name} holds up to ${grove?.capacity} guests.`,
  },
  {
    topic: 'space',
    q: `Can I book ${hall?.name} and ${grove?.name} together?`,
    a: `Yes. Choose ${hall?.name} and ${grove?.name} when you request a date, and we confirm availability for each when we follow up. To add ${mainHall?.name} on the same day, mention it in your message.`,
  },
  {
    topic: 'space',
    q: 'Can you help with tables, chairs, and room setup?',
    a: 'Please ask when you request a date. Share your guest count and the layout you have in mind, and we will review the setup with you before you reserve.',
  },
  {
    topic: 'space',
    q: 'Is catering provided?',
    a: 'Catering is not included in the rental. You arrange food service separately, and banquet arrangements include kitchen access.',
  },
  {
    topic: 'pricing',
    q: 'How much does it cost to rent the venue?',
    a: RATES_WORDING,
  },
  {
    topic: 'pricing',
    q: 'How do deposits and payments work?',
    a: `${site.depositPolicy} We confirm availability and send your quote personally, with the payment terms for your date.`,
  },
  {
    topic: 'pricing',
    q: 'What is included in the rental?',
    a: 'Every rental includes the space you book and on-site parking.',
  },
  {
    topic: 'about',
    q: 'Where is The Venue @ NCC?',
    a: `The Venue @ NCC is at ${fullAddress}.`,
  },
  {
    topic: 'about',
    q: 'What kinds of events can I host?',
    a: 'Weddings and receptions, banquets and anniversaries, baby and bridal showers, birthdays and milestones, repasts and celebrations of life, conferences, meetings and workshops, graduations and reunions, and community events. For another kind of event, describe it in your request, and we will confirm which space suits it.',
  },
  // To answer, then publish:
  { topic: 'space', q: 'Can I decorate, and when can I start setting up?', a: null },
  { topic: 'space', q: 'Is the venue wheelchair accessible?', a: null },
  { topic: 'booking', q: 'What is the cancellation policy?', a: null },
  { topic: 'booking', q: 'Do I need event insurance?', a: null },
];

export const publishedFaqs = faqs.filter((f): f is Faq & { a: string } => Boolean(f.a));
