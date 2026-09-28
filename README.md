# The Venue at NCC website

Promotional website for **The Venue at NCC** (venueatncc.org), the event space of
[New Community Church](https://wearencc.org) at 5112 Godwin Blvd, Suffolk, VA 23434.

Built with [Astro](https://astro.build) as a fully static site: fast, cheap to host, and easy for
search engines to read.

## Quick start

```sh
npm install
npm run dev       # local preview at http://localhost:4321
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

Requires Node 22.12 or newer.

## Where things live

| What | File |
| --- | --- |
| Every fact about the venue (address, phone, rooms, capacity, amenities, rates, hours, social links) | `src/data/site.ts` |
| Event types and the copy for each event landing page | `src/data/events.ts` |
| Questions and answers | `src/data/faq.ts` |
| Photos of the space | `src/assets/venue/` plus optional details in `src/data/photos.ts` |
| Colors, type, and shared styles | `src/styles/global.css` |
| Pages | `src/pages/` |

### The one rule: facts live in `site.ts`

Anything not yet confirmed is `null` or an empty list in `src/data/site.ts`, and the site hides it.
Fill a field in and it appears everywhere it belongs, including search-engine structured data.
For example, add a room with its capacity to `spaces` and it shows up on the space page, and
`maximumAttendeeCapacity` is added to the venue's schema.org markup.

Unanswered questions in `src/data/faq.ts` (those with `a: null`) are a to-do list. Answer one and it
is published on /faq/ and in the FAQ structured data.

Two things in the data are assumptions to confirm:

- **The address.** The venue is assumed to be on the church campus at 5112 Godwin Blvd.
- **The event types.** The eight event pages in `src/data/events.ts` are the kinds of events the
  venue is assumed to host. Delete any entry the venue does not want, and its page and links disappear.

`hours` in `site.ts` means office hours for calls and walkthroughs. They show on /book/ only and are
deliberately not published as the venue's opening hours in structured data.

## Adding photos

Every image in `src/assets/venue/` is published, so keep reference-only images out of that folder.

1. Copy photos into `src/assets/venue/`. Use full-size originals, at least 1600px on the long edge.
   The build crops each one to the arch shape, resizes it, and converts it to AVIF and WebP.
2. Name files descriptively, for example `fellowship-hall-reception-tables.jpg`. The name becomes the
   fallback alt text. Camera names like `IMG_1234.jpg` get a generic description instead.
3. Describe and place each photo in `src/data/photos.ts`:

```ts
export const photoDetails = {
  'fellowship-hall-reception-tables.jpg': {
    alt: 'Round tables set for a reception in the fellowship hall',
    caption: 'Reception setup',
    tags: ['hero', 'weddings'],
    crop: 'center', // or 'top', 'bottom', 'left', 'right', 'attention'
  },
};
```

Tags: `hero` (home page arch), `space` (home page photo row), `about` (about page), or any event
slug such as `weddings` or `repasts-memorials` (that event page). `crop` picks which part of a
photo stays inside the arch. In the gallery, each photo links to its full, uncropped version.

The build warns about photos under 1600px, photos with no description, and descriptions for
files that do not exist.

Until photos, rooms, or amenities exist, arches show an illustrated window, and /the-space/ is set to
`noindex` and left out of the sitemap so search engines do not index a thin page. Adding the first
photo, room, or amenity lifts both.

## Turning on the inquiry form

The form is hidden until it has somewhere to send messages. Visitors are asked to call instead.

1. Create a free form endpoint with a service such as [Formspree](https://formspree.io) or
   [Web3Forms](https://web3forms.com), pointed at the inbox that should receive inquiries.
2. In `src/data/site.ts`, set `contact.formEndpoint` to the endpoint URL. For Web3Forms, also set
   `contact.formHiddenFields` to `{ access_key: 'your-key' }`.
3. Rebuild. The form appears on /book/ and on every event page.

If the venue gets its own email address, set `contact.email` and it appears site-wide.

## SEO built in

- Unique title and meta description on every page, canonical URLs, and trailing-slash consistency.
- JSON-LD structured data: `EventVenue` + `LocalBusiness` with address, phone, and geo coordinates,
  the parent church as `Organization`, breadcrumbs, `FAQPage`, and a `Service` per event type.
- A landing page per event type, targeting local searches such as "repast venue Suffolk VA".
- A branded Open Graph share image generated for every page at build time (`/og/*.png`).
- `sitemap-index.xml`, `robots.txt`, and `/llms.txt` (a plain summary for AI assistants), all
  generated from the same data as the pages.
- Self-hosted fonts with preloading, responsive modern image formats, and almost no JavaScript,
  for strong Core Web Vitals.

## Going live

venueatncc.org currently points to a GoDaddy Website Builder page. To publish this site instead:

1. Host the `dist/` folder on a static host. Netlify, Cloudflare Pages, and GitHub Pages all work
   and are free at this size. Build command `npm run build`, output directory `dist`.
2. Point the domain's DNS at the new host, following the host's custom-domain instructions,
   and cancel the Website Builder site once the new one is live. Keep the host's redirects from
   `www.venueatncc.org` to `venueatncc.org` and from http to https turned on.
3. In [Google Search Console](https://search.google.com/search-console), verify the domain and
   submit `https://venueatncc.org/sitemap-index.xml`. The old site advertised `/sitemap.xml`; that URL
   still works and points to the new sitemap, but remove it from Search Console if it was submitted there.
4. Create or claim a Google Business Profile for The Venue at NCC with exactly the same name,
   address, and phone as the site. This matters as much as the website for local search.
5. Link to venueatncc.org from wearencc.org.

`public/_headers` sets long-lived caching for fingerprinted assets on Netlify and Cloudflare Pages.
