/**
 * Structured data (JSON-LD) builders. Everything is derived from src/data/site.ts, so a fact changed
 * there changes the search-engine markup too.
 * Brand rules (docs/design/brand.md): spaces go by their public names, The Hall, The Main Hall, and The
 * Grove. Structured
 * data never mentions alcohol or catering, and the venue is a stand-alone business with no parent
 * organization. The venue does not publish prices, so no node carries priceRange, a price, or an
 * OfferCatalog of rates.
 */
import { site } from '../data/site';
import { publishedFaqs } from '../data/faq';
import { SPACE_NAMES, type SpaceChoice } from '../shared/types';

const venueId = `${site.url}/#venue`;
const websiteId = `${site.url}/#website`;

/**
 * Share images that stand for the venue as a whole: The Hall (the-space). The home card is a still life of
 * roses, not a photo of the property, so it is left out.
 * Fixed paths rather than hashed assets, so the URLs in structured data stay stable between builds.
 */
const VENUE_SHARE_IMAGES = ['/og/the-space.jpg'];

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
 * Catering is neutral copy, but brand.md allows it only in the one FAQ entry on Rates & FAQ. Structured data and
 * llms.txt leave that entry out quietly; it is on-brand, not an error.
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

/** The public name of a space choice: The Hall, The Main Hall, The Grove, or The Hall and The Grove. */
export function spaceName(choice: SpaceChoice): string {
  return SPACE_NAMES[choice];
}

/** The places the venue serves, typed for schema.org. */
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
 * imageUrls are absolute URLs of real photos of the property; the venue's share image of The Hall follows them.
 */
export function venue(imageUrls: string[] = [], opts: { details?: boolean } = {}) {
  const data: Record<string, unknown> = {
    '@type': ['EventVenue', 'LocalBusiness'],
    '@id': venueId,
    name: site.name,
    alternateName: 'The Venue at NCC',
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
    // Building access for events (site.access): Monday to Saturday, 9:00 AM to 12:00 midnight.
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '24:00',
    },
    amenityFeature: [
      feature('On-site parking', site.policies.parkingIncluded),
      feature('Tables and chairs'),
      ...site.spaces.map((s) => feature(`${s.name}, up to ${s.capacity} guests`)),
      ...site.amenities.map((a) => feature(a.name)),
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
    alternateName: 'The Venue at NCC',
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

/** Wrap several nodes in one @graph document. */
export function graph(...nodes: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
