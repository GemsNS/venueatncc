/**
 * Structured data (JSON-LD) builders. Everything is derived from src/data/site.ts,
 * so a fact added there appears in search-engine markup automatically.
 */
import { site } from '../data/site';
import { photos } from '../data/photos';
import { publishedFaqs } from '../data/faq';

const venueId = `${site.url}/#venue`;
const orgId = `${site.url}/#parent`;
const websiteId = `${site.url}/#website`;

export function abs(path: string): string {
  return new URL(path, site.url).href;
}

function postalAddress() {
  return {
    '@type': 'PostalAddress',
    streetAddress: site.address.street,
    addressLocality: site.address.city,
    addressRegion: site.address.region,
    postalCode: site.address.postalCode,
    addressCountry: site.address.country,
  };
}

export function parentOrganization() {
  return {
    '@type': 'Organization',
    '@id': orgId,
    name: site.parent.name,
    url: site.parent.url,
    foundingDate: String(site.parent.foundingYear),
    founder: { '@type': 'Person', name: site.parent.pastor },
    address: postalAddress(),
    telephone: site.contact.phoneE164,
  };
}

/**
 * The venue as a local business and event venue, emitted on every page and referenced by @id.
 * Room, capacity, and amenity details are only included where they are visible on the page
 * (`details: true`, used by /the-space/), per Google's structured-data guidelines.
 * Office hours are intentionally never published as opening hours: they are not event hours.
 */
export function venue(imageUrls: string[] = [], opts: { details?: boolean } = {}) {
  const details = opts.details ?? false;
  const capacities = site.spaces
    .map((s) => s.standingCapacity ?? s.seatedCapacity)
    .filter((n): n is number => typeof n === 'number');

  const data: Record<string, unknown> = {
    '@type': ['EventVenue', 'LocalBusiness'],
    '@id': venueId,
    name: site.name,
    alternateName: 'Venue at NCC',
    slogan: site.tagline,
    description: site.description,
    url: `${site.url}/`,
    telephone: site.contact.phoneE164,
    address: postalAddress(),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: site.address.geo.lat,
      longitude: site.address.geo.lng,
    },
    hasMap: site.address.mapsUrl,
    areaServed: site.areaServed.map((name) => ({ '@type': 'Place', name })),
    parentOrganization: { '@id': orgId },
    image: imageUrls.length > 0 ? imageUrls : [abs('/og/home.png')],
    logo: abs('/icon-512.png'),
  };

  if (site.contact.email) data.email = site.contact.email;
  if (site.social.length > 0) {
    data.sameAs = site.social.map((s) => s.url);
  }
  if (details && capacities.length > 0) data.maximumAttendeeCapacity = Math.max(...capacities);
  if (details && site.amenities.length > 0) {
    data.amenityFeature = site.amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    }));
  }
  if (details && site.spaces.length > 0) {
    data.containsPlace = site.spaces.map((s) => ({
      '@type': 'Room',
      name: s.name,
      description: s.description,
      ...(s.standingCapacity ?? s.seatedCapacity
        ? { maximumAttendeeCapacity: s.standingCapacity ?? s.seatedCapacity }
        : {}),
    }));
  }
  return data;
}

export function website() {
  return {
    '@type': 'WebSite',
    '@id': websiteId,
    url: `${site.url}/`,
    name: site.name,
    alternateName: ['Venue at NCC', 'NCC Venue'],
    inLanguage: 'en-US',
    publisher: { '@id': venueId },
  };
}

export function webPage(opts: { path: string; title: string; description: string; type?: string }) {
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${abs(opts.path)}#webpage`,
    url: abs(opts.path),
    name: opts.title,
    description: opts.description,
    isPartOf: { '@id': websiteId },
    about: { '@id': venueId },
    inLanguage: 'en-US',
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

export function faqPage(items: { q: string; a: string }[] = publishedFaqs) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** An event type offered at the venue, modelled as a Service provided by the venue. */
export function eventService(opts: { name: string; description: string; path: string; serviceType: string }) {
  return {
    '@type': 'Service',
    '@id': `${abs(opts.path)}#service`,
    name: opts.name,
    serviceType: opts.serviceType,
    description: opts.description,
    url: abs(opts.path),
    provider: { '@id': venueId },
    areaServed: site.areaServed.map((name) => ({ '@type': 'Place', name })),
    availableChannel: {
      '@type': 'ServiceChannel',
      servicePhone: { '@type': 'ContactPoint', telephone: site.contact.phoneE164, contactType: 'reservations' },
      serviceUrl: abs('/book/'),
    },
  };
}

/** Wrap several nodes in one @graph document. */
export function graph(...nodes: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export const photoCount = photos.length;
