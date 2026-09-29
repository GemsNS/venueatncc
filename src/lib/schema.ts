/**
 * Structured data (JSON-LD) builders. Everything is derived from src/data/site.ts and
 * src/shared/pricing.ts, so a fact changed there changes the search-engine markup too.
 * Brand rules (docs/design/brand.md): spaces go by their public names, The Hall and The Grove. Structured
 * data never mentions alcohol or catering, and the venue is a stand-alone business with no parent
 * organization.
 */
import { site } from '../data/site';
import { publishedFaqs } from '../data/faq';
import { pricing, priceSummary, formatUSD } from '../shared/pricing';
import type { SpaceChoice } from '../shared/types';

const venueId = `${site.url}/#venue`;
const websiteId = `${site.url}/#website`;
const ratesId = `${site.url}/pricing/#rates`;

/**
 * Share images that stand for the venue as a whole: the building at blue hour and The Hall.
 * Fixed paths rather than hashed assets, so the URLs in structured data stay stable between builds.
 */
const VENUE_SHARE_IMAGES = ['/og/home.png', '/og/the-space.png'];

/**
 * Words and phrases the brand keeps out of public copy (docs/design/brand.md, Voice). Structured data and
 * llms.txt leave out copy that uses one and warn at build time, so off-brand text in src/data/ never reaches
 * search engines or assistants. Marking up only some of a page's visible questions is valid structured data.
 */
const OFF_BRAND =
  /\b(alcohol\w*|drinks?|bars?|beer|wine|mimosas?|toasts?|raise a glass|ABC|BYO\w*|bring your own|your own caterer|caterer of your choice|the freedom to|your menu, your way|whether there is a kitchen)\b/i;

/** The first off-brand word or phrase in some copy, or null when it is clean. */
export function offBrandPhrase(text: string): string | null {
  return OFF_BRAND.exec(text)?.[0] ?? null;
}

/**
 * Catering is neutral copy, but brand.md allows it only in the pricing page's rental terms and the one FAQ
 * entry on /faq/. Structured data and llms.txt leave that entry out quietly; it is on-brand, not an error.
 */
export function mentionsCatering(text: string): boolean {
  return /\bcater/i.test(text);
}

const warned = new Set<string>();
function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/** The public name of a space choice: The Hall, The Grove, or The Hall and The Grove. */
export function spaceName(choice: SpaceChoice): string {
  const name = (id: 'indoor' | 'outdoor') => site.spaces.find((s) => s.id === id)?.name ?? (id === 'indoor' ? 'The Hall' : 'The Grove');
  return choice === 'both' ? `${name('indoor')} and ${name('outdoor')}` : name(choice);
}

/** The places the venue serves, typed for schema.org. Shared by the venue and every event Service. */
function areaServed() {
  return site.areaServed.map((a) => ({ '@type': a.type, name: a.name }));
}

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

const feature = (name: string, value: boolean | string = true) => ({
  '@type': 'LocationFeatureSpecification',
  name,
  value,
});

/**
 * The venue as a local business and event venue. Emitted on every page and referenced by @id.
 * Capacity and parking facts are shown on the home page and The Space, and describe the venue as a whole,
 * so they are included here; room details (containsPlace) only where a page asks for them.
 * imageUrls are absolute URLs of real photos of the property; the venue's share images follow them.
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
    areaServed: areaServed(),
    image: [...new Set([...imageUrls, ...VENUE_SHARE_IMAGES.map(abs)])],
    logo: abs('/icon-512.png'),
    publicAccess: site.policies.openToPublic,
    maximumAttendeeCapacity: site.maxCapacity,
    priceRange: `From ${formatUSD(fromHourly)} per hour`,
    currenciesAccepted: pricing.currency,
    amenityFeature: [
      feature('On-site parking', site.policies.parkingIncluded),
      ...site.spaces.map((s) => feature(`${s.name}, up to ${s.capacity} guests`)),
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
    alternateName: 'Venue at NCC',
    inLanguage: 'en-US',
    publisher: { '@id': venueId },
  };
}

export function webPage(opts: { path: string; title: string; description: string; type?: string }) {
  const phrase = offBrandPhrase(opts.description);
  if (phrase) warnOnce(`[schema] The description of ${opts.path} says "${phrase}", so its WebPage markup uses the venue description. Rewrite it to follow docs/design/brand.md.`);
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${abs(opts.path)}#webpage`,
    url: abs(opts.path),
    name: opts.title,
    description: phrase ? site.description : opts.description,
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
  const onBrand = items.filter((f) => {
    const phrase = offBrandPhrase(`${f.q} ${f.a}`);
    if (phrase) warnOnce(`[schema] Left "${f.q}" out of the FAQPage markup because it says "${phrase}". Rewrite it to follow docs/design/brand.md.`);
    return !phrase && !mentionsCatering(`${f.q} ${f.a}`);
  });
  // An FAQPage with no questions is invalid, and an empty node is ignored.
  if (onBrand.length === 0) return {};
  return {
    '@type': 'FAQPage',
    mainEntity: onBrand.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** An event type offered at the venue, modelled as a Service with a price hint. */
export function eventService(opts: { name: string; description: string; path: string; serviceType: string }) {
  const { fromHourly } = priceSummary();
  const phrase = offBrandPhrase(opts.description);
  if (phrase) warnOnce(`[schema] The description of "${opts.name}" says "${phrase}", so its Service markup uses the venue description. Rewrite it to follow docs/design/brand.md.`);
  return {
    '@type': 'Service',
    '@id': `${abs(opts.path)}#service`,
    name: opts.name,
    serviceType: opts.serviceType,
    description: phrase ? site.description : opts.description,
    url: abs(opts.path),
    provider: { '@id': venueId },
    areaServed: areaServed(),
    offers: {
      '@type': 'Offer',
      priceCurrency: pricing.currency,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: fromHourly,
        priceCurrency: pricing.currency,
        unitText: 'hour',
        description: `Venue rental from ${formatUSD(fromHourly)} per hour`,
      },
      url: abs('/book/'),
    },
  };
}

/**
 * The rate card as an OfferCatalog, for the pricing page: hourly rates, packages, and the cleaning fee.
 * Pair it with venueRates() so the venue node points at the catalog.
 */
export function rateCatalog() {
  const offeredBy = { '@id': venueId };
  const hourly = (Object.keys(pricing.hourly) as (keyof typeof pricing.hourly)[]).flatMap((space) =>
    (Object.keys(pricing.hourly[space]) as (keyof (typeof pricing.hourly)['indoor'])[]).map((day) => ({
      '@type': 'Offer',
      name: `${spaceName(space)}, ${pricing.dayTypes[day].label}`,
      priceCurrency: pricing.currency,
      offeredBy,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: pricing.hourly[space][day],
        priceCurrency: pricing.currency,
        unitText: 'hour',
      },
    })),
  );
  const packages = pricing.packages.map((p) => ({
    '@type': 'Offer',
    name: p.name,
    description: p.description ?? `${p.hours} hours in ${spaceName(p.space)}${p.dayType === 'any' ? '' : ` (${pricing.dayTypes[p.dayType].label})`}.`,
    price: p.price,
    priceCurrency: pricing.currency,
    offeredBy,
    eligibleDuration: { '@type': 'QuantitativeValue', value: p.hours, unitCode: 'HUR' },
  }));
  const fees =
    pricing.fees.cleaning > 0
      ? [
          {
            '@type': 'Offer',
            name: 'Cleaning fee',
            description: 'Charged once per event.',
            price: pricing.fees.cleaning,
            priceCurrency: pricing.currency,
            offeredBy,
          },
        ]
      : [];
  return {
    '@type': 'OfferCatalog',
    '@id': ratesId,
    name: `${site.name} rental rates`,
    itemListElement: [...hourly, ...packages, ...fees],
  };
}

/** Links the venue node (emitted by the layout) to the rate catalog on the pricing page. Merged by @id. */
export function venueRates() {
  return { '@id': venueId, hasOfferCatalog: { '@id': ratesId } };
}

/** Wrap several nodes in one @graph document. */
export function graph(...nodes: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
