/**
 * Frequently asked questions: the last section of Rates & FAQ, /pricing/#faq (docs/design/redesign-v7.md,
 * "Version 8"). The old /faq/ answers 301 to it.
 *
 * Only questions with an answer are published (on /pricing/, in llms.txt, and as FAQPage structured data).
 * Questions with `a: null` are a to-do list for the venue team.
 *
 * One home per fact: the rates, what is included, holding a date, and the hours are stated in the sections
 * above the FAQ on the same page, the capacities on The Space, the address in the footer, and the occasions
 * on Events, so none of them is a question here. An answer whose fact lives on another page is one sentence,
 * and `more` links to that page.
 *
 * Voice: professional and neutral (docs/design/brand.md). State facts; do not market permissive policies.
 * Catering is mentioned in exactly one entry, "Is catering provided?". It is shown on the page only:
 * llms.txt and the FAQPage structured data leave it out (mentionsCatering in src/lib/schema.ts).
 * No answer says how far ahead to book, reserve, or plan a date, and no question asks it (brand.md, "The
 * client's rules of October 1, 2026", rule 2). No answer names an amount, a percentage, or a discount.
 */
import { site } from './site';

export interface Faq {
  q: string;
  a: string | null;
  /** A link to the fact's home on another page, shown after the answer. Base-relative path. */
  more?: { label: string; href: string };
}

const phone = site.contact.phone;
const hall = site.spaces.find((s) => s.id === 'indoor');
const mainHall = site.spaces.find((s) => s.id === 'main');
const grove = site.spaces.find((s) => s.id === 'outdoor');

/** The owner's approved wording for rates, with the number to call. */
export const RATES_WORDING = `Our affordable rates vary with peak season, holidays, and the day of the week. For pricing and special offers, please call us at ${phone} and we will be happy to help you.`;

export const faqs: Faq[] = [
  {
    q: 'How do I check if my date is available?',
    a: 'Choose a date on the booking page to see which spaces are open, then send your request. We confirm every booking personally.',
    more: { label: 'Check availability', href: '/book/' },
  },
  {
    q: 'Who can book the venue?',
    a: 'The Venue @ NCC is open to the public. Families, businesses, nonprofits, and community groups can all book.',
  },
  {
    q: 'Can I see the venue before I book?',
    a: 'Yes. Ask for a tour when you send your request, or call us, and we will arrange a time to walk through the space with you.',
    more: { label: 'Request a visit', href: '/book/?visit=1' },
  },
  {
    q: 'Can we book recurring dates?',
    a: 'Yes. Tell us the schedule you have in mind in your request, and we will confirm which dates are available.',
  },
  {
    q: `Can I book ${hall?.name} and ${grove?.name} together?`,
    a: `Yes. Choose ${hall?.name} and ${grove?.name} when you request a date. To add ${mainHall?.name} on the same day, mention it in your message.`,
  },
  {
    q: 'What if it rains on an outdoor event?',
    a: `Reserve ${hall?.name} with ${grove?.name} and ${hall?.name} is ready for your guests if the weather turns. If your guest list is larger than ${hall?.name} holds, we will talk through a weather plan with you before you book.`,
  },
  {
    q: 'Can you help with room setup?',
    a: 'Yes. Share your guest count and the layout you have in mind when you request a date, and we will review the setup with you.',
  },
  {
    q: 'Is catering provided?',
    a: 'Catering is not included in the rental. You arrange food service separately, and banquet arrangements include kitchen access.',
  },
  // To answer, then publish:
  { q: 'Can I decorate, and when can I start setting up?', a: null },
  { q: 'Is the venue wheelchair accessible?', a: null },
  { q: 'What is the cancellation policy?', a: null },
  { q: 'Do I need event insurance?', a: null },
];

export const publishedFaqs = faqs.filter((f): f is Faq & { a: string } => Boolean(f.a));
