# The Venue @ NCC: brand and redesign spec (version 6)

This document is the source of truth for the brand. It supersedes the visual parts of `hig-web-spec.md`
(colors, type, imagery). The interaction model from that spec still applies: capsule buttons, Title Case
button labels, sentence-case headings, 44px targets, reduced motion, no em or en dashes anywhere in copy.
Dark mode is withdrawn in version 6: the site is light only. The layout system, the section patterns, and
the page plans are in `redesign-spec.md` (version 5, with its version 6 colour note), which page owners
build from; the creative director's decisions in `fable-advice.md` are binding.

## Version 6 amendments (bright, white-first pastel pink, light only)

On October 1, 2026 the client asked to "retheme the website to be bright as can be, pink pastels but with
white being the main color", to "make the color scheme less dark pink more bright", and to make the cards over
hero images transparent "so they're not blocking the image". These amendments supersede every earlier color
rule, including version 5 amendment 4 (the Blush page and the Plum footer).

1. **White is the main surface**: the page, the bar, cards, panels, the menu, and the admin. The footer is
   Blush, a very pale pink; there is no dark block. Pastel pinks (Blush, Petal, Rose Mist) are accents and
   quiet bands only. See Color.
2. **Brighter pinks.** Peony `#D6336C` fills the buttons (white label 4.6:1), Cerise `#C2185B` is the hover
   fill, the link and accent text color, the focus ring, and the lockup's "@ NCC" and ring. Berry and Berry
   Deep are retired everywhere: tokens, logo files, icons, the manifest, share images, and emails.
3. **Light only.** No dark-mode rules or tokens remain; `color-scheme: light` and a White `theme-color`.
4. **See-through caption panels** over photos, tuned per photo (Color, "Caption panels over photos").
5. **The home hero veil** is bright white with a pastel pink cast (HeroVideo, and "Motion and graphics").
6. **Photo card labels on frosted White** (amended October 1, 2026, for the lead to confirm): the Plum bottom
   gradient with white type is gone; the label and meta line sit on a frosted White strip, Plum and Mauve
   (Color, "Photo card labels"). The dark gradient failed 4.5:1 over the bright staged photos.

## Version 5 amendments (the reference-site rebuild)

The client asked for the site to be rebuilt on the patterns of https://www.wedgewoodweddings.com/. These
amendments supersede the matching version 4 rules below wherever the two differ.

1. **A video hero.** The home page hero is a full-viewport, muted, looping royalty-free clip of white rose
   petals on a pink ground (`public/media/hero-petals.*`, credited in `public/media/CREDITS.md`) under a Blush
   overlay, with the welcome centred over it. The version 4 rule "no footage" is withdrawn; the rule that no
   clip may show an identifiable venue, building, room, or person stays. The petals canvas is removed.
2. **Navigation.** The floating tab bar is gone, and no bottom bar replaces it (the reference has none).
   Phones get a menu button on the left, the lockup centred, the phone on the right, and a full-screen menu
   with large serif links, Check Availability, and the phone; the closing band on every page carries Check
   Availability too. The header is transparent over the home hero and a solid bar (not glass; White since version 6) once
   the hero has scrolled past; inner pages start with the solid bar.
3. **One serif for the interface.** Libre Caslon Text sets nav links, button labels, leads, card labels, and
   section copy; the interface stack (Inter) stays for forms, the wizard, the admin, chips, and small labels.
4. **Surfaces.** (Superseded by version 6: the page is White and the footer Blush.) Sections are divided by
   hairlines rather than alternating bands; the footer keeps the reference's shape (a very large centred
   serif statement).
5. **Cards.** Photo cards carry their label and capacity inside the photo (on a frosted White strip since version 6), 12px radius,
   in horizontal carousels; there is no white card body under a photo.
6. **Buttons.** One button: the Peony capsule (`.btn--filled`, version 6), a hairline outline, and a white capsule for
   photos. The header's Check Availability is filled on every page, and an in-page primary may be filled too;
   the one-filled-button-per-viewport rule is withdrawn.
7. **The morph** runs over the hero's height (0 to 100svh minus the bar), so the name lands in the header as
   the bar turns solid. Since version 5.1 (2026-10-01) the name moves as one rigid shape on the browser's
   scroll timeline, and the header lockup is larger (40px on phones, 52px on desktops); see "Header and the
   morph".

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
set in the lockup's own Caslon outlines over pastel petals under a bright white veil, and the name becomes
the header as the visitor scrolls. Below it the real photographs of the property lead every section, on
White with pastel pink bands and Peony and Cerise accents (version 6). Caslon headings keep the feel of a printed invitation; the interface
stays crisp and Apple-like.

Avoid the tells of a templated site: no accent bars or rails on cards, no tinted or decorative gradients, no
all-caps headings. The one small uppercase element is the letterspaced eyebrow above a section heading
(`.eyebrow`, Cerise), which the reference site's rhythm uses to label a section; headings themselves stay
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
| `venue-lockup.svg` | ink Plum `#3B2430`, accent Cerise `#C2185B` | Header, footer, email, share images, print on light surfaces |
| `venue-lockup-white.svg` | white `#FFFFFF`, accent Pink `#F48FB1` | Over photos (kept; no page uses it since version 6) |
| `venue-mark.svg` / `-white.svg` | as above | Monogram alone: admin sidebar, avatars |
| `venue-wordmark.svg` / `-white.svg` | as above | Wordmark alone |
| `venue-word-the-venue.svg`, `venue-word-at-ncc.svg` | Plum, Cerise | The two words of the lockup, each in a tight viewBox. Kept as artwork; the site no longer uses them (the home welcome is cut from the lockup itself, below) |

In the lockup and wordmark the two word paths carry `data-part="the-venue"` and `data-part="at-ncc"`.
`Logo` cuts two variants from the lockup for the home welcome: `lockup-name` (the words alone, with the
viewBox cut to `NAME_BOX` in `src/lib/lockup.ts`, x 125 to 527.5 and y 23 to 77 of the lockup's 533 by 100)
and `lockup-ring` (the ring and its V, the first 100 units). Side by side at one scale they are the lockup. `src/components/Logo.astro` recolors the SVG
through CSS variables by matching these exact hex values (`#3B2430` ink, `#C2185B` accent, `#FFFFFF` light
ink, `#F48FB1` light accent). Minimum lockup height 32px; the header sets it at 40px on phones, 44px on
tablets, 46px from 960px and 52px on wider screens (Header and the morph). Icons in `public/`: favicon.ico, favicon.svg,
favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png (Peony with a white
monogram), regenerated by `logo-v6.mjs` (the version 5 script with the version 6 colors);
`public/brand/email-lockup.png` is the email header.

## Color

Version 6 (October 1, 2026): **bright, white-first pastel pink, light only.** The client asked for the site
to be "bright as can be, pink pastels but with white being the main color" and for "less dark pink, more
bright". White is the main surface; the pastel pinks are accents and quiet bands; Peony fills the buttons,
Cerise carries links and accent text, and Plum stays the ink. The dark raspberry Berry (#9E2B52) and Berry
Deep (#7E1F41), the dusty Rose (#B5456E), and every dark-mode color are retired.

**Light only.** `color-scheme: light`, one `theme-color` (#FFFFFF), and no `prefers-color-scheme: dark` rule
anywhere (global.css, components, booking, inquiry, admin, the photo viewer, the hero). A phone set to dark
mode gets the same bright site.

- **Page, header bar, cards, form panels:** White. The header is transparent over the home hero and a solid
  White bar with a hairline once the hero has scrolled past (after 8px on pages without a hero).
- **Footer:** Blush (a very pale pink) under a hairline, with Plum text, Mauve secondary text, Cerise column
  heads, Plum links, the Plum and Cerise lockup, the Peony Check Availability, and the large Plum statement.
  There is no dark block on the site.
- **Closing band (CtaBand), the home rates band, the Rates, FAQ and Book title bands, quiet panels
  (checklists, the inquiry form's field groups), chips, and selected rows:** Petal.
- **The photo viewer:** near-solid White with Petal round buttons and Plum icons.
- **The admin:** the White page and cards, a Blush sidebar with a hairline, Petal for the current screen.

| Token | Hex | Role |
|---|---|---|
| Plum | `#3B2430` | Primary text; text on chips, on the frosted caption panels, and on the photo card strips |
| Mauve | `#6A4B57` | Secondary text |
| Peony | `#D6336C` | Primary button fill (white label), the app icon field, the email rule and button |
| Cerise | `#C2185B` | Links, accent text, eyebrows, icons, the logo accent ("@ NCC" and the ring), selected states, focus rings; the hover and pressed fill of the primary button |
| Pink | `#F48FB1` | The accent of the white lockup artwork (kept; no page shows it since version 6) |
| Rose Mist | `#F9C6D7` | Hairlines on share panels, the portrait hero wash, stronger tints |
| Petal | `#FCE4EC` | Chips, panels, the closing band, the rates band, title bands, selected rows |
| Blush | `#FFF4F7` | The footer, the admin sidebar, input fills in the wizard, the email page |
| White | `#FFFFFF` | The page, the bar, cards, form panels, the menu |
| Tertiary label (derived) | `#7E5F6B` | `--label-3`: placeholders and chevrons on White and Blush only |

**Contrast, checked (WCAG 2 relative luminance):**

| Pair | Ratio | Use |
|---|---|---|
| Plum on White | 14.2:1 | Text |
| Plum on Blush | 13.2:1 | Footer text |
| Plum on Petal | 11.8:1 | Chips, panels, bands |
| Plum on Rose Mist | 9.5:1 | |
| Mauve on White | 7.6:1 | Secondary text |
| Mauve on Blush | 7.1:1 | |
| Mauve on Petal | 6.3:1 | |
| Mauve on Rose Mist | 5.1:1 | |
| White on Peony | 4.6:1 | Filled button labels (AA at any size; the serif has one weight, so labels are 16px, 17px for `.btn--lg`) |
| White on Cerise | 5.9:1 | Hover and pressed buttons |
| Cerise on White | 5.9:1 | Links, eyebrows, accent text |
| Cerise on Blush | 5.5:1 | Footer column heads |
| Cerise on Petal | 4.9:1 | Eyebrows on title bands, selected rings |
| Cerise on Rose Mist | 3.9:1 | Never text; non-text only |
| Peony on White | 4.6:1 | Focus and UI edges where used |
| Tertiary label on White / Blush / Petal | 5.6 / 5.2 / 4.7:1 | Kept off Petal and Rose Mist by rule |
| Plum / Mauve on the photo card strip (White 0.78 over the photo) | 8.6 / 4.66:1 or better, measured | Photo card labels and meta lines |
| Text field edge `#8C7681` on White / Blush / Petal | 4.2 / 3.9 / 3.5:1 | The boundary of every text field (`--input-edge`, WCAG 1.4.11) |
| Plum on White at 0.94 over black | 12.4:1 | Share card panels (Mauve 6.7:1) |

Never set Pink, Rose Mist, or Petal as text on a light surface, never set Cerise text on Rose Mist, and never
put white text on Pink or lighter.

### Caption panels over photos (version 6)

**Amended 2026-10-01:** the client said the panels still looked opaque. Every panel is now White at 0.3 over
`blur(10px) brightness(1.3) saturate(1.1)`, so the photo clearly shows through, and each line of text carries a
White glow (`text-shadow`) that keeps Plum legible over dark parts of a photo. The per-photo opacities below are
superseded. The home hero veil is also lighter, so the petals clip shows, and the location line is Plum at every size.

The client asked that "the cards that cover the hero images describing the space" be "more transparent so
they're not blocking the image", and that all such cards be transparent. `PageHero`'s caption panel (The
Space, events, every event page, 404) is frosted glass: White at a per-photo opacity, `backdrop-filter:
blur(12px) saturate(1.2)` (with `-webkit-`), a 70% white hairline, a soft shadow, and no Plum scrim under it.
Every line in the panel is Plum (eyebrow, title, descriptors, fact labels and values, the styled caption):
Cerise and Mauve would need a near-solid panel over a dark photo, and Plum lets it stay see-through.

The opacity is measured, not guessed (`FROST` in `PageHero.astro`), and two floors apply; each photo takes
the higher:

- **Legibility.** With the panel's text hidden, each page is screenshotted at 390 x 844, 768, 1024, 1366,
  1440, 1920 and 2560 wide and on the common phone screens 320 x 568, 360 x 640, 375 x 667 and 412 x 915 (the
  4:5 cover crop shifts with screen height, so 390 x 844 alone is not enough), and the composited pixels
  behind every text line are sampled (the 2nd-percentile pixel); the lowest opacity at which every line keeps
  4.5:1, plus a step where that was within 0.2 of the floor.
- **Appearance: 0.62.** Below it, over a dark photo (the outdoor scenes, the gazebo, The Main Hall), the panel
  composites to a grey or khaki box (HSL lightness 62 to 66) rather than glass. At 0.62 or more it still
  lets the photo through and reads as frosted White (lightness 78 or more on every hero at 390 and 1440).
  This is what delivers the client's "transparent and bright", not a reversal of it. Bright rooms clear both
  floors lower and keep their lower values.

Results (worst line per page over all the screens above, October 1, 2026):

| Hero photo | Opacity (phone / wide) | Worst line |
|---|---|---|
| main-hall (The Space) | 0.65 / 0.65 | 5.88:1 |
| styled-wedding-indoor-ceremony (/events/) | 0.60 | 5.21:1 |
| styled-event-weddings | 0.62 (appearance) | 6.19:1 |
| styled-event-receptions-banquets | 0.55 | 5.08:1 |
| styled-event-baby-bridal-showers | 0.55 | 5.14:1 |
| styled-event-birthday-parties | 0.50 | 4.88:1 |
| styled-event-repasts-memorials | 0.45 | 4.88:1 |
| styled-event-meetings-trainings | 0.55 | 5.16:1 |
| styled-event-graduations-reunions | 0.65 (appearance) | 6.52:1 |
| styled-event-community-events | 0.65 (appearance) | 6.90:1 |
| gazebo (404) | 0.65 (appearance) | 7.58:1 |
| any other photo | 0.65 | (passes over every hero measured) |

Where phones stack the caption under a 3:2 staged photo (`phone="stack"`), it stays under the photo on the
page, with the Cerise eyebrow (5.9:1) and Mauve labels. Without backdrop-filter the panel is White at 0.9;
under reduced transparency or increased contrast it is White at 0.96 with no blur. The small Styled Concept
badge stays near-white glass.

### Photo card labels (version 6, amended October 1, 2026)

`PhotoCard` labels sit on a frosted White strip along the bottom of the photo, the same glass as the caption
panels: White at 0.78, `--frost-blur`, a white hairline on top, a Plum label and a Mauve meta line. The Plum
gradient with white type that the reference uses failed 4.5:1 over the bright staged photos (as low as 1.1:1
on the /events/ tiles), and it was the one dark band left on the site. At 0.78 the strip is bright enough over
any photo that it needs no tuning per photo: measured on home, The Space, /events/ and an event page at 320,
390, 768, 1440 and 1920, the label keeps 8.6:1 or more and the meta line 4.66:1 or more. Without
backdrop-filter the strip is White at 0.9, and under reduced transparency or increased contrast 0.96. On a
gallery card the enlarge icon sits at the strip's right end and the text stops short of it.

Tokens live in `src/styles/global.css` under the palette names above (`--ink`, `--ink-rgb`, `--mauve`,
`--peony`, `--cerise`, `--pink`, `--rose-mist`, `--petal`, `--blush`, `--white`), the role tokens under them,
and `--frost-blur` and `--frost-border` for the caption panels and card strips; `--on-dark` and
`--on-dark-accent` remain only for the white lockup artwork. The admin and booking styles use only the role
tokens; text fields take `--input-edge`.

## Type

Libre Caslon Display for h1, h2, display sizes from 28px, and the footer statement (`.t-statement`); Libre
Caslon Text for serif leads, italic captions, and the welcome's "Welcome to"; the system interface stack
(Inter elsewhere) for body, forms, buttons, tables, admin, and the small letterspaced eyebrow (`.eyebrow`,
13px, 600, 0.14em, uppercase, Cerise). Headings are sentence case; button labels Title Case. The pairing
follows the reference site's light serif display over a quiet sans, with our own faces.

## Header and the morph

The header is a three-column grid: links (Events, The Space, Rates, FAQ), the lockup centred, then the
phone and Check Availability; on compact screens (below 60rem) a menu button, the lockup centred, and a
round phone button. It is sticky, transparent over the home hero, and a solid White bar with a hairline once
the hero has scrolled past (`data-solid`).

**The lockup is the bar's largest element** (version 5.1, after the owner asked for a bigger name): 40px tall
on phones, 44px on tablets, 46px from 960px to 1119px, and 52px from about 1140px, in a bar 64px tall on
phones, 72px on tablets and small desktops, and 80px from 1120px (`--nav-h`). Where the room beside it runs
short it gives way first, never under 32px: on compact screens its width is the centre left between the two
44px buttons (a 320px phone gets 39px, 200% text 34px); on regular screens each side is held to 22rem (17.5rem
from 960px to 1119px), so larger text shrinks the name before a link can touch it. The heights are set in
rem, so with larger text the name grows with the bar and its buttons and stays the bar's largest element.
The links, the phone, and the call to action are 16px Caslon Text, and 17px from 1200px beside the 52px name.
On the home page the lockup also shows whenever the home link has keyboard focus, even before the name has
landed. The demo pill shows only where there is room: 480px to 959px, and from 1200px.

**The morph** (`src/pages/index.astro`, version 5.1). The welcome's name is the header lockup's own words
(`Logo` `lockup-name`) on one line at every width, the container's width on phones (89vw at 390) and 74vw
(at most 68rem) from 46.5rem, with the lockup's ring (`lockup-ring`) beside it where the lockup has it,
unseen, both drawn in one unit `--u` so they always register. It moves as one rigid shape, so no part of it
ever crosses another. On load, resize, font load, or a change of text size the script measures where the
words rest and where the header's words sit (the lockup's box and `NAME_BOX`), and builds the tracks as plain
numbers; it skips the work when the window, the hero, the bar, and the lockup have not changed (a phone's
address bar collapsing on the first scroll), and while new animations wait their first frame the same pose
is held in inline styles. Over the hero's height less the bar (the scroll after which the bar turns solid):

- the name's outer box holds it still on the screen while the page scrolls;
- over the first 20% "Welcome to" scrolls away above the name and fades (it rises faster than the name, so
  they never meet), and the line and the button fade where they stand below it (then take no taps) while the
  page slides up over them, so the welcome leaves as a unit;
- from 20% the name's inner box glides up and shrinks to the header's size with an ease-in-out
  (cubic-bezier(0.65, 0, 0.35, 1)), so it sets off gently, travels while the page rises, and is still moving
  as it lands instead of parking short of the bar;
- the ring fades in over 55% to 95% of the way, so the lockup gathers around the name as it arrives;
- over the last 6 pixels the header's own lockup, drawn in exactly the same place, fades in as the moving
  name fades out (one crossfade over one range, so the two are never both fully drawn), and the header gets
  `data-morphed`. Scrolling back reverses all of it.

Everything is a transform or an opacity on a scroll timeline (`ScrollTimeline` with the Web Animations API),
so the browser's compositor moves the name in the same frame as the scroll, with no script per frame and no
layout reads; browsers without scroll timelines run the same tracks from a frame callback. No filters animate
(the name has no halo: over every sampled frame of the clip, under the version 6 white veil, Plum keeps at
least 11.3:1 and Cerise 4.4:1, measured under the earlier, dimmer veil; the brighter veil of October 1 only
raises both). Under `prefers-reduced-motion: reduce`, on short screens (where the bar
scrolls away), and without scripts, the header lockup shows at once, the welcome stays still and scrolls
under the bar, and the bar turns solid after 8px.

## Motion and graphics

- **The hero loop** (`src/components/HeroVideo.astro`, version 5): a royalty-free clip of white rose petals on
  a pink ground, 12 seconds, muted, autoplay, loop, playsinline, poster first, fixed behind the welcome under a
  bright white veil with a pastel pink cast. Since October 1, 2026 the clip and its poster are 2560 x 1440, cut
  from the source's 4K rendition (the 1280 x 720 files were the softest image on the site and are kept in
  `design-archive/hero-petals-1280/`): WebM 177 KB, MP4 652 KB (the 350 KB cap of version 5 is withdrawn for
  the MP4, which only browsers without WebM fetch), and portrait screens get their own 1216 x 2160 poster. The
  veil (October 1): White at 0.96 in the centre easing to Blush at 0.74 at the edges over a 0.4 pink-white
  wash; on portrait screens a Rose Mist wash at 0.3 under a 0.82 near-white wash with a white 0.8 centre. The
  first screen's mean lightness is about 95 (HSL) at 390 and 1440, the brightest surface on the site, with the
  pink still showing at the edges. Under the earlier, dimmer veil, over 12 frames at 360, 390, 768 and 1440,
  the Plum name kept 11.3:1, the Cerise "@ NCC" 4.4:1 (large text), "Welcome to" 6.4:1, and the line 5.0:1;
  the brighter veil only raises these.
  It shows no identifiable venue, building, room, or person, never covers a real photo, and its source,
  author, and license are recorded in `public/media/CREDITS.md`. Under reduced motion the video is hidden and
  the poster shows; the script also pauses it.
- **No other footage.** No video of this or any other venue, and no clip that could be mistaken for the
  property. The petals canvas of version 4 is removed.
- Every other transition follows the HIG spec and stops under reduced motion.

## Photography

### The rule

- **Real photographs show the spaces.** Everything that shows what a client rents uses real photos only: the
  home photo band, the home space cards, The Space, the arrival band, share images (except the home card,
  below), and structured data.
- **The home share card is a still life.** The client asked for "a beautiful bouquet of pink and white
  roses" in place of the building: a generated still life (`share-rose-bouquet.jpg`, every variant kept in
  `design-archive/generated-scenes/share-bouquet/`), straight and level, the whole bouquet in frame. It is
  the only image on the site that is not the property, so it never stands for the venue: it is not in
  `photos`, not in structured data, and its og:image:alt calls it an illustrative still life.
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
| `exterior-dusk` | The building at blue hour, lit entry, pines behind | Not used since the home share card became a still life of roses (October 1, 2026); kept for reference |
| `approach-dusk` | The long drive and lawn toward the building at dusk | The grounds (The Space), the Book share card |
| `driveway` | The paved drive and lot in daylight | The home arrival band (since October 1, 2026: the dusk frame was the one cool, dark image on the bright home page); The Space gallery |
| `hall-windows` | The Hall: arched windows, fireplace wall, wood-look floor | The Hall primary |
| `hall-fireplace` | The Hall toward the windows and fireplace wall | The Hall gallery |
| `hall-doors` | The Hall: double doors, wall-mounted screen, arched windows | The Hall gallery |
| `main-hall` | The Main Hall down its aisle: red upholstered chairs in rows, the vaulted ceiling, the raised stage | Home Main Hall card; The Space hero |
| `main-hall-stage` | The raised stage up close, with the screen and the front rows | The Main Hall gallery |
| `grove-tables` | The Grove: gazebo and picnic tables on the patio | The Grove primary |
| `gazebo` | The timber gazebo on open lawn | The Grove gallery |
| `grove-path` | The paved path to the gazebo through the trees | The Grove gallery |

The photo band and structured data show The Grove, not the building: it is what a client rents, and it keeps
the gable cross out of the first screens and out of search results. The home share card is the rose still
life (above), not a photo of the property, and is left out of structured data.
Keep this split on purpose; move the `hero` tag only with this paragraph.

`grove-pines` and the staged `community-events` tile (made from `grove-path`) come from the same original,
IMG_4906, in different framings. The no-repeat rule is checked by file name (the events pages compare
photo names), on purpose: matching by original would, under the all-or-nothing rule, turn every event tile
into text.

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

Two more staged photos sit outside the event set. `styled-wedding-indoor-ceremony.jpg`, a ceremony in The
Main Hall (`styledOf: 'main-hall.jpg'`), is the /events/ hero (a wedding scene that is no event's own tile,
so all eight events can be cards without a repeat) and the second view on the weddings page, under its own
caption. `styled-driveway-petals.jpg`, the drive lined with petals (`styledOf: 'driveway.jpg'`), stays in the
set but is not placed on any page: the building's cross is front and centre in it (Separation).

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
   Text italic line and the name is the lockup's own words (`Logo` variant `lockup-name`, with the name in
   visually hidden text) on one line at every width, in the lockup's proportions through one unit `--u`:
   the container's width on phones, 74vw (at most 68rem) from 46.5rem, the same shape it lands on in the header. One small
   Cerise eyebrow line (Plum on portrait screens), "Event venue in Suffolk, Virginia", and Check
   Availability close it. Nothing else shares the first screen.
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
7. **Find us in north Suffolk:** the drive and lot in daylight (`driveway`), the address, Get Directions.

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

**Share images.** A real photo full bleed with no scrim (version 6), with a near-solid White caption panel
(0.94, a Rose Mist hairline; a share image has no blur, so it stays legible in small previews) bottom left
holding the Plum and Cerise lockup, the page title in Caslon Display in
Plum, and one short Caslon Text line in Mauve. The home card is the exception: the rose still life
(`share-rose-bouquet.jpg`) with no scrim, and a White panel with a Rose Mist hairline, centred on the plain
wall to the left of the bouquet and never over it. It mirrors the home welcome and sets the name once:
"Welcome to" in Caslon Text italic in Mauve, then the lockup's own words (Plum, with the Cerise italic "@ NCC")
across the panel on one line, then the location line. Its og:image:alt reads "Welcome to The Venue @ NCC,
event venue in Suffolk, Virginia" and then describes the bouquet, without repeating the name. The panel and
the bouquet sit side by side, so a square centre crop (some small chat thumbnails) cuts both; the lead
decides whether that matters before this is pushed.

**Emails.** A Blush page with a white card: `email-lockup.png` at the top, a thin Peony rule, Cerise links and
a Peony capsule button with a serif label (white text), Plum text, Mauve secondary text, a Petal reference
box, Georgia for headings, the interface stack for body text.
