import type { IconName } from '../shared/icons';

/** Top navigation (desktop). Paths are base-relative; wrap with href() when rendering. */
export const mainNav = [
  { label: 'Events', href: '/events/' },
  { label: 'The Space', href: '/the-space/' },
  { label: 'Pricing', href: '/pricing/' },
  { label: 'FAQ', href: '/faq/' },
  { label: 'About', href: '/about/' },
];

/** Mobile tab bar: five tabs at most, per the HIG. */
export const tabNav: { label: string; href: string; icon: IconName }[] = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Events', href: '/events/', icon: 'party-popper' },
  { label: 'Space', href: '/the-space/', icon: 'building' },
  { label: 'Pricing', href: '/pricing/', icon: 'tag' },
  { label: 'Book', href: '/book/', icon: 'calendar-check' },
];

export const bookHref = '/book/';
export const pricingHref = '/pricing/';
