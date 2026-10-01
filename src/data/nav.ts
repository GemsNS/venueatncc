/**
 * Navigation (docs/design/redesign-v7.md, section 3): one short list, the same everywhere. The Space comes
 * ahead of Events because it is what the business rents. Paths are base-relative; wrap with href() when
 * rendering.
 */
export const mainNav = [
  { label: 'The Space', href: '/the-space/' },
  { label: 'Events', href: '/events/' },
  { label: 'Rates', href: '/pricing/' },
  { label: 'FAQ', href: '/faq/' },
];

/** The full-screen menu on compact screens: Home first, then the main navigation. */
export const menuNav = [{ label: 'Home', href: '/' }, ...mainNav];

export const bookHref = '/book/';
export const pricingHref = '/pricing/';
