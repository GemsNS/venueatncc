/** Top navigation (regular screens). Paths are base-relative; wrap with href() when rendering. */
export const mainNav = [
  { label: 'Events', href: '/events/' },
  { label: 'The Space', href: '/the-space/' },
  { label: 'Rates', href: '/pricing/' },
  { label: 'FAQ', href: '/faq/' },
];

/** The full-screen menu on compact screens: Home first, then the main navigation. */
export const menuNav = [{ label: 'Home', href: '/' }, ...mainNav];

export const bookHref = '/book/';
export const pricingHref = '/pricing/';
