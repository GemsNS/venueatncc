# The Venue @ NCC: brand and redesign spec (version 4)

This document is the source of truth for the brand. It supersedes the visual parts of `hig-web-spec.md`
(colors, type, imagery). The interaction model from that spec still applies: floating tab bar on phones,
capsule buttons, Title Case button labels, sentence-case headings, 44px targets, dark mode, reduced motion,
glass only on navigation and floating controls, no em or en dashes anywhere in copy.

## What changed in version 4, and why

The owner reviewed version 3 (the navy and sky-blue site) and asked for five things. All are binding.

1. **The name first.** The first screen of the home page reads "Welcome to The Venue @ NCC", with
   "The Venue @ NCC" by far the largest type on the site, and as the visitor scrolls that name shrinks and
   slides into the header lockup. Nothing on the first screen competes with it: no photo, video, date
   checker, or other copy. The old hero copy ("Event venue in Suffolk, Virginia" / "Celebrate among the
   pines." / "Versatile indoor and outdoor event rentals...") is gone from the hero. See Home.
2. **A pastel pink palette.** The navy site was too dark. Version 4 is soft Blush and Petal surfaces, white
   cards, a deep Berry for buttons and links, and a warm Plum ink for text. Navy, sky, and every earlier
   palette appear nowhere: not in tokens, admin or booking styles, theme colors, the manifest, share images,
   emails, or the logo files.
3. **The reference site's patterns.** The header (links left, lockup centred, phone and call to action
   right, transparent over the first surface and glass on scroll), the section rhythm (eyebrow, Caslon
   heading and lead on the left, one action on the right), photo cards with a capacity chip, a feature strip,
   a quiet rates band, and a footer that opens with a large serif statement. Patterns only, never its content.
4. **Graphics that never misrepresent the space.** The only motion graphic is one the site draws itself:
   drifting pastel petals on a canvas behind the welcome. No stock footage, no photos of other venues, no
   decorative placeholder art. The real photos stay the source of truth for the spaces.
5. **Tables and chairs.** The rental includes tables and chairs, which clients may use if they wish. It is
   said where the inclusions are described (The Space, the FAQ, Rates, llms.txt, `amenityFeature`), and the
   old rule against mentioning them is withdrawn.

Still binding from earlier versions:

- **One photo system** (Photography), **no redundancy** (Redundancy rules), and **the venue is a separate
  business from New Community Church** (Separation).
- **No published prices.** No dollar amounts, rate tables, packages, estimates, deposit or fee amounts,
  discounts with amounts, or `priceRange` and `Offer` prices appear on any public page, booking step, guest
  email, share image, structured data, or llms.txt. Where rates come up, use the approved wording exactly:
  "Our affordable rates vary with peak season, holidays, and the day of the week. For pricing and special
  offers, please call us and we will be happy to help you." (`RATES_WORDING` in `src/data/faq.ts`), with the
  phone (948) 205-2934 (`tel:+19482052934`). The rate card in `src/shared/pricing.ts` is internal.
- **Rates is an inquiry page.** `/pricing/` (labelled "Rates" everywhere) gives the approved wording, a Call
  button, the rental information panel, and an inquiry form that posts to the site's own inquiry API. No
  third-party form services.
- **The owner's official copy (September 30, 2026)** is the source of truth for facts and tone: three
  spaces (The Hall 100, The Main Hall 100, The Grove 150); the welcome text (versatile indoor and outdoor
  event rentals in Suffolk, tailored for any occasion, with elegant backdrops, flexible layouts, and full-day
  access; fully renovated grounds, never "campus"), which the home spaces section carries; the amenities
  (Ballroom seating, Hospitality areas, Flexible layouts), stated once on The Space and in structured data;
  the rental policies (a reservation and a non-refundable deposit hold a date, no amount; building access
  Monday to Saturday, 9:00 AM to 12:00 midnight), stated on Rates and in one FAQ each, and enforced by the
  booking rules; the contact person, Faith VanDyke; the visit request wording on The Space.
- No decorative placeholder art; a professional business voice; never mention alcohol; catering only in the
  one neutral FAQ entry named under Voice.

## Concept

**The name, then the photographs, in a soft pink frame.** The home page opens on the business name alone,
set in the lockup's own Caslon outlines on a Blush surface with petals drifting behind it, and the name
becomes the header as the visitor scrolls. Below it the real photographs of the property lead every section,
in white and Blush with Berry accents. Caslon headings keep the feel of a printed invitation; the interface
stays crisp and Apple-like.

Avoid the tells of a templated site: no accent bars or rails on cards, no tinted or decorative gradients, no
all-caps headings. The one small uppercase element is the letterspaced eyebrow above a section heading
(`.eyebrow`, Berry), which the reference site's rhythm uses to label a section; headings themselves stay
sentence case. Pink, Rose Mist, and Petal appear only as surfaces, tints, chips, petals, and accents on Plum,
never as text on a light surface.

## Names

| Thing | Public name | Notes |
|---|---|---|
| The business | The Venue @ NCC | Stand-alone business. Never "NCC Spaces" or "NCC Venues". |
| Indoor space | The Hall | Up to 100 guests. Data slug stays `indoor`. |
| Auditorium | The Main Hall | Up to 100 guests, stage seating. Data slug `main`. Booked on its own. |
| Outdoor space | The Grove | Up to 150 guests. Data slug stays `outdoor`. |
| Both | The Hall and The Grove | Data slug stays `both`. Never includes The Main Hall. |
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

Files in `src/assets/brand/` (outlined SVG, no font dependency), generated by the logo script (`logo-v5.mjs`
in the tools folder; edit its color constants and copy the results into `src/assets/brand/` and `public/`).
A Caslon "V" inside a double ring, with "The Venue" in Libre Caslon Display and "@ NCC" in Libre Caslon
Text italic. The ring frames the monogram the way a wax seal or an embossed invitation mark would.

| File | Colors | Use |
|---|---|---|
| `venue-lockup.svg` | ink Plum `#3B2430`, accent Berry `#9E2B52` | Header, footer, email, print on light surfaces |
| `venue-lockup-white.svg` | white `#FFFFFF`, accent Pink `#E9A9BB` | Over photos and on share images |
| `venue-mark.svg` / `-white.svg` | as above | Monogram alone: admin sidebar, avatars |
| `venue-wordmark.svg` / `-white.svg` | as above | Wordmark alone |
| `venue-word-the-venue.svg`, `venue-word-at-ncc.svg` | Plum, Berry | The two words of the lockup, each in a tight viewBox, for the home welcome (see Home) |

In the lockup and wordmark the two word paths carry `data-part="the-venue"` and `data-part="at-ncc"`, so the
home page can measure where each word sits in the header. `src/components/Logo.astro` recolors the SVG
through CSS variables by matching these exact hex values (`#3B2430` ink, `#9E2B52` accent, `#FFFFFF` light
ink, `#E9A9BB` light accent). Minimum lockup height 32px. Icons in `public/`: favicon.ico, favicon.svg,
favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png (Berry with a white
monogram); `public/brand/email-lockup.png` is the email header.

## Color

A pastel pink palette. Light surfaces are Blush and Petal (with white cards); Berry gives buttons, links, and
accents real contrast; Plum is the ink. Nothing else is added.

**Light by default.** In light mode every large surface is light: White, Blush, or Petal. Plum is for text and
photo scrims, Berry for buttons and accents; neither is a large surface. Specifically:

- **Header:** transparent over the page's first surface (Blush on the home page, White elsewhere), then
  strong glass with a hairline once the page scrolls under it. Links left, lockup centred, phone and Check
  Availability right; on phones the links go to the tab bar and the phone becomes a round icon button.
- **Welcome surface (home):** Blush with petals; Plum name, Berry "@ NCC", Mauve serif "Welcome to", a Berry
  eyebrow line.
- **Footer:** Blush with a top hairline, the Plum statement in Caslon, the Plum-ink lockup, Mauve text, and
  Berry links.
- **Closing band (CtaBand) and the home rates band:** Petal with a top hairline, a Plum heading, a Mauve
  sentence, and the Berry button with a white label.
- **Alternate sections:** Blush. **Quiet panels** (rental policies, checklists, the visit request): Petal.
- **Chips** (capacity tags, Styled Concept badge on light frames, selected rows): Petal with Plum text.

| Token | Hex | Role |
|---|---|---|
| Plum | `#3B2430` | Primary text; photo scrims and the photo viewer; text on chips |
| Mauve | `#6A4B57` | Secondary text |
| Berry | `#9E2B52` | Primary button fill (white text), links, accent text, eyebrows, icons, the logo accent, selected states |
| Berry Deep | `#7E1F41` | Hover and pressed state of primary buttons |
| Rose | `#B5456E` | Focus ring, the email rule (non-text) |
| Pink | `#E9A9BB` | Lockup accent on Plum and in dark mode; petals; badges on dark |
| Rose Mist | `#EFC5D0` | Petals, hairlines on Plum, stronger tints |
| Petal | `#F6DFE5` | Chips, panels, the closing band, the rates band, selected rows |
| Blush | `#FBF1F3` | Alternate sections, the footer, the welcome surface, the header at the top of home |
| White | `#FFFFFF` | Page background and cards |
| Tertiary label (derived) | `#7E5F6B` | `--label-3`: placeholders and chevrons on White and Blush only |

Contrast (checked): Plum on White 14.2:1, on Blush 12.8:1, on Petal 11.2:1, on Rose Mist 9.2:1; Mauve on
White 7.6:1, on Blush 6.9:1, on Petal 6.0:1, on Rose Mist 4.9:1; Berry on White 7.2:1, on Blush 6.5:1, on
Petal 5.7:1; white on Berry 7.2:1, on Berry Deep 9.7:1; Rose on White 5.2:1, on Blush 4.7:1, on Petal 4.1:1
(non-text); the tertiary label on White 5.6:1, on Blush 5.1:1, but 4.4:1 on Petal, so it is never set on
Petal or Rose Mist. Never set Pink, Rose Mist, or Petal as text on a light surface, and never put white text
on Rose or lighter. A petal at its darkest (Pink at 60% over Blush) still gives Mauve 4.9:1, Plum 9.2:1, and
Berry 4.7:1, which is why the canvas caps petal opacity at 0.6.

Dark mode, in the same family: page Mulberry Night `#2A151F`, grouped `#1F0E16`, cards `#3A1F2B`, text
`#FBEFF2` (15.3:1 on Night), secondary `#E9C9D3` (11.2:1), tertiary `#B58FA0` (6.0:1), primary button Pink
Bloom `#F2B7C6` with Night text (10.1:1), hover `#F8CBD6`, accent text Blossom `#F5A8BD` (9.2:1 on Night,
8.0:1 on cards), focus ring Pink Bloom, chips and selected rows in translucent Pink, separators
`rgba(251,239,242,0.14)`. The footer, the closing band, and the rates band are the card color, a step
lighter than the Night page, each with a hairline (tokens `--footer-bg` and `--band`). Photo scrims use Plum.

Tokens live in `src/styles/global.css` under the palette names above (`--ink`, `--ink-rgb`, `--mauve`,
`--berry`, `--berry-deep`, `--rose`, `--pink`, `--rose-mist`, `--petal`, `--blush`, `--white`) and the role
tokens under them; text over photographs and scrims uses `--on-dark`, `--on-dark-2`, `--on-dark-accent`.
The admin and booking styles use only the role tokens, so they follow.

## Type

Libre Caslon Display for h1, h2, display sizes from 28px, and the footer statement (`.t-statement`); Libre
Caslon Text for serif leads, italic captions, and the welcome's "Welcome to"; the system interface stack
(Inter elsewhere) for body, forms, buttons, tables, admin, and the small letterspaced eyebrow (`.eyebrow`,
13px, 600, 0.14em, uppercase, Berry). Headings are sentence case; button labels Title Case. The pairing
follows the reference site's light serif display over a quiet sans, with our own faces.

## Header and the morph

The header is a three-column grid: links (Events, The Space, Rates, FAQ), the lockup centred, then the
phone and Check Availability. It is sticky, transparent at the top, and strong glass with a hairline once
scrolled (`data-scrolled`). On the home page the lockup's two words stay hidden (opacity 0) until the welcome
has morphed into them, and the ring fades in over the last part of the way (`--nav-ring`).

The morph (`src/pages/index.astro`): the welcome shows the lockup's two word outlines at display size. On
load, and on resize, the script measures each word's resting rectangle and its twin's rectangle in the
header (the `data-part` paths of whichever lockup is displayed). On each scroll frame it sets a transform
alone, translate and scale from rest toward the twin in step with progress p = scrollY / distance, where the
distance is the greater of the word's natural travel and about half a screen (at most 420px). At p = 1 the
header gets `data-morphed`, shows its own lockup, and the welcome's words are hidden; scrolling back reverses
it. Transforms never touch layout, so nothing below shifts (the photo band's document position is constant
through every frame). Under `prefers-reduced-motion: reduce`, on short screens (where the bar scrolls away),
and without scripts, the header lockup shows at once and the welcome stays still.

## Motion and graphics

- **Petals** (`src/components/Petals.astro`): a canvas behind the welcome draws 8 to 22 petals in Rose Mist,
  Petal, and Pink at 40 to 60 percent opacity, drifting down and swaying. It is written by the site (no
  license to record), aria-hidden, capped at 2x device pixels, paused while the tab is hidden or the welcome
  is off screen, and drawn once, still, under reduced motion. It is the only motion graphic. It never stands
  in for a photo of the space, and it stays behind the name, never over a photograph.
- **No footage.** No video of this or any other venue, no stock footage, no generic clips. If a loop is ever
  added it must show no identifiable venue, be small (MP4 and WebM, muted, playsinline, poster, lazy), never
  cover a real photo, and carry a license note in the repo.
- Every other transition follows the HIG spec and stops under reduced motion.

## Photography

### The rule

- **Real photographs show the spaces.** Everything that shows what a client rents uses real photos only: the
  home photo band, the home space cards, The Space, the arrival band, share images, and structured data.
- **Staged photographs show events.** Every event tile and every event page hero uses a staged image of that
  event, all eight in one décor style, each with the same small "Styled Concept" badge. The events section on
  the home page and the /events/ page carry one line: "Event photos show our spaces styled for each occasion.
  Décor is not included." Event page heroes carry the caption "Styled concept. Décor is not included."
- **All or nothing.** If a staged image is missing for any event, no staged image is shown: each event page hero
  shows the real photo its staged image is made from, with no badge or caption, event tiles show no photo, and
  the one-line note is hidden. This is computed in `src/data/photos.ts` from which files exist.
- **No toggles.** The As Photographed / Styled Concept switches are removed everywhere.
- **No repeats.** No image appears twice on the same page.
- **No cropped subjects.** Frames never cut into a photo's subject; the tap-to-enlarge viewer
  (`src/components/Photo.astro`) shows every photo whole.

### Real photos (in `src/assets/venue/`, each as 3:2 `name.jpg` and 4:5 `name-tall.jpg`, except the home band)

| File | Subject | Uses |
|---|---|---|
| `grove-pines` | The gazebo under tall pines, picnic tables in front. The one exception to the file sizes: the original's full width (3500 x 2532) for full-bleed screens, and `grove-pines-tall` is 7:10 | The home photo band; the venue's image in structured data (tagged `hero`, so `heroPhoto()` returns it) |
| `exterior-dusk` | The building at blue hour, lit entry, pines behind | Home share image only, cropped to its left 80% so the gable cross is out of frame |
| `approach-dusk` | The long drive and lawn toward the building at dusk | Arrival band, The grounds |
| `driveway` | The paved drive and lot in daylight | Parking, The grounds |
| `hall-windows` | The Hall: arched windows, fireplace wall, wood-look floor | The Hall primary |
| `hall-fireplace` | The Hall toward the windows and fireplace wall | The Hall gallery |
| `hall-doors` | The Hall: double doors, wall-mounted screen, arched windows | The Hall gallery |
| `main-hall` | The Main Hall down its aisle: red upholstered chairs in rows, the vaulted ceiling, the raised stage | Home Main Hall card; The Space hero |
| `main-hall-stage` | The raised stage up close, with the screen and the front rows | The Main Hall gallery |
| `grove-tables` | The Grove: gazebo and picnic tables on the patio | The Grove primary |
| `gazebo` | The timber gazebo on open lawn | The Grove gallery |
| `grove-path` | The paved path to the gazebo through the trees | The Grove gallery |

The photo band and structured data show The Grove, not the building: it is what a client rents, and it keeps
the gable cross out of the first screens and out of search results. The home share card keeps the building at
blue hour because a share card's title covers its lower left, where the gazebo would sit in `grove-pines`.
Keep this split on purpose; move the `hero` tag only with this paragraph.

`grove-pines` and the staged `community-events` tile (made from `grove-path`) come from the same original,
IMG_4906, in different framings. The no-repeat rule is checked by file name (EventIndex's `avoid`), on
purpose: matching by original would, under the all-or-nothing rule, turn every event tile into text.

Describe only what the photos and the owner's copy confirm. The owner confirmed The Main Hall's stage and
stage seating, kitchen access with banquet arrangements, private hospitality rooms, and that the rental
includes tables and chairs (which clients may use if they wish); state each once, in its place (The Space for
the amenities and the inclusions, with the inclusions also on Rates, in the FAQ, in llms.txt, and in
`amenityFeature`). Do not claim a sound system, bridal suite, Wi-Fi, or AV unless phrased as "ask us". The
Main Hall photos show equipment on the stage; describe the room, not the equipment.

### Staged event photos

File `styled-event-<slug>.jpg` with a `photoDetails` entry `{ styledOf: '<real base>.jpg', event: '<slug>' }`.
One décor language across all eight: white linens, pink and white roses and peonies, white or clear chairs,
candlelight, and white runners with pink petals, which sits with the pink palette. Architecture, windows,
doors, floors, fixtures, the gazebo, and trees stay exactly as photographed. Never delete a generated version;
archive earlier ones.

| Event slug | Base | Scene |
|---|---|---|
| `weddings` | gazebo | Ceremony seating facing the gazebo |
| `receptions-banquets` | hall-windows | Formal reception rounds and a sweetheart table |
| `baby-bridal-showers` | hall-fireplace | Shower tables and a dessert table |
| `birthday-parties` | hall-windows | Milestone dinner, one long table |
| `repasts-memorials` | hall-doors | Quiet rounds and a guest book table |
| `meetings-trainings` | hall-doors | Rows of tables facing the screen |
| `graduations-reunions` | grove-tables | Picnic tables dressed, lanterns, string lights |
| `community-events` | grove-path | An outdoor community gathering on the lawn |

Two more staged photos sit outside the event set, both on the weddings page under their own captions:
`styled-wedding-indoor-ceremony.jpg`, a ceremony in The Main Hall (`styledOf: 'main-hall.jpg'`), and
`styled-driveway-petals.jpg`, the drive lined with petals (`styledOf: 'driveway.jpg'`).

## Redundancy rules

- State each fact once per page, in the place it does the most work. Capacities belong to the space cards and
  The Space; the welcome carries the name and the location line only.
- One primary call to action per viewport. The header CTA plus one in-page CTA near the end of the page is
  enough; do not stack Check Availability buttons in hero, steps, band, and footer.
- A block that repeats across many pages (planning timelines, rates and payment paragraphs, "how booking
  works") lives in one place and is linked, not copied.
- Footer navigation does not duplicate the header navigation item for item: the footer's "Plan your event"
  column holds the requests that have no header link (a visit, an inquiry) and, on compact screens, the FAQ.
- A section that only restates another page earns its place only if it answers something the visitor needs
  before scrolling on; otherwise it is cut.

## Voice

Professional hospitality: confident, warm, precise, brief. "We" for the venue, "you" for guidance. No
exclamation points, slang, or jokes. Never in public copy: alcohol, drinks, bar, beer, wine, mimosas, toast,
"raise a glass", Virginia ABC, BYO, "bring your own", "your own caterer", "caterer of your choice", "the freedom
to", advice to "ask whether there is a kitchen", and any connection to New Community Church. Catering appears
exactly once, neutrally, in one FAQ entry. Prices never appear.

## Page direction

**Home.** In order:

1. **The welcome.** On Blush with petals: the h1 "Welcome to The Venue @ NCC", where "Welcome to" is a Caslon
   Text italic line and the name is the lockup's two word outlines (`Logo` variants `word-the-venue` and
   `word-at-ncc`, with the name in visually hidden text). The words keep the lockup's proportions through
   one unit `--u`: from 46.5rem on one line, 74vw wide (at most 68rem); on phones stacked, "The Venue" at
   92vw, so the whole name fits a 320px screen without wrapping awkwardly. One small Berry eyebrow line,
   "Event venue in Suffolk, Virginia", closes it. Nothing else shares the first screen's Blush.
2. **The photo band.** `grove-pines`, full bleed (the portrait file on phones), with the date checker
   floating on glass at the bottom right from 64rem and as a card under the photo below that. Every frame
   holds the whole gazebo: a frame's bottom edge never runs along a tabletop or a bench. The checker's
   Continue to Booking is the page's one filled button; the header CTA is tinted here.
3. **Three spaces, indoors and out**: eyebrow, heading, the owner's welcome text as the lead, an Explore The
   Space capsule on the right, then the three real-photo cards (name, capacity chip, one sentence, a link).
4. **Events we host** (Blush): eyebrow, heading, the styled note, See All Events on the right, the eight
   staged tiles.
5. **The feature strip:** three icon rows (Indoors and outdoors, Full-day access, On-site parking).
6. **Our special rates** (Petal): the approved wording, the Call button, and "Or send an inquiry".
7. **Find us in north Suffolk:** the drive at dusk, the address, Get Directions.

The date checker lists the three spaces as one row each (name, what it is, the day's status, a radio), so
the full names never wrap.

**The Space.** Real photos only. A hero of the three spaces, then The Hall, The Main Hall, The Grove, the
Premium amenities list, The grounds, What the rental includes (`site.included`), and the Schedule a visit
request, then the closing band.

**Rates.** The approved wording, the Call button, the contact line naming Faith VanDyke, the Rental
information and policies panel (what is included, the deposit, and hours of operation), and the inquiry form.

**Events.** Staged hero per event with badge and caption, the event's unique copy, and links to shared
information instead of repeated blocks.

**Footer.** The brand line ("Celebrate among the pines.", `site.tagline`) as a large Caslon statement, then
the lockup with one sentence, Visit and contact, Plan your event, and the legal line.

**Share images.** Real photo background, Plum scrim, light lockup, page title in Caslon, secondary line in
Petal. The home card's title is the welcome, "Welcome to The Venue @ NCC".

**Emails.** `email-lockup.png` header on white, a thin Rose rule, Berry links and button (white text), Plum
text, Mauve secondary text, a Blush reference box, Georgia for headings, the interface stack for body text.
