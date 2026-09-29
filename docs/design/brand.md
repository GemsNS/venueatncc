# The Venue at NCC: brand and redesign spec (version 3)

This document is the source of truth for the brand. It supersedes the visual parts of `hig-web-spec.md`
(colors, type, imagery). The interaction model from that spec still applies: floating tab bar on phones,
capsule buttons, Title Case button labels, sentence-case headings, 44px targets, dark mode, reduced motion,
glass only on navigation and floating controls, no em or en dashes anywhere in copy.

## What changed in versions 2 and 3, and why

The owner reviewed version 1 and asked for four things. All are binding.

1. **New palette.** Version 3 uses the client's blue palette: `#012A4A`, `#013A63`, `#01497C`, `#014F86`,
   `#2A6F97`, `#2C7DA0`, `#468FAF`, `#61A5C2`, `#89C2D9`, `#A9D6E5`
   (coolors.co/palette/012a4a-013a63-01497c-014f86-2a6f97-2c7da0-468faf-61a5c2-89c2d9-a9d6e5). It replaces the
   version 2 sage, cream, and caramel palette, which replaced version 1's white and purple. Neither earlier
   palette appears anywhere.
2. **One photo system.** Mixing real and AI-staged photos "seemed random and sloppy." There is now one rule,
   described under Photography, and it is enforced in code.
3. **No redundancy.** Every page is audited so facts, calls to action, sections, and photos are not repeated.
4. **The venue is a separate business from New Community Church.** Nothing on the site, in the brand, in
   structured data, emails, or share images connects the two.

Still binding from version 1: no decorative placeholder art; a professional business voice; never mention
alcohol; catering only in the two neutral places listed under Voice.

## Concept

**Photographs first, in a crisp, quiet frame.** The site is a gallery of the real property set in white and
navy with sky-blue accents. Caslon headings give it the feel of a printed invitation; the interface stays crisp
and Apple-like. Spend boldness in one place: the full-bleed hero photograph of the building at blue hour, whose
dusk sky already belongs to this palette.

Avoid the tells of a templated site: no accent bars or rails on cards, no eyebrow labels above headings (the
single hero kicker is the only exception), no tinted or decorative gradients, no all-caps labels. The light
blues (Sky, Mist, Ice) appear only as surfaces, chips, and accents on Navy, never as text on white.

## Names

| Thing | Public name | Notes |
|---|---|---|
| The business | The Venue at NCC | Stand-alone business. Never "NCC Spaces" or "NCC Venues". |
| Indoor space | The Hall | Up to 100 guests. Data slug stays `indoor`. |
| Outdoor space | The Grove | Up to 150 guests. Data slug stays `outdoor`. |
| Both | The Hall and The Grove | Data slug stays `both`. |
| The land around them | The grounds | Replaces "campus", which reads as a church campus. |

## Separation from New Community Church

The venue shares a property with a church but is its own business. Remove and never reintroduce:
"operated by New Community Church", the church seal (`ncc-mark.png`), church history, founding year, pastor,
church phone, `site.parent`, `parentOrganization` in JSON-LD, links to wearencc.org, "at New Community Church"
in location copy, membership questions, and the demo inquiries that reference a church ("Church family day").
The `church-community-events` event becomes `community-events` ("Community events": nonprofit, civic, faith,
and neighborhood gatherings hosted by clients). A discount that names churches as a kind of customer is fine;
that is not a connection to this church. Copy advising a family to "coordinate with your pastor" refers to the
client's own clergy and is fine.

The cross on the building is part of the property and may appear in photos of the building, but no photo
features it as the subject: `gable.jpg` is removed from the site.

## Logo

Files in `src/assets/brand/` (outlined SVG, no font dependency). A Caslon "V" inside a double ring, with
"The Venue" in Libre Caslon Display and "at NCC" in Libre Caslon Text italic. The ring frames the monogram the
way a wax seal or an embossed invitation mark would.

| File | Colors | Use |
|---|---|---|
| `venue-lockup.svg` | ink Navy `#012A4A`, accent Steel `#2A6F97` | Header, email, print on light surfaces |
| `venue-lockup-white.svg` | white `#FFFFFF`, accent Mist `#89C2D9` | On Navy and over photos |
| `venue-mark.svg` / `-white.svg` | as above | Monogram alone: admin sidebar, avatars |
| `venue-wordmark.svg` / `-white.svg` | as above | Wordmark alone |

`src/components/Logo.astro` recolors the SVG through CSS variables by matching these exact hex values
(`#012A4A` ink, `#2A6F97` accent, `#FFFFFF` light ink, `#89C2D9` light accent). Minimum lockup height 32px.
Over photos use the light lockup on a Navy scrim. Icons in `public/`: favicon.ico, favicon.svg, favicon-32.png,
apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png (Navy with a white monogram);
`public/brand/email-lockup.png` is the email header.

## Color

The ten palette blues are the brand. The palette has no white and no muted text color, so three neutrals are
derived from it: white for the page and cards, a pale Frost tint of Ice for alternate sections, and a Slate for
secondary text. Nothing else is added.

| Token | Hex | Role |
|---|---|---|
| Navy | `#012A4A` | Primary text; footer, closing band, photo scrims, favicon; text on light-blue chips |
| Harbor | `#013A63` | Hover and pressed state of primary buttons |
| Deep Blue | `#01497C` | Primary button fill (white text), links and accent text on white, selected states |
| Marine | `#014F86` | Alternative link hover |
| Steel | `#2A6F97` | Logo accent, icons, secondary accents |
| Lake | `#2C7DA0` | Focus ring, active indicators (non-text, 4.6:1 on white) |
| Bay | `#468FAF` | Decorative only: hairlines on Navy, illustrations of state |
| Sky | `#61A5C2` | Primary button fill in dark mode (Navy text) |
| Mist | `#89C2D9` | Accent text and lockup accent on Navy; badges on dark |
| Ice | `#A9D6E5` | Chips, capacity tags, selected rows (Navy text) |
| White (derived) | `#FFFFFF` | Page background and cards |
| Frost (derived) | `#EEF6F9` | Alternate section background, quiet panels |
| Slate (derived) | `#3E5A6D` | Secondary text |

Contrast (checked): Navy on white 14.7:1, Slate on white 7.3:1, Slate on Frost about 6.6:1, Deep Blue on white
9.4:1, white on Deep Blue 9.4:1, white on Navy 14.7:1, Ice on Navy 9.4:1, Mist on Navy 7.5:1, Navy on Ice 9.4:1,
Navy on Sky 5.4:1. Never set Sky, Mist, Ice, or Bay as text on white, and never put white text on Sky or lighter.

Dark mode: page Night `#011A2E`, grouped `#010F1C`, cards `#022640`, text `#EAF4F8`, secondary Ice
`#A9D6E5`, primary button Sky `#61A5C2` with Navy text, accent text Mist `#89C2D9` (9.1:1 on Night),
separators `rgba(234,244,248,0.14)`. Map everything onto the existing token names in `global.css`; rename the
version 2 palette tokens (`--olive-deep`, `--caramel`, `--caramel-deep`, `--sage`, `--mist`, `--linen`,
`--on-deep-accent` and similar) to version 3 names and update every use. Photo scrims use Navy.

## Type

Unchanged from version 1: Libre Caslon Display for h1, h2 and display sizes from 28px; Libre Caslon Text for
serif leads, prices, and italic captions; the system interface stack for body, forms, buttons, tables, admin.

## Photography

### The rule

- **Real photographs show the spaces.** Everything that shows what a client rents uses real photos only: the
  home hero, the home space cards, The Space page, the arrival band, share images, and structured data.
- **Staged photographs show events.** Every event tile and every event page hero uses a staged image of that
  event, all eight in one décor style, each with the same small "Styled Concept" badge. The events section on
  the home page and the /events/ page carry one line: "Event photos show our spaces styled for each occasion.
  Décor is not included." Event page heroes carry the caption "Styled concept. Décor is not included."
- **All or nothing.** If a staged image is missing for any event, no staged image is shown: each event page hero
  shows the real photo its staged image is made from, with no badge or caption, event tiles show no photo, and
  the one-line note is hidden. This is computed in `src/data/photos.ts` from which files exist, so a
  half-staged grid can never ship, and a grid of eight real photos (which would repeat rooms) never appears.
- **No toggles.** The As Photographed / Styled Concept switches are removed everywhere.
- **No repeats.** No image appears twice on the same page.

### Real photos (in `src/assets/venue/`, each as 3:2 `name.jpg` and 4:5 `name-tall.jpg`)

| File | Subject | Uses |
|---|---|---|
| `exterior-dusk` | The building at blue hour, lit entry, pines behind | Home hero |
| `approach-dusk` | The long drive and lawn toward the building at dusk | Arrival band, The grounds |
| `driveway` | The paved drive and lot in daylight | Parking, The grounds |
| `hall-windows` | The Hall: arched windows, fireplace wall, wood-look floor | The Hall primary |
| `hall-fireplace` | The Hall toward the windows and fireplace wall | The Hall gallery |
| `hall-doors` | The Hall: double doors, wall-mounted screen, arched windows | The Hall gallery |
| `grove-tables` | The Grove: gazebo and picnic tables on the patio | The Grove primary |
| `gazebo` | The timber gazebo on open lawn | The Grove gallery |
| `grove-path` | The paved path to the gazebo through the trees | The Grove gallery |

Describe only what the photos show. Do not claim a kitchen, sound system, stage, bridal suite, rentable tables
or chairs, Wi-Fi, or AV unless phrased as "ask us". The sanctuary is not part of the rental and is not shown.

### Staged event photos

File `styled-event-<slug>.jpg` with a `photoDetails` entry `{ styledOf: '<real base>.jpg', event: '<slug>' }`.
One décor language across all eight: ivory and cream linens, sage eucalyptus and greenery, natural wood or
cream chairs, amber candlelight, ivory, peach, and soft caramel blooms. The set was made during version 2; its
neutral, natural styling sits well with the blue palette, so it is kept. Architecture,
windows, doors, floors, fixtures, the gazebo, and trees stay exactly as photographed.

| Event slug | Base | Scene |
|---|---|---|
| `weddings` | gazebo | Ceremony seating facing the gazebo |
| `receptions-banquets` | hall-windows | Formal reception rounds and a head table |
| `baby-bridal-showers` | hall-fireplace | Shower brunch tables and a dessert table |
| `birthday-parties` | hall-windows (fireplace corner crop) | Milestone dinner party |
| `repasts-memorials` | hall-doors (window corner crop) | Quiet rounds and a guest book table |
| `meetings-trainings` | hall-doors | Classroom seating facing the screen |
| `graduations-reunions` | grove-tables | Picnic tables dressed, lanterns, string lights |
| `community-events` | grove-path | An outdoor community gathering on the lawn |

## Redundancy rules

- State each fact once per page, in the place it does the most work. Capacities belong to the space cards and
  The Space; the hero names the two spaces without repeating numbers already shown a scroll later.
- One primary call to action per viewport. The header CTA plus one in-page CTA near the end of the page is
  enough; do not stack Check Availability buttons in hero, steps, band, and footer.
- A block that repeats across many pages (planning timelines, rates and deposit paragraphs, "how booking
  works") lives in one place and is linked, not copied.
- Footer navigation does not duplicate the header navigation item for item.
- A section that only restates another page (for example a home FAQ that repeats /faq/) earns its place only if
  it answers something the visitor needs before scrolling on; otherwise it is cut.

## Voice

Professional hospitality: confident, warm, precise, brief. "We" for the venue, "you" for guidance. No
exclamation points, slang, or jokes. Never in public copy: alcohol, drinks, bar, beer, wine, mimosas, toast,
"raise a glass", Virginia ABC, BYO, "bring your own", "your own caterer", "caterer of your choice", "the freedom
to", advice to "ask whether there is a kitchen", and any connection to New Community Church. Catering appears
exactly twice, neutrally: the pricing page's rental terms and one FAQ entry.

## Page direction

**Home.** Full-bleed `exterior-dusk` hero (the phone layout shows the photo first with the text on a Navy
panel below), kicker, "Celebrate among the pines.", one lead sentence, one primary button; the date checker.
Then the two spaces as real-photo cards, events as staged tiles with the one-line note, a short rates teaser,
the arrival band, and one closing band. Cut anything the audit finds repeated.

**The Space.** Real photos only. The Hall, The Grove, and The grounds (formerly Campus), what the rental
includes, and a visit request.

**Events.** Staged hero per event with badge and caption, the event's unique copy, and links to shared
information instead of repeated blocks.

**About.** Without the church story the page has little of its own; fold any unique, useful content into The
Space or FAQ and remove the page and its nav item unless the audit finds a clear reason to keep it.

**Share images.** Real photo background, Navy scrim, light lockup, page title in Caslon, secondary line in Ice.

**Emails.** `email-lockup.png` header on white, a thin Steel rule, Deep Blue links and button (white text),
Navy text, Georgia for headings, the interface stack for body text.
