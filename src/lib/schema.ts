/**
 * Structured data (JSON-LD) builders. Everything is derived from src/data/site.ts and
 * src/shared/pricing.ts, so a fact changed there changes the search-engine markup too.
 */
import { site } from '../data/site';
import { publishedFaqs } from '../data/faq';
import { pricing, priceSummary } from '../shared/pricing';

const venueId = `${site.url}/#venue`;
const orgId = `${site.url}/#parent`;
const websiteId = `${site.url}/#website`;

/** Absolute URL on the production domain (canonical URLs and structured data). */
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
    telephone: site.parent.phoneE164,
  };
}

const feature = (name: string, value: boolean | string = true) => ({
  '@type': 'LocationFeatureSpecification',
  name,
  value,
});

/**
 * The venue as a local business and event venue. Emitted on every page and referenced by @id.
 * Capacity, parking, alcohol, and catering facts appear in the page chrome site-wide, so they are included.
 */
export function venue(imageUrls: string[] = [], opts: { details?: boolean } = {}) {
  const { fromHourly } = priceSummary();
  const data: Record<string, unknown> = {
    '@type': ['EventVenue', 'LocalBusiness'],
    '@id': venueId,
    name: site.name,
    alternateName: 'Venue at NCC',
    slogan: site.tagline,
    description: site.description,
    url: `${site.url}/`,
    telephone: site.contact.phoneE164,
    email: site.contact.email,
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
    publicAccess: site.policies.openToPublic,
    maximumAttendeeCapacity: site.maxCapacity,
    priceRange: `From $${fromHourly} per hour`,
    currenciesAccepted: pricing.currency,
    amenityFeature: [
      feature('On-site parking included', site.policies.parkingIncluded),
      feature('Alcohol permitted', site.policies.alcoholAllowed),
      feature('Bring your own caterer', !site.policies.cateringIncluded),
      ...site.spaces.map((s) => feature(`${s.name} for up to ${s.capacity} guests`)),
    ],
  };
  if (opts.details) {
    data.containsPlace = site.spaces.map((s) => ({
      '@type': 'Place',
      name: s.name,
      description: s.description,
      maximumAttendeeCapacity: s.capacity,
    }));
  }
  if (site.social.length > 0) data.sameAs = site.social.map((s) => s.url);
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

/** An event type offered at the venue, modelled as a Service with a price hint. */
export function eventService(opts: { name: string; description: string; path: string; serviceType: string }) {
  const { fromHourly } = priceSummary();
  return {
    '@type': 'Service',
    '@id': `${abs(opts.path)}#service`,
    name: opts.name,
    serviceType: opts.serviceType,
    description: opts.description,
    url: abs(opts.path),
    provider: { '@id': venueId },
    areaServed: { '@type': 'City', name: 'Suffolk, Virginia' },
    offers: {
      '@type': 'Offer',
      priceCurrency: pricing.currency,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: fromHourly,
        priceCurrency: pricing.currency,
        unitText: 'hour',
        description: `Venue rental from $${fromHourly} per hour`,
      },
      url: abs('/book/'),
    },
  };
}

/** The rate card as an OfferCatalog, for the pricing page. */
export function rateCatalog() {
  const items = (Object.keys(pricing.hourly) as (keyof typeof pricing.hourly)[]).flatMap((space) =>
    (Object.keys(pricing.hourly[space]) as (keyof (typeof pricing.hourly)['indoor'])[]).map((day) => ({
      '@type': 'Offer',
      name: `${pricing.spaces[space].label}, ${pricing.dayTypes[day].label}`,
      priceCurrency: pricing.currency,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: pricing.hourly[space][day],
        priceCurrency: pricing.currency,
        unitText: 'hour',
      },
    })),
  );
  return {
    '@type': 'OfferCatalog',
    name: `${site.name} rental rates`,
    itemListElement: items,
  };
}

/** Wrap several nodes in one @graph document. */
export function graph(...nodes: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
