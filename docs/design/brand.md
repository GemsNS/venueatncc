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

Later owner decisions, also binding:

5. **No published prices.** No dollar amounts, rate tables, packages, estimates, deposit or fee amounts,
   discounts with amounts, or `priceRange` and `Offer` prices appear on any public page, booking step, guest
   email, share image, structured data, or llms.txt. Where rates come up, use the approved wording exactly:
   "Our affordable rates vary with peak season, holidays, and the day of the week. For pricing and special
   offers, please call us and we will be happy to help you." (`RATES_WORDING` in `src/data/faq.ts`), with the
   phone (948) 205-2934 (`tel:+19482052934`). The rate card in `src/shared/pricing.ts` is internal: it feeds
   the team email and the admin CRM as an "Internal rate-card guide", and the public inquiry API never returns
   it. A deposit is named only in the one FAQ entry on payments, with no figure; the wizard and the guest email
   say we send the quote "with the payment terms for your date".
6. **Rates is an inquiry page.** `/pricing/` (labelled "Rates" everywhere) gives the approved wording, a Call
   button, and an inquiry form with specific booking choices that posts to the site's own inquiry API, the same
   one the booking wizard uses, so every inquiry lands in the admin CRM. The demo build posts to the in-browser
   demo backend. No third-party form services.
7. **Lighter tones.** The site felt too dark. In light mode no large surface is Navy; see Color.

Still binding from version 1: no decorative placeholder art; a professional business voice; never mention
alcohol; catering only in the one neutral FAQ entry named under Voice.

## Concept

**Photographs first, in a crisp, quiet frame.** The site is a gallery of the real property set in white and
navy with sky-blue accents. Caslon headings give it the feel of a printed invitation; the interface stays crisp
and Apple-like. Spend boldness in one place: the full-bleed hero photograph of The Grove, the timber gazebo under
tall pines, whose blue sky between the trunks already belongs to this palette.

Avoid the tells of a templated site: no accent bars or rails on cards, no eyebrow labels above headings (the
single hero kicker is the only exception), no tinted or decorative gradients, no all-caps labels. The light
blues (Sky, Mist, Ice) appear only as surfaces, tints, chips, and accents on Navy (the hero scrim and dark
mode), never as text on white.

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
| `venue-lockup.svg` | ink Navy `#012A4A`, accent Steel `#2A6F97` | Header, footer, email, print on light surfaces |
| `venue-lockup-white.svg` | white `#FFFFFF`, accent Mist `#89C2D9` | Over photos and on share images |
| `venue-mark.svg` / `-white.svg` | as above | Monogram alone: admin sidebar, avatars |
| `venue-wordmark.svg` / `-white.svg` | as above | Wordmark alone |

`src/components/Logo.astro` recolors the SVG through CSS variables by matching these exact hex values
(`#012A4A` ink, `#2A6F97` accent, `#FFFFFF` light ink, `#89C2D9` light accent). Minimum lockup height 32px.
Over photos use the light lockup on a Navy scrim. Icons in `public/`: favicon.ico, favicon.svg, favicon-32.png,
apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png (Navy with a white monogram);
`public/brand/email-lockup.png` is the email header.

## Color

The ten palette blues are the brand. The palette has no white and no muted text color, so neutrals are
derived from it: white for the page and cards, a pale Frost tint of Ice for alternate sections and the footer,
a light Ice tint for the closing band, and a Slate for secondary text. Nothing else is added.

**Light by default.** The owner found the site too dark, so in light mode every large surface is light: White,
Frost, or the Ice tint. Navy is for text, buttons, and small accents, and for the scrim over the home hero's
photo on wider screens; it is never a large surface. Specifically:

- **Footer:** Frost with a top hairline (`--separator`), a Navy "Visit and contact" heading, Slate text,
  Deep Blue links, and the Navy-ink lockup (`Logo` tone `auto`, not the white artwork).
- **Closing band (CtaBand):** the Ice tint `#D8ECF3` with a top hairline, a Navy heading, a Slate sentence, and
  the standard Deep Blue Check Availability button with a white label.
- **Home hero on phones:** the photo stands alone with nothing over it, and the copy follows on a Frost panel
  (Deep Blue kicker, Navy title, Slate lead) above the date checker. The same panel serves short screens and
  larger text.
- **Home hero from tablets up:** the copy stays over the photo on a Navy scrim, as light as the brightest sky
  allows: 70% at the top easing to 64% a third of the way down, then a soft fade above the gazebo's roof. From
  64rem the scrim also fades to 30% of that strength past the end of the copy, so the pines show through
  beside the header's call to action. Measured at the worst pixel under each line of white copy (768 to 2560
  wide), the kicker, title, and lead all hold 4.7:1 or better in light mode and 5.2:1 in dark mode. Do not
  lighten the scrim without measuring again.
- **Alternate sections:** Frost, never a grey-blue.
- **Styled Concept badge:** near-white glass with a Navy label in light mode; the Navy tint with a white label
  in dark mode.

| Token | Hex | Role |
|---|---|---|
| Navy | `#012A4A` | Primary text; photo scrims, favicon; text on light-blue chips; footer and closing band in dark mode only |
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
| Frost (derived) | `#EEF6F9` | Alternate section background, quiet panels, the footer, the home hero's phone panel |
| Ice tint (derived) | `#D8ECF3` | The closing band (Ice at 45% over white) |
| Slate (derived) | `#3E5A6D` | Secondary text |

Contrast (checked): Navy on white 14.7:1, Slate on white 7.3:1, Slate on Frost about 6.6:1, Deep Blue on white
9.4:1, Deep Blue on Frost 8.5:1, Navy on Frost 13.4:1, white on Deep Blue 9.4:1, white on Navy 14.7:1, Ice on
Navy 9.4:1, Mist on Navy 7.5:1, Navy on Ice 9.4:1, Navy on the Ice tint 12.0:1, Slate on the Ice tint 6.0:1,
Deep Blue on the Ice tint 7.7:1, Navy on Sky 5.4:1. Never set Sky, Mist, Ice, or Bay as text on white, and never
put white text on Sky or lighter. The tertiary label (`--label-3`, `#56707F`) is not used on the Ice tint,
where it falls to 4.3:1.

Dark mode: page Night `#011A2E`, grouped `#010F1C`, cards `#022640`, text `#EAF4F8`, secondary Ice
`#A9D6E5`, primary button Sky `#61A5C2` with Navy text, accent text Mist `#89C2D9` (9.1:1 on Night),
separators `rgba(234,244,248,0.14)`. Dark mode stays dark but no heavier than before: the footer, the closing
band, and the home hero's phone panel stay Navy, a step lighter than Night, and the footer and band each
start with a hairline (tokens `--footer-bg` and `--band`). Map everything onto the existing token names in `global.css`; rename the
version 2 palette tokens (`--olive-deep`, `--caramel`, `--caramel-deep`, `--sage`, `--mist`, `--linen`,
`--on-deep-accent` and similar) to version 3 names and update every use. Photo scrims use Navy.

## Type

Unchanged from version 1: Libre Caslon Display for h1, h2 and display sizes from 28px; Libre Caslon Text for
serif leads and italic captions; the system interface stack for body, forms, buttons, tables, admin.

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

### Real photos (in `src/assets/venue/`, each as 3:2 `name.jpg` and 4:5 `name-tall.jpg`, except the home hero)

| File | Subject | Uses |
|---|---|---|
| `grove-pines` | The gazebo under tall pines, picnic tables in front. The one exception to the file sizes: the original's full width (3661 x 2648) for full-bleed screens, and `grove-pines-tall` is 7:10 | Home hero; the venue's image in structured data (tagged `hero`, so `heroPhoto()` returns it) |
| `exterior-dusk` | The building at blue hour, lit entry, pines behind | Home share image only, cropped to its left 80% so the gable cross is out of frame |
| `approach-dusk` | The long drive and lawn toward the building at dusk | Arrival band, The grounds |
| `driveway` | The paved drive and lot in daylight | Parking, The grounds |
| `hall-windows` | The Hall: arched windows, fireplace wall, wood-look floor | The Hall primary |
| `hall-fireplace` | The Hall toward the windows and fireplace wall | The Hall gallery |
| `hall-doors` | The Hall: double doors, wall-mounted screen, arched windows | The Hall gallery |
| `grove-tables` | The Grove: gazebo and picnic tables on the patio | The Grove primary |
| `gazebo` | The timber gazebo on open lawn | The Grove gallery |
| `grove-path` | The paved path to the gazebo through the trees | The Grove gallery |

The hero and structured data show The Grove, not the building: it is what a client rents, and it keeps the
gable cross out of the first screen and out of search results. The home share card keeps the building at blue
hour because a share card's title covers its lower left, where the gazebo would sit in `grove-pines`. Keep
this split on purpose; move the `hero` tag only with this paragraph.

`grove-pines` and the staged `community-events` tile (made from `grove-path`) come from the same original,
IMG_4906, in different framings: the hero from the trunks down to the tables, the tile at lawn level with
staged tables. The no-repeat rule is checked by file name (EventIndex's `avoid`), on purpose: matching by
original would, under the all-or-nothing rule, turn every event tile into text. All three real Grove photos
show the gazebo, so it appears four times on the home page (hero, the Grove card, the Weddings and Community
events tiles); the Grove card keeps `grove-tables`, the widest vantage and the least like the hero.

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
- A block that repeats across many pages (planning timelines, rates and payment paragraphs, "how booking
  works") lives in one place and is linked, not copied.
- Footer navigation does not duplicate the header navigation item for item.
- A section that only restates another page (for example a home FAQ that repeats /faq/) earns its place only if
  it answers something the visitor needs before scrolling on; otherwise it is cut.

## Voice

Professional hospitality: confident, warm, precise, brief. "We" for the venue, "you" for guidance. No
exclamation points, slang, or jokes. Never in public copy: alcohol, drinks, bar, beer, wine, mimosas, toast,
"raise a glass", Virginia ABC, BYO, "bring your own", "your own caterer", "caterer of your choice", "the freedom
to", advice to "ask whether there is a kitchen", and any connection to New Community Church. Catering appears
exactly once, neutrally, in one FAQ entry. Prices never appear (owner decision 5).

## Page direction

**Home.** Full-bleed `grove-pines` hero: kicker, "Celebrate among the pines." (when it wraps, it breaks after
"Celebrate"), one lead sentence, and the date checker, whose Continue to Booking is the page's one primary
button. Every frame holds the whole gazebo and the copy never covers it:

- Phones (below 46.5rem): the portrait file whole at 7:10 with nothing over it, then the copy on a Frost
  panel (Navy in dark mode), then the checker.
- Tablets: the landscape file at its own ratio, the copy over the trunks above the gazebo on the Navy scrim,
  the checker after the photo.
- From 64rem: the photo fills the first screen, the title runs across the top on one line, and the checker
  floats on glass at the bottom right, lined up with the header's call to action and at least 2.5rem clear
  of the gazebo (it may cover the end of the front picnic table). On a short screen the photo runs on below
  the fold and the checker rises by as much, so the date field and Continue to Booking stay in the first
  screen.
- Shorter than 36rem, or larger text (the breakpoints are in rem): the copy moves to the same Frost panel
  under the photo (Navy in dark mode). On short, wide screens (landscape phones) the photo becomes a band of about
  58% of the screen that keeps the roof and ends through the gazebo's posts, so the title starts on the
  first screen.

Crop rule: a frame's bottom edge never runs along a tabletop or a bench; it cuts through legs or posts. The
scrim runs from 70% to 64% Navy, with a horizontal fade past the copy from 64rem (see Color); white copy
measures 4.7:1 or better at its worst pixel, so do not lighten it without measuring again.

Then the two spaces as real-photo cards, events as staged tiles with the one-line note, a rates section
("Our special rates": the approved wording, a Call button, and an "Or send an inquiry" link to /pricing/),
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
