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
 * discount. The rates answer points to Rates, which carries the owner's approved wording (RATES_WORDING,
 * also used by llms.txt) and the Call button.
 *
 * The FAQ rule (docs/design/redesign-v7.md, section 4): an answer whose fact has a home elsewhere on the
 * site is one sentence, and `more` links to that home (capacities and inclusions on The Space, rates, the
 * deposit and the hours on Rates at #before, directions on the home page at #location). Only questions with no other home carry a full answer. The answer here
 * is the short one, so the FAQ page, the FAQPage structured data, and llms.txt all say the same thing.
 */
import { site, fullAddress } from './site';
import { SETUP_CLEANUP_RULE } from '../shared/booking-rules';

export interface Faq {
  q: string;
  a: string | null;
  /** A link to the fact's home, shown after the answer on the FAQ page. Base-relative path. */
  more?: { label: string; href: string };
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
    more: { label: 'Check availability', href: '/book/' },
  },
  {
    topic: 'booking',
    q: 'Who can book the venue?',
    a: 'The Venue @ NCC is open to the public. Families, businesses, nonprofits, and faith groups can all book.',
  },
  {
    topic: 'booking',
    q: 'Can I see the venue before I book?',
    a: 'Yes. Ask for a personal tour when you send your request, or call us, and we will arrange a time to walk through the space with you.',
    more: { label: 'Request a visit', href: '/book/?visit=1' },
  },
  {
    topic: 'booking',
    q: 'What days and hours can I book?',
    a: `Events can be booked ${site.access.days}, ${site.access.hours}. ${SETUP_CLEANUP_RULE}`,
    more: { label: 'Deposit and hours on Rates', href: '/pricing/#before' },
  },
  {
    topic: 'space',
    q: 'How many guests can the venue hold?',
    a: `${hall?.name} and ${mainHall?.name} each hold up to ${hall?.capacity} guests, and ${grove?.name} holds up to ${grove?.capacity}.`,
    more: { label: 'See The Space', href: '/the-space/' },
  },
  {
    topic: 'space',
    q: `Can I book ${hall?.name} and ${grove?.name} together?`,
    a: `Yes. Choose ${hall?.name} and ${grove?.name} when you request a date, and we confirm availability for each when we follow up. To add ${mainHall?.name} on the same day, mention it in your message.`,
  },
  {
    topic: 'space',
    q: 'Can you help with room setup?',
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
    a: 'We quote each event personally. Call us, or request your date and we will send your rate.',
    more: { label: 'Rates', href: '/pricing/' },
  },
  {
    topic: 'pricing',
    q: 'How do deposits and payments work?',
    a: site.depositPolicy,
    more: { label: 'Deposit and hours on Rates', href: '/pricing/#before' },
  },
  {
    topic: 'pricing',
    q: 'What is included in the rental?',
    a: 'Every rental includes the space you book, tables and chairs, and on-site parking.',
    more: { label: 'What the rental includes', href: '/the-space/#included' },
  },
  {
    topic: 'about',
    q: 'Where is The Venue @ NCC?',
    a: `The Venue @ NCC is at ${fullAddress}.`,
    more: { label: 'Directions and parking', href: '/#location' },
  },
  {
    topic: 'about',
    q: 'What kinds of events can I host?',
    a: 'We host eight kinds of occasions, from weddings to community events, and for anything else, describe it in your request and we will confirm which space suits it.',
    more: { label: 'See all events', href: '/events/' },
  },
  // To answer, then publish:
  { topic: 'space', q: 'Can I decorate, and when can I start setting up?', a: null },
  { topic: 'space', q: 'Is the venue wheelchair accessible?', a: null },
  { topic: 'booking', q: 'What is the cancellation policy?', a: null },
  { topic: 'booking', q: 'Do I need event insurance?', a: null },
];

export const publishedFaqs = faqs.filter((f): f is Faq & { a: string } => Boolean(f.a));
