/**
 * Navigation (docs/design/redesign-v7.md, "Version 8"): five public pages, one short list, the same
 * everywhere. The Space comes ahead of Events because it is what the business rents. Book is the header's
 * Check Availability button, not a link. Paths are base-relative; wrap with href() when rendering.
 */
export const mainNav = [
  { label: 'The Space', href: '/the-space/' },
  { label: 'Events', href: '/events/' },
  { label: 'Rates & FAQ', href: '/pricing/' },
];

/** The full-screen menu on compact screens: Home first, then the main navigation. */
export const menuNav = [{ label: 'Home', href: '/' }, ...mainNav];

export const bookHref = '/book/';
export const pricingHref = '/pricing/';
