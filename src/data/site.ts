/**
 * The single source of truth for facts about The Venue at NCC.
 *
 * Every page, the booking wizard, the API server, and the structured data (JSON-LD) read from here.
 * Anything not confirmed is left as `null` or `[]`, and the site hides it.
 *
 * Confirmed by the venue team on 2026-09-28:
 *   phone, email (assumed domain, see contact.email), indoor capacity 100, outdoor capacity 150,
 *   open to anyone, alcohol allowed with no venue rules, catering not included (venue-only rental),
 *   parking included, brand colors white and purple.
 * Confirmed from wearencc.org and OpenStreetMap on 2026-09-27:
 *   church name, address, church phone, founding year, pastor, geo coordinates.
 * Kept from the original venueatncc.org page: the tagline "Unforgettable Events Await You".
 *
 * Rates live in src/shared/pricing.ts.
 */

export type SpaceId = 'indoor' | 'outdoor' | 'both';

export interface Space {
  id: SpaceId;
  /** Display name. The rooms have no official names yet, so these are plain descriptions. */
  name: string;
  /** One plain sentence. Do not describe finishes or features that are not confirmed. */
  description: string;
  /** Maximum guests. */
  capacity: number;
}

export const site = {
  name: 'The Venue at NCC',
  shortName: 'The Venue',
  /** Kept from the original venueatncc.org page. */
  tagline: 'Unforgettable events await you',
  url: 'https://venueatncc.org',
  locale: 'en_US',

  /** Default description used when a page does not set its own. */
  description:
    'The Venue at NCC is an event venue in Suffolk, Virginia, with an indoor hall for 100 guests and an outdoor space for 150. Open to everyone. Parking included.',

  parent: {
    name: 'New Community Church',
    shortName: 'NCC',
    url: 'https://wearencc.org',
    foundingYear: 1997,
    pastor: 'Rev. Anthony M. VanDyke',
    pastorTitle: 'Pastor and Founder',
    /** The church office line. The venue has its own number below. */
    phone: '(757) 338-3432',
    phoneE164: '+17573383432',
  },

  contact: {
    phone: '(948) 205-2934',
    phoneE164: '+19482052934',
    /** ASSUMPTION: the user wrote "faith@domain"; the venue domain is venueatncc.org. Change here if different. */
    email: 'faith@venueatncc.org',
    contactName: 'Faith',
  },

  /**
   * ASSUMPTION: the venue is on the New Community Church campus.
   */
  address: {
    street: '5112 Godwin Blvd',
    city: 'Suffolk',
    region: 'VA',
    regionName: 'Virginia',
    postalCode: '23434',
    country: 'US',
    /** OpenStreetMap and US Census geocoder, checked 2026-09-27. */
    geo: { lat: 36.8371166, lng: -76.5852516 },
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=New+Community+Church%2C+5112+Godwin+Blvd%2C+Suffolk%2C+VA+23434',
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=5112+Godwin+Blvd%2C+Suffolk%2C+VA+23434',
  },

  /** Communities in the market area. Used for local SEO copy and `areaServed` in structured data. */
  areaServed: [
    'Suffolk',
    'Chesapeake',
    'Portsmouth',
    'Norfolk',
    'Virginia Beach',
    'Smithfield',
    'Isle of Wight County',
    'Carrollton',
    'Windsor',
    'Hampton Roads',
  ],

  /** The bookable spaces. 'both' is offered as a request; the team confirms availability. */
  spaces: [
    {
      id: 'indoor',
      name: 'Indoor hall',
      description: 'The indoor event space at New Community Church.',
      capacity: 100,
    },
    {
      id: 'outdoor',
      name: 'Outdoor space',
      description: 'Open-air event space on the church grounds.',
      capacity: 150,
    },
  ] as Space[],

  /** The largest single-space capacity. Never add the spaces together; that is not confirmed. */
  maxCapacity: 150,

  policies: {
    /** Anyone can book. Membership is not required. */
    openToPublic: true,
    /** Alcohol is allowed. The venue has no alcohol rules of its own. */
    alcoholAllowed: true,
    /** Catering is not included. Hosts bring their own caterer or food. */
    cateringIncluded: false,
    /** On-site parking is included with every booking. */
    parkingIncluded: true,
  },

  /** What a booking includes. Only confirmed items. */
  included: ['The venue space you book', 'On-site parking'],

  /** What a booking does not include. Only confirmed items. */
  notIncluded: ['Catering, food, and drinks'],

  /**
   * Office hours for calls and visits (not event hours). Shown on /book/ only.
   * Leave empty until confirmed. Example: { days: 'Mon to Fri', hours: '10:00 AM to 4:00 PM' }
   */
  hours: [] as { days: string; hours: string }[],

  /** Social profiles for the venue. Added to the footer and to structured data. */
  social: [] as { label: string; url: string }[],

  /** How to book, as a real sequence. */
  bookingSteps: [
    {
      title: 'Pick your date',
      body: 'Check the calendar, choose your space, and see an instant estimate.',
    },
    {
      title: 'Send your request',
      body: 'Tell us about your event. It takes about two minutes.',
    },
    {
      title: 'We confirm',
      body: 'We follow up to confirm the date and details, then your date is reserved for you.',
    },
  ],
} as const;

export type Site = typeof site;

export const fullAddress = `${site.address.street}, ${site.address.city}, ${site.address.region} ${site.address.postalCode}`;
export const cityState = `${site.address.city}, ${site.address.regionName}`;
