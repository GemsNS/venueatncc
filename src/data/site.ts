/**
 * The single source of truth for facts about The Venue @ NCC.
 *
 * Every page, the booking wizard, the API server, and the structured data (JSON-LD) read from here.
 * Anything not confirmed is left as `null` or `[]`, and the site hides it.
 *
 * Confirmed by the venue team on 2026-09-28:
 *   phone, email (assumed domain, see contact.email), indoor capacity 100, outdoor capacity 150,
 *   open to anyone, catering not included (the rental is the space and parking), parking included.
 * Space names confirmed for the brand on 2026-09-28: The Hall (indoor) and The Grove (outdoor).
 * From the owner's copy, 2026-09-30: The Main Hall, a multi-purpose auditorium with stage seating, up to
 *   100 guests (the same as the indoor limit); the amenities; building access Monday to Saturday,
 *   9:00 AM to 12:00 midnight; a reservation and a non-refundable deposit hold a date; the contact
 *   person, Faith VanDyke.
 * Palette: bright, white-first pastel pink, light only: White, Peony, Cerise, and Plum (docs/design/brand.md, version 6).
 * Confirmed from OpenStreetMap and the US Census geocoder on 2026-09-27: address and geo coordinates.
 *
 * The venue is its own business. Nothing here, or anywhere on the site, connects it to another
 * organization (brand.md, "Separation").
 * The tagline is the brand line from docs/design/brand.md: the slogan in structured data (the footer no
 * longer shows it). The home page headline is the welcome, "Welcome to The Venue @ NCC" (version 4).
 *
 * Rates live in src/shared/pricing.ts.
 */
import { ACCESS_DAYS, ACCESS_TIMES } from '../shared/booking-rules';

/** A single bookable space. The combined choice, The Hall and The Grove, is 'both' in src/shared/types.ts. */
export type SpaceId = 'indoor' | 'main' | 'outdoor';

export interface Space {
  id: SpaceId;
  /** Public name, e.g. 'The Hall'. */
  name: string;
  /** Name without the article, for tight labels, e.g. 'Hall'. */
  short: string;
  /** One plain sentence. Do not describe finishes or features that are not confirmed. */
  description: string;
  /** Maximum guests. */
  capacity: number;
}

export const site = {
  name: 'The Venue @ NCC',
  shortName: 'The Venue',
  /** The brand line. Feeds the slogan in the venue structured data. */
  tagline: 'Celebrate among the pines',
  url: 'https://venueatncc.org',
  locale: 'en_US',

  /** Default description used when a page does not set its own. */
  description:
    'The Venue @ NCC in Suffolk, Virginia, offers indoor and outdoor event rentals: The Hall and The Main Hall for up to 100 guests each, and The Grove for up to 150.',

  contact: {
    phone: '(948) 205-2934',
    phoneE164: '+19482052934',
    /** ASSUMPTION: the user wrote "faith@domain"; the venue domain is venueatncc.org. Change here if different. */
    email: 'faith@venueatncc.org',
    /** The contact person, named on /pricing/ (Rates & FAQ) and in the guest email. */
    contactName: 'Faith VanDyke',
  },

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
      'https://www.google.com/maps/search/?api=1&query=5112+Godwin+Blvd%2C+Suffolk%2C+VA+23434',
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=5112+Godwin+Blvd%2C+Suffolk%2C+VA+23434',
  },

  /**
   * Places the venue serves, for `areaServed` in structured data (src/lib/schema.ts).
   * Structured data must match visible content, so list only places the pages actually name.
   * Add a town here only after it appears in page copy.
   */
  areaServed: [
    { name: 'Suffolk, Virginia', type: 'City' },
    { name: 'Hampton Roads', type: 'AdministrativeArea' },
  ] as { name: string; type: 'City' | 'AdministrativeArea' }[],

  /**
   * The bookable spaces, in the order the site lists them. The Hall and The Grove can also be requested
   * together ('both'); the team confirms availability.
   */
  spaces: [
    {
      id: 'indoor',
      name: 'The Hall',
      short: 'Hall',
      description: 'An indoor room with arched windows, a fireplace feature wall, and dark wood-look floors.',
      capacity: 100,
    },
    {
      id: 'main',
      name: 'The Main Hall',
      short: 'Main Hall',
      description: 'A multi-purpose auditorium with stage seating, a raised stage, and a vaulted ceiling.',
      capacity: 100,
    },
    {
      id: 'outdoor',
      name: 'The Grove',
      short: 'Grove',
      description: 'An outdoor setting among tall pines, with a timber gazebo and picnic tables on a patio.',
      capacity: 150,
    },
  ] as Space[],

  /** The largest single-space capacity. Never add the spaces together; that is not confirmed. */
  maxCapacity: 150,

  policies: {
    /** Anyone can book. Membership is not required. */
    openToPublic: true,
    /** The rental is the space and on-site parking. Catering is not part of it. */
    cateringIncluded: false,
    /** On-site parking is included with every booking. */
    parkingIncluded: true,
  },

  /**
   * What a booking includes. Only confirmed items. Tables and chairs come with the rental, and clients may
   * use them if they wish (owner, September 30, 2026). Catering is not listed as an exclusion here: brand.md
   * allows it only in one neutral FAQ entry.
   */
  included: ['The space you book', 'Tables and chairs to use as you wish', 'On-site parking'],

  /**
   * The owner's premium amenities, shown once, on The Space, and in structured data (amenityFeature).
   * The owner titled the third "Flexible layouts and catering"; catering stays in its one FAQ entry
   * (brand.md, Voice), so here it reads as kitchen access.
   */
  amenities: [
    { name: 'Ballroom seating', detail: 'Ideal for formal occasions and special events.' },
    { name: 'Hospitality areas', detail: 'Private rooms for families and wedding parties.' },
    {
      name: 'Flexible layouts',
      detail: 'Customizable banquet arrangements with kitchen access, and outdoor grounds for large community gatherings.',
    },
  ] as { name: string; detail: string }[],

  /**
   * Building access for events, confirmed by the owner. The booking rules that enforce it live in
   * src/shared/booking-rules.ts. Stated once, on /pricing/ (Rates & FAQ, #hours).
   */
  access: { days: ACCESS_DAYS, hours: ACCESS_TIMES },

  /** How a date is held. No amount is published (brand.md, owner decision 5). */
  depositPolicy: 'A reservation and a non-refundable deposit are required to hold your date.',

  /**
   * Office hours for calls and visits (not event hours). Shown on /book/ only.
   * Leave empty until confirmed. Example: { days: 'Mon to Fri', hours: '10:00 AM to 4:00 PM' }
   */
  hours: [] as { days: string; hours: string }[],

  /** Social profiles for the venue. Added to the footer and to structured data. */
  social: [] as { label: string; url: string }[],
} as const;

export type Site = typeof site;

export const fullAddress = `${site.address.street}, ${site.address.city}, ${site.address.region} ${site.address.postalCode}`;
export const cityState = `${site.address.city}, ${site.address.regionName}`;
