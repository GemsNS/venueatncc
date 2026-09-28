# The Venue at NCC: brand and redesign spec

This document is the source of truth for the brand. It supersedes the visual parts of `hig-web-spec.md`
(colors, type, imagery). The interaction model from that spec still applies: floating tab bar on phones,
capsule buttons, Title Case button labels, sentence-case headings, 44px targets, dark mode, reduced motion,
glass only on navigation and floating controls, no em or en dashes anywhere in copy.

## Why the redesign

The owner reviewed the first build and rejected it. Two reasons, both binding:

1. **No decorative placeholder art.** The generated purple "arched window" scene is gone for good. Every image
   on the site is a real photograph of the property, or a clearly labeled styled concept of a real photo.
   No illustrations, no generated scenery, no arch-shaped masks, no decorative blobs or gradients standing in
   for content.
2. **It must read as a business.** The venue is a professional rental. Do not market permissive policies.
   Alcohol is never mentioned. Outside catering is not a selling point. See "Voice" below.

## Concept

**Photographs first, quiet frame.** The site is a gallery of the real property in a restrained white and
purple frame. Caslon headings give it the feel of a printed invitation; the interface stays crisp and
Apple-like. Spend boldness in one place: the full-bleed hero photograph of the building at blue hour.
Everything else is calm, generous, and aligned.

## Names

| Thing | Public name | Notes |
|---|---|---|
| The business | The Venue at NCC | Never "NCC Spaces" or "NCC Venues". |
| Indoor space | The Hall | Up to 100 guests. Data slug stays `indoor`. |
| Outdoor space | The Grove | Up to 150 guests. Data slug stays `outdoor`. |
| Both | The Hall and The Grove | Data slug stays `both`. Capacity copy: "The Hall up to 100, The Grove up to 150". |
| Parent | New Community Church | "The Venue at NCC is operated by New Community Church." |

Descriptors are fine next to names where clarity helps: "The Hall, our indoor space".

## Logo

Files live in `src/assets/brand/` (SVG, outlined paths, no font dependency):

| File | Use |
|---|---|
| `venue-lockup.svg` | Primary. Monogram roundel plus wordmark. Header, email, print. |
| `venue-lockup-white.svg` | On photos and on Deep Plum. |
| `venue-mark.svg` / `venue-mark-white.svg` | The monogram alone: avatars, admin sidebar, OG badge. |
| `venue-wordmark.svg` / `-white.svg` | Wordmark alone where the mark would repeat. |
| `ncc-mark.png` | Parent church seal. Only in the "operated by New Community Church" context. |

The monogram is a Caslon "V" inside a double ring that echoes the church's circular NCC seal. The wordmark
is "The Venue" in Libre Caslon Display with "at NCC" in Libre Caslon Text italic in Venue Purple.

Rules: minimum lockup height 32px on screen; clear space equal to the ring's inner radius; never recolor
outside the palette, stretch, add effects, or place the purple lockup on a photo (use the white one over a
dark scrim). The header uses `venue-lockup.svg` at 36 to 40px tall with `alt="The Venue at NCC"`.

Icons in `public/`: `favicon.ico` (16 and 32), `favicon.svg` (bold V on purple, for small sizes),
`favicon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
`public/brand/email-lockup.png` is the email header image (many email clients do not render SVG).

## Color

White and purple, as the owner asked. Purple is a deep, regal plum rather than an electric violet.

| Token | Light | Dark | Role |
|---|---|---|---|
| Venue Purple | `#4F2A75` | fill `#7C4DB0`, text `#CDB3EE` | Primary buttons, links, focus, selected states |
| Purple Pressed | `#3E2060` | `#6A3F9A` | Hover and pressed fills |
| Deep Plum | `#2B1840` | `#1A1024` | Footer, CTA band, dark scrims tinted toward brand |
| Lilac | `#CDB3EE` | `#CDB3EE` | Accent text and lines on Deep Plum or photos |
| Lilac Mist | `#F4F0F8` | `rgba(205,179,238,0.12)` | Tinted cards, selected rows, badges |
| Ink | `#1C1622` | `#F5F2F8` | Primary text |
| Ink 2 | `#5E5566` | `#B9B0C2` | Secondary text (7:1 on white) |
| Background | `#FFFFFF` | `#121015` | Page |
| Grouped | `#F7F5F9` | `#0C0A0E` | Grouped sections behind cards |
| Elevated | `#FFFFFF` | `#1C1820` | Cards |
| Separator | `rgba(28,22,34,0.12)` | `rgba(245,242,248,0.14)` | Hairlines |

Contrast checked: Venue Purple on white 10.9:1, Ink 2 on white 7.1:1, white on Deep Plum 16:1, Lilac on
Deep Plum 8.6:1, white on dark fill `#7C4DB0` 5.9:1. Map these onto the existing token names in
`src/styles/global.css` (`--accent`, `--accent-text`, `--accent-tint`, `--label`, `--label-2`, `--bg`,
`--bg-grouped`, `--bg-elevated`, `--separator`) so components keep working, and add `--brand-deep` and
`--lilac`. Status colors (success, warning, error) keep their system values.

No gradients as decoration. The only gradients allowed are legibility scrims over photographs.

## Type

| Role | Family | Notes |
|---|---|---|
| Display and page titles (h1, h2, hero) | Libre Caslon Display 400 | Only at 28px and above; hairlines get too thin below that. Never bold or faux-bold. Letter-spacing about -0.01em, line-height 1.05 to 1.15. |
| Serif text accents | Libre Caslon Text 400 and 400 italic | Lead statements, pull quotes, captions in italic, prices set large, serif labels between 18 and 28px. |
| Interface and body | The existing system stack (SF Pro on Apple, Inter fallback) | Body, h3 and smaller headings, buttons, forms, navigation, tables, admin. |

Self-host with `@fontsource/libre-caslon-display` (latin 400) and `@fontsource/libre-caslon-text` (latin 400
and 400 italic) as devDependencies, `font-display: swap`, and preload the Caslon Display woff2 used by the
hero headline. Keep the existing type tokens and their `min(..., vw)` caps; point h1, h2, `.t-display`,
`.t-large-title`, `.t-title-1`, and `.t-title-2` at the display family. The admin stays entirely in the
interface family except its brand name.

Avoid: italicizing or recoloring a single word inside a headline, all-caps labels, eyebrow labels above
every heading. One small kicker line is allowed in the home hero only.

## Shape, layout, motion

- Photos are rectangles with a modest radius (`--r-lg`, about 20px) or full bleed. No masks, no arches.
- Cards keep concentric radii. Capsule buttons. Glass only on the nav, the tab bar, and controls floating
  over photos (the hero date checker).
- Generous whitespace; left-aligned text blocks, max line length about 70 characters.
- Numbered markers only for real sequences (the booking steps).
- No entrance animations or scroll reveals. Hover and press feedback only.

## Photography

Only files in `src/assets/venue/`. Each exists as a 3:2 landscape (`name.jpg`, 2400px wide) and a 4:5
portrait (`name-tall.jpg`, 1600px wide) for art direction on phones.

| File | Subject | Primary uses |
|---|---|---|
| `exterior-dusk` | The building at blue hour, lit entry, white cross on the gable, pines behind | Home hero, About |
| `approach-dusk` | Long paved drive and lawn toward the building at dusk | Arrival and location band, parking |
| `driveway` | Wide paved drive and lot in daylight | Parking, campus |
| `gable` | Stucco gable with the white cross and arched windows | About, church relationship |
| `hall-windows` | The Hall: arched windows, fireplace feature wall, wood-look floor | The Hall primary, showers, receptions |
| `hall-fireplace` | The Hall toward the windows and fireplace wall | Receptions and banquets, repasts |
| `hall-doors` | The Hall: double doors, wall-mounted screen, arched windows | Meetings, birthdays |
| `grove-tables` | The Grove: gazebo and picnic tables on a paved patio under pines | The Grove primary, reunions |
| `gazebo` | The Grove: timber gazebo with a metal roof on open lawn | Weddings, ceremonies |
| `grove-path` | The Grove: paved path to the gazebo through the trees | Church and community events |

Describe only what the photos show. The Hall: arched windows, a fireplace feature wall, dark wood-look
floors, recessed lighting, double doors. The Grove: a timber gazebo, picnic tables on a paved patio, open
lawn, tall pines, paved paths. The campus: a long paved drive and a large paved lot. Do not claim a kitchen,
sound system, stage, bridal suite, tables and chairs for rent, or anything else not confirmed.

The sanctuary is not part of the rental and is not shown.

### Styled concepts (virtual staging)

Some photos may gain a styled version generated from the real photo (furniture, linens, florals, lighting
added; architecture unchanged). Rules:

- File name `styled-<base>-<scene>.jpg`, with a `photoDetails` entry `{ styledOf: '<base>.jpg', ... }`.
- Always shown with a visible "Styled Concept" badge on the image and the caption "Styled concept. Décor
  shown is not included with the rental." The alt text starts with "Styled concept:".
- Presented as an opt-in view: a segmented control "As Photographed" and "Styled Concept" on The Hall and
  The Grove cards and galleries. The real photo is the default. Render the control only when a styled
  version exists.
- Never used as a hero, OG image, or the only image of a space.

## Voice

Professional hospitality: confident, warm, precise, brief. The venue speaks in the first person plural
("we confirm every booking personally"); guidance is second person ("choose a date"). No exclamation
points, slang, or jokes.

**Never in public copy** (pages, data, booking UI, emails, structured data, llms.txt, OG text, demo
content): alcohol, drinks, bar, beer, wine, mimosas, toast, "raise a glass", Virginia ABC, BYO,
"bring your own", "your own caterer", "caterer of your choice", "the freedom to", "your menu, your way",
and advice to "ask whether there is a kitchen". Do not collect alcohol plans in the booking form.

**Catering** appears exactly twice, neutrally: in the pricing page's rental terms ("Catering and décor are
arranged separately by the client.") and in one FAQ entry ("Is catering provided? Rentals include the
space and on-site parking. Food service is arranged separately."). Nowhere else: not in the hero, fact
rows, feature tiles, event pages, booking form, estimate notes, schema, or llms.txt.

**Open to the public** appears as a plain fact where booking eligibility matters (FAQ, about), not as a
tagline. "Anyone can book" is not used as a headline.

Useful facts to lead with: two distinct spaces, capacities, on-site parking, transparent rates with an
instant estimate, dates confirmed personally, a wooded setting minutes from downtown Suffolk.

## Page direction

**Home.** (1) Full-bleed hero, `exterior-dusk` (tall crop below 46.5rem), height about min(88svh, 56rem),
bottom-left scrim for legibility. Kicker "Event venue in Suffolk, Virginia"; H1 "Celebrate among the
pines."; one-sentence lead naming The Hall for 100, The Grove for 150, and on-site parking; "Check
Availability" filled and "Tour the Space" secondary. The date checker floats as a glass panel at the
bottom right from 64rem, and sits below the hero otherwise. (2) A short Caslon Text statement about the
venue with three plain facts. (3) The two spaces as large photo cards with capacity, a sentence, three real
features, and a link. (4) Events hosted, as photo tiles. (5) Rates teaser linking to pricing. (6) How
booking works, three numbered steps. (7) Arrival band with `approach-dusk`, address, directions link.
(8) Four FAQs. (9) CTA band on Deep Plum.

**The Space.** Hero on `hall-windows`. Sections for The Hall and The Grove, each with a small gallery of
its photos, capacity, real features, and the styled-concept toggle when available. A Campus section with
`approach-dusk`, `driveway`, `gable` and parking. What the rental includes (the space you book and
on-site parking) and a visit request CTA.

**Events.** Index as photo tiles. Each event page: rectangular photo hero from the photo map, rewritten
professional copy, a planning checklist that contains only practical venue items (date, space, guest
count, visit, timeline), and neutral FAQs.

**Pricing, FAQ, About, Book, 404.** Same frame and type. Pricing keeps the estimator and tables; its
included list is "The space you book" and "On-site parking"; the rental terms carry the one catering line.

**Admin.** Interface family throughout; the sidebar shows the monogram and "The Venue at NCC".

**Share images.** Photo background with a dark scrim, the white lockup, and the page title in Caslon.

**Emails.** `email-lockup.png` header on white, a thin Venue Purple rule, Georgia as the serif fallback
for headings, the interface stack for body text.
