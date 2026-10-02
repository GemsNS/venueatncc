# The Venue @ NCC: redesign specification, version 7 (image first), with the version 8 amendments

Written October 1, 2026 by the lead designer after auditing every route of the version 6 build at 390 and
1440 (captures in the redesign scratchpad folder `v7/shots/`). This document is binding for everyone who
builds, reviews, or amends the site. It applies on top of `brand.md` (version 6) and `redesign-spec.md`
(version 5) and overrides both wherever they disagree; the overridden rules are listed in section 0 so no
page owner follows a dead rule by accident. `fable-advice.md` stays binding except where section 0 names it.

## Version 8 amendments (fewer pages, straightforward, October 2, 2026)

The client, verbatim and binding: "REMOVE THE MENTION OF 'WITHOUT RETURNING TO THEIR CARS', MAKE DESIGN MORE
SIMPLE LESS REPETITIVE LESS PAGES MORE STRAIGHTFORWARD". Version 8 applies on top of version 7 and overrides
it where they differ. Everything in version 7 about photos (nothing on a photo, photos whole, the
disclosure under the photo), the rose hero, and the name morph stays.

1. **No walking to cars.** No copy describes guests walking between spaces, to their cars, or "without
   returning to their cars". The sentence is gone from the weddings copy and must not come back anywhere.
2. **Five public pages.** Home (`/`), The Space (`/the-space/`), Events (`/events/`), Rates & FAQ
   (`/pricing/`), and Book (`/book/`), plus the 404 and the admin. The navigation is The Space, Events,
   Rates & FAQ, then the phone and Check Availability; the phone menu is the same list with Home first and
   no event sub-list.
3. **Events is one page.** Each of the eight occasions (`src/data/events.ts`) is a compact block with its
   slug as its id: one staged photo with its disclosure caption, the name, one or two sentences, and the
   spaces that suit it (links to The Space). No planning guides, checklists, per-event questions, related
   links, or breadcrumbs. One closing line for any other occasion, with Check Availability.
4. **Rates & FAQ is one page.** The approved rates wording with Call (the page's one filled button) and a
   text link to the booking page; the booking details (what is included, holding your date, the hours), the
   one home of those facts; then the questions (`#faq`), one accordion, with the FAQPage structured data. No
   question repeats a fact stated above it on the page. There is no second request form: a date request
   has one home, Book, whose wizard also carries the visit request (`?visit=1`).
5. **The Space** is a title band, one block per space (photo whole, two or three sentences, capacity,
   features), a small gallery of four further views, and the amenities as one compact list. No intro photo,
   no jump links, no grounds, "included", or visit sections.
6. **Home** is the rose welcome, the three spaces (photo, name, one line, capacity), Check a date, the
   events list (links to `/events/#<slug>`), and Getting here. Each section has a heading and at most a
   one-line lead; no eyebrows.
7. **Footer** is one short block: the lockup, The Space, Events, Rates & FAQ, Check availability, the
   address (directions), the phone, the email, and the legal line. No event list, no repeated groups.
8. **One look for inner pages.** Events, Rates & FAQ, Book, and The Space open with the same Petal title band
   (`.title-band` in `global.css`): the h1 and at most one line. Eyebrows are kept only where they label a
   state (the 404, the booking wizard's step).
9. **Old addresses.** Every removed URL answers 301 from the server (`MOVED_PAGES` in `server/static.ts`),
   with the query string kept before the fragment, and the demo build publishes a redirect page at each:
   `/events/<slug>/` to `/events/#<slug>` (all eight), `/events/church-community-events/` to
   `/events/#community-events`, `/faq/` to `/pricing/#faq`, and `/about/` to `/the-space/`. The sitemap
   lists the five pages; the share cards are home, the-space, events, pricing, and book.

## The client's direction (verbatim, binding)

> get rid of the concept of cards covering image, new design angle, customer hates it and wants the images
> fully shown, also for the hero header see if you can find pink roses as those flower petels dont really
> look like flower petals, also less redundency make the website easy to navigate

Read as three rules:

1. **Nothing sits on a photo.** No text, panel, card, label strip, gradient scrim, badge, or control may be
   placed over any photograph anywhere on the site: page headers, cards, carousels, galleries, splits, the
   404, event pages, the booking wizard. Photos are shown whole at their own aspect ratio. Headings, labels,
   facts, captions, and the styled-concept disclosure sit beside or below the photo. The one exception is the
   home welcome ("Welcome to The Venue @ NCC", the location line, and Check Availability) over the rose
   video, which is footage, not a photograph of the property. The morph of the name into the header lockup
   keeps working exactly as it does today.
2. **Pink roses in the hero.** The petals clip is replaced by a clip of pink roses that reads as roses on a
   phone's portrait crop as well as on a desktop (section 6).
3. **Less redundancy, easy navigation.** Each fact has one home and is linked from everywhere else
   (section 4); the navigation is one short list, the same everywhere, with no second sticky bar and one
   primary action per page (section 3).

## The client's rules of October 1, 2026 (binding)

Three rules from the client, verbatim in quotes, binding on every page, component, email, share card, data
file, and doc that feeds the site:

1. **The gazebo's roof is never described.** "REMOVE MENTION OF METAL ROOF ON GAZEBO". No copy, alt text,
   caption, photo note (`photos.ts`, the photo README), feature list (`the-space.astro`), event copy,
   structured data, llms.txt, share card, or email names the gazebo's roof or its material. It is "a timber
   gazebo" (or "the gazebo").
2. **No booking timelines.** "REMOVE MENTION OF '9 MONTH BOOKING' OR ANY TIMELINES OF WHEN BOOKINGS CAN BE
   BOOKED IN ADVANCE". Nothing says how far ahead to book, reserve, or plan a date: no "nine to twelve months
   ahead", no "a season ahead", no "within a few days", no "open dates up to two years ahead", and no "How far
   in advance should we book ..." question, in event copy, FAQs, FAQPage structured data, llms.txt, or data
   comments. Timing that belongs to the occasion itself (a shower before the due date, a graduation party the
   weekend of the ceremony) may be said, without week or month counts. The two-year limit on online requests
   stays as behavior (`latestBookableDate`), but its messages state no timeline: "That date is not open for
   online requests yet. Call us at (948) 205-2934 and we will help." (`DATE_TOO_FAR`, `ALT_DATE_TOO_FAR`,
   `TOO_LATE_MESSAGE`, the demo backend's `tooFar` and `altTooFar`, all with the phone from site.ts).
3. **No photo larger than its detail.** "DONT ZOOM IMAGES TO A POINT WHERE THEY LOOK BLURRY". A photo is never
   drawn wider, in device pixels (CSS width times the screen's pixel ratio, counting any object-fit crop),
   than its real detail: a real photo's file width (camera originals), about 1600 px for a staged
   `styled-*.jpg` (each is an upscale of a Gemini output of about 1024 px; `STAGED_DETAIL_PX` and
   `detailWidth()` in `photos.ts`), 1024 px for `share-rose-bouquet.jpg`. Photo.astro ships no file wider
   than that detail; the viewer (Figure.astro) caps its image at the detail divided by
   `devicePixelRatio`, so a staged photo opens at most 800 CSS px wide on a 2x screen; the booking summary's
   photo has a 960 px file for its 360 px frame; the home share card (the bouquet) is written at 1024 x 538.
   No hover or CSS transform scales a photo up. Where a frame would be too big, cap the frame (max-width) or
   change the layout; never enlarge the photo. Check every route at 390 x 844 at 3x, 768 at 2x, 1440 x 900 at
   2x, and 1920 x 1080 at 2x, and look at 100% crops of the largest displays. The hero rose clip is footage,
   not a photo of the property, and is measured against the same rule: see brand.md, "The hero loop".

## What the audit found (why these changes)

- Every photo on the site has something on it. The caption panel covers the lower third of the hero on The
  Space, /events/, all eight event pages, and the 404 (on the 404 it hides the gazebo's base). Every card on
  home, /events/, The Space gallery, and the event pages' "Other events" carries the frosted label strip,
  which covers 35 to 50 percent of the photo on a 390 phone. Every staged photo carries the Styled Concept
  pill in its corner, and every enlargeable photo carries the enlarge button in another corner.
- Heroes are cover-cropped to a fixed band (100svh minus the bar on desktop, 80svh on phones), so the
  portrait file is cut at the sides on tall phones and the 3:2 staged photos are either cut or stacked.
- Navigation is layered: the header, then a sticky AnchorBar on The Space, every event page, and the FAQ,
  then on The Space a VerticalTabs list that repeats the AnchorBar's first three entries. On a 390 phone two
  sticky bars take 116px of every screen.
- Booking is offered five times on the home page (header, hero, the date checker, the closing band, the
  footer) and four times on every other page. The footer opens with a blurb that restates the site
  description, then repeats Check Availability.
- The rates sentence appears on home, Rates, the FAQ, and every event page. Capacities appear on the home
  cards, The Space header, The Space panels, every event hero, and the event prose. What the rental includes
  appears on home (the feature strip), The Space (the checklist), Rates (a panel), and the FAQ. The address
  appears in the menu, home, The Space, the FAQ, and the footer.
- Several lazily loaded photos rendered as grey boxes in the full-page captures (The Grove panel, the home
  arrival photo, most event cards). This is a capture-timing artifact, but it will mislead the lead's review
  if it recurs, so the acceptance captures wait for every image to decode (section 7).

## 0. What this version supersedes

The following rules in `brand.md` (v6), `redesign-spec.md` (v5), and `fable-advice.md` are withdrawn. The
builder amends those documents in the same change set (a short "superseded by version 7" note at the top of
each affected section is enough; do not rewrite them).

| Document | Rule withdrawn |
|---|---|
| brand.md, "Version 6 amendments" 4 and 6 | See-through caption panels over photos; photo card labels on a frosted White strip. No label, panel, or strip over a photo of any kind. |
| brand.md, Color, "Caption panels over photos" and "Photo card labels" | The whole subsections, including the `FROST` table, the legibility and appearance floors, and the strip opacity. There is nothing to measure over a photo any more. |
| brand.md, Photography, "Staged photographs show events" | "each with the same small Styled Concept badge" and "Event page heroes carry the caption ... " as a panel line. The disclosure moves under the photo (section 2, Disclosure). The all-or-nothing rule, the no-repeat rule, and the no-cropped-subjects rule stay. |
| brand.md, Version 5 amendment 5 and fable-advice.md point 5 | Cards with the label and capacity inside the photo over a scrim, and "no white card body under the photo". Labels sit under the photo on the page surface (no box). |
| brand.md, Version 5 amendment 2 and fable-advice.md, Decisions | "the closing band on every page carries Check Availability too". The closing band is removed. |
| brand.md, Motion and graphics, "The hero loop" | The petals clip and its veil values. Replaced by section 6. |
| brand.md, Redundancy rules, footer bullet | The footer's columns are redefined in section 3. |
| redesign-spec.md section 1, table rows for the hero caption panel, cards, the venue page (anchor bar, vertical tab list), and the footer statement with a pill | Replaced by sections 1 to 3. |
| redesign-spec.md section 3, the rows for `PageHero`, `PhotoCard`, `AnchorBar`, `VerticalTabs`, `CtaBand`, and the `phone="stack"` paragraph | These components are removed (section 2). |
| redesign-spec.md section 4, every page plan | Replaced by section 5. |
| fable-advice.md, "What makes Wedgewood feel like Wedgewood" points 3, 5, 6 | The caption panel over the hero, the label inside the photo, the sticky anchor bar and vertical tab list. The rest of that list (one serif, the header, section headers, the footer statement, mobile stacking) still applies. |

Everything else stands: the v6 palette (White page, Blush footer, Petal bands and panels, Peony buttons,
Cerise accents, Plum ink, light only), the type scale, the header and the morph, the button system, the
spacing and container system, the Photo component's responsive sources and viewer, the no-prices rule, the
separation rule, the voice rules, and the no-dashes rule (which applies to this document too).

## 1. Design angle: editorial, photo whole

**The photograph is the page's largest element and nothing touches it.** Every photo is set in a plain 12px
frame (`--r-card`) at its own aspect ratio, 3:2 for the landscape files and, below 46.5rem, the 4:5 portrait
file where one exists. Staged photos have no portrait file and stay 3:2 at every width. There is no
`object-fit: cover` into a frame of a different ratio anywhere on the marketing site; the only cropping that
remains is the booking wizard's 76px thumbnails, which are 3:2 files in 3:2 frames (no crop).

**Text lives beside the photo on desktop and below it on phones.** Three arrangements cover the whole site:

| Arrangement | Desktop (from 60rem) | Phone | Used for |
|---|---|---|---|
| **Page intro** (`PageIntro`) | Two columns, 5:7: the text block left (eyebrow, h1, lead, descriptor links, one action), the photo right, both top-aligned; the caption under the photo | The text block, then the photo, then the caption | The top of The Space, /events/, every event page, the 404 |
| **Editorial split** (`ImageTextSplit`, kept) | 1:1, photo left or right (`flip`), vertically centred; the caption under the photo | Photo, caption, then the copy; the split that directly follows a page intro puts its copy first on phones (`copyFirst`), so two photos never stack back to back | Mid-page sections: each space on The Space, the grounds, Find us on home, the rates split on Rates, About on an event page |
| **Figure** and **figure card** (`Figure`, `FigureCard`) | The photo, then under it on the page surface the label (Caslon Text 1.25rem, Plum), a meta line (Caslon Text, Mauve), and an italic caption where there is one | The same, stacked | Space cards, event cards, gallery figures, extra views in a section |

**Captions.** Every caption is Caslon Text italic 1rem, Mauve, 0.75rem under the frame, left-aligned to the
frame's edge. Captions say what the photo shows ("The Hall, toward the fireplace wall"), and on a staged
photo they begin with the disclosure (section 2).

**Rhythm.** Sections keep `--section` padding and the hairline between them. Because photos are no longer
cover-cropped to a viewport band, a full-width 3:2 photo at 1440 would be 853px tall inside the container;
the page intro's 5:7 split keeps the photo at about 740 x 493 beside the title, so the title, the lead, the
photo, and the first action all sit in the first screen on a 1440 x 900 desktop. On a 390 phone the intro's
text is the first screen and the photo arrives on the first scroll, whole, with its caption.

**Polish from the reference, without its overlays.** Keep the reference's section header (light serif h2,
half-width lead, one pill plus one text link aligned right), the 96px section rhythm, the large serif footer
statement, the flat cards without shadow, and the capsule buttons. Do not take its caption boxes, its scrims,
its label-in-photo cards, or its tab bars.

## 2. Component changes

### Removed

| Component | Replaced by | Notes |
|---|---|---|
| `PageHero.astro` | `PageIntro.astro` | The `FROST` table, `phone="stack"`, `PHONE_SIZES`, `height`, `descriptors` as plain text, and `facts` go with it. |
| `PhotoCard.astro` | `FigureCard.astro` | No strip, no text inside the frame. |
| `AnchorBar.astro` | nothing | No in-page sticky bar on any page. `scroll-margin-top` on sections stays at `var(--nav-h) + 1rem` for links from elsewhere (the home space cards link to `/the-space/#hall` and so on). |
| `VerticalTabs.astro` | plain sections | The Space is three editorial splits in a row, each with an `id`. |
| `CtaBand.astro` | the footer's Plan column and each page's one primary action | The closing band's sentence ("Choose a date and a space ...") survives only as the /book/ lead. |
| The `badge` prop and `.photo__badge` in `Photo.astro` | the caption | Also removed from `Photo`: `ratio="fill"` (nothing fills a band any more), `tallSizes` (no frame is taller than the 4:5 file). |
| The `.photo__zoom` button over the frame | the figure itself and an "Enlarge" button in the caption | See "Enlarge" below. |

### `PageIntro.astro` (new)

Props: `id`, `eyebrow`, `title` (the h1), `lead`, `links` (an array of `{ label, href }` rendered as a row
of Caslon Text links with chevrons, used for an event's spaces linking to `/the-space/#hall` and so on; on
The Space they are the three space anchors), an `actions` slot (one button, or none), `photo`, `caption`
(string; on a staged photo the component prepends the disclosure itself), and `breadcrumbs` (optional; event
pages pass them and they render above the eyebrow, in the text column). Desktop: a 5:7 grid, the text column
with `max-width: 34rem`, the photo column a `Figure` at 3:2 with `priority` (it is the page's main image and
loads eagerly). Phone: text, photo (4:5 file where present), caption. The photo is enlargeable.

### `Figure.astro` (new) and `FigureCard.astro` (new)

`Figure`: wraps `Photo` and adds the caption line and the enlarge affordance. Props: `photo`, `sizes`,
`tall` (default true), `caption` (string or `true` for the photo's own caption), `priority`, `class`. A
staged photo always gets the disclosure in its caption, even when the page passes none.

`FigureCard`: a `Figure` without a caption, followed by `label` (h3 by default, `headingLevel` to change),
`meta` (optional), and `note` (optional, the italic caption style). With `href` the whole card is one link
named by its label and has no enlarge; without `href` it is a gallery figure with the enlarge affordance.
Hover on a linked card: the label underlines; the photo does not scale (the scale transform read as motion
over the photo and is dropped). Focus: the ring around the whole card. Rendered width hints (`sizes`) are
passed through as today.

### Enlarge (the viewer)

The tap-to-enlarge viewer stays, with nothing drawn over the photo:

- The figure's frame is a `<button type="button">` (or the `<a>` on a linked card, which has no enlarge) with
  `cursor: zoom-in`, `aria-label="Enlarge photo: {alt}"`, and the usual visible focus ring around the frame.
- The caption line ends with a text button "Enlarge" (Caslon Text, Cerise, 44px tall target, visible focus)
  that opens the same viewer. It is the obvious affordance on touch screens and for screen readers; the frame
  button is the convenience. Where a figure has no caption text, the caption line holds "Enlarge" alone.
- The viewer (`.lightbox`) is unchanged: the whole file, its alt text, and its caption line, which carries the
  disclosure for a staged photo.

### Disclosure (the Styled Concept badge, moved)

Honesty rule, unchanged in substance: every staged image declares itself on the image itself, not only
somewhere on the page. In version 7 the declaration is text under the photo, never a pill on it:

- A single staged photo (a page intro, an editorial split, a figure) carries the full line in its caption:
  "Styled concept. Décor is not included." followed by what the photo shows where that helps ("Styled
  concept. Décor is not included. A ceremony in The Main Hall.").
- In a grid or row of staged cards (the /events/ grid, the home events figure), each card's meta line
  begins "Styled concept" (two words, Mauve) and the full sentence appears once in the section's lead
  (`EVENTS_STYLED_NOTE`). So a visitor who scans one card still sees the disclosure on that card, and the
  sentence is not printed eight times.
- The alt text keeps its "Styled concept:" prefix; the viewer caption keeps the full line.

### `ImageTextSplit.astro` (kept, amended)

Gains `caption` (passed to the `Figure` it now wraps). The photo keeps 3:2 (4:5 on phones). Nothing else
changes.

### `Carousel.astro` (kept, narrowed)

Used in exactly one place: the home spaces row, where it gives phones a swipeable row of three
`FigureCard`s at 82 percent width and desktops three columns. Everywhere else cards are grids. Its dots and
arrows sit under the row, on the page, as now.

### `Photo.astro` (kept, trimmed)

Loses `badge`, `ratio="fill"`, `tallSizes`, the zoom button markup, and the badge styles. Keeps the AVIF and
WebP sources, the widths, the portrait source below 46.5rem, `priority`, `rounded`, `crop` (now unused by
any page and may be removed with it), the viewer script, and `.lightbox`.

### Header, menu, footer

See section 3. `Header.astro` keeps its structure (links, lockup, phone, Check Availability; the full-screen
dialog on compact screens) with the link order changed and the Events row of the menu expandable.
`Footer.astro` loses the blurb and the button.

### Event pages and `events.ts`

The hero panel's data has nowhere to go and is retired or re-homed:

- `EventType.spaces` stays: it feeds the page intro's `links` (each space name linking to its section on
  The Space) and the booking wizard's suggestions. It no longer produces a capacity fact.
- `EventType.leadTime` is retired from the page and from the type, with its data comment. Booking lead
  times are not stated anywhere (the client's rule 2, above): no prose, no FAQ, no fact.
- The "Rates vary with the season ..." line beside the checklist is removed (section 4).

### The booking wizard

`SpaceThumb` and `SummaryCard` already show the real photos whole (a 3:2 file in a 3:2 frame, beside or
above the text, nothing over them) and stay exactly as they are. The /book/ title band (text only) stays.
Nothing in the wizard places text over a photo, so the task's wizard item is closed by inspection; the
acceptance check in section 7 covers it anyway.

### The 404

`PageIntro` with the gazebo: eyebrow "Page not found", h1 "This page could not be found", the lead, and the
link list in the text column (the list replaces the action), the photo beside it. No band, no overlay.

### Share images and emails

Unchanged. The share cards place their panel beside the photo already (the home card) or on a scrim-free
photo with a near-solid panel; a share image is a static preview, not a page, and the client's complaint is
about pages. The builder may revisit them after the lead's review.

## 3. Navigation

### The structure

Five pages, one list, the same everywhere:

| Order | Label | Path | Why it is there |
|---|---|---|---|
| 1 | Home (the lockup) | `/` | The welcome, the three spaces, the date checker, the events list, where we are |
| 2 | The Space | `/the-space/` | What you rent: the three spaces, the grounds, what is included, a visit |
| 3 | Events | `/events/` | The eight occasions, each with its own page |
| 4 | Rates | `/pricing/` | The approved wording, the Call button, the deposit and hours ("Before you book", #before) |
| 5 | FAQ | `/faq/` | Every question with a short answer and a link to the fact's home |
| (action) | Check Availability | `/book/` | The booking wizard; event pages pass their event |

Rates and FAQ stay separate: Rates is where a visitor acts (call) and the FAQ is where they read. A date
request has one home, `/book/`: the inquiry form that once sat on Rates asked for the same space, date,
guests, and hours as the wizard, so it was removed in the review of October 1, 2026.

**Top bar (from 60rem):** The Space, Events, Rates, FAQ on the left (in that order; The Space moves ahead
of Events because it is what the business rents), the lockup centred, the phone and the filled Check
Availability on the right. The current page is underlined in Cerise, as now.

**Phone menu (below 60rem):** the full-screen dialog as now, with these rows in Caslon Display: Home,
The Space, Events, Rates, FAQ; then Check Availability (filled, large) and Call (outline); the address line
is cut (the footer carries it). The Events row is a link to `/events/`, and the eight event names are listed
under it, always open, as a secondary list (Caslon Text 1.125rem, 44px rows), so every event page is one
tap from the menu. Check Availability and Call are pinned to the foot of the menu, so they stay on screen
however long the list runs. On regular screens the footer's Events column lists the eight.

**Breadcrumbs:** event pages only, in the page intro's text column above the eyebrow (Home, Events, the
event). No other page is deep enough to need them; structured data keeps the breadcrumb lists it has.

**In-page navigation:** none. No AnchorBar, no VerticalTabs, no sticky second bar. The Space's intro has
three descriptor links (The Hall, The Main Hall, The Grove) that jump to the sections; that is the only
in-page jump list on the site, and it scrolls away with the intro.

### One primary action per page

| Page | Primary action (one filled button in the page body) | Secondary (text links) |
|---|---|---|
| Home | Check Availability in the welcome; the date checker's Continue to Booking is the same action in-page and is the only other filled button on the page | Explore The Space, See All Events, Get Directions (outline) |
| The Space | Request a Visit (the visit section) | Get Directions (outline) |
| Events | none in the body: the cards are the action | See All Events is the page itself; nothing else |
| Event page | none in the body: the header's Check Availability already carries the event | Request a Visit (outline, in the checklist), Ask about rates, See All Events |
| Rates | Call (948) 205-2934 | Send Inquiry is the form's submit (filled, inside the form, as every form submit is) |
| FAQ | none | links inside answers |
| Book | the wizard's Next and Send Request | none |
| 404 | the link list | the phone line |

The header's Check Availability is filled on every page except /book/, as now. The footer offers booking as
a text link, not a button.

### The footer

Blush under a hairline, three rows:

1. The large centred serif statement, `site.tagline` ("Celebrate among the pines.") on its own, first.
2. Four columns. **Explore:** The Space, Events, Rates, FAQ. **Events:** the eight event pages, so each is
   one click from any page on desktop. **Plan:** Check availability (event-aware `bookHref`) and Request a
   visit. **Visit:** the address as a directions link, the phone, the
   email, the contact person. This is the one place the phone, the email, Faith VanDyke, and the address all
   appear together, and it is on every page.
3. The lockup (a home link) and the legal line; the demo note where `isDemo`.

Cut: the blurb ("Indoor and outdoor event rentals in Suffolk, Virginia: ...", which restates the site
description and the home lead) and the Check Availability button (the header has it; Plan links to it).

## 4. Redundancy: one home per fact

### The fact table

Every fact below has one home. Everywhere else it appears as a link to that home, or not at all. Structured
data, llms.txt, meta descriptions, and the emails are outside this rule (they are machine-facing or sent
alone) and keep stating facts.

| Fact | Home | Linked from |
|---|---|---|
| The three spaces and their capacities | The Space, each space's split (the lead names the space; the fact row gives "Up to N guests") | The home space cards carry "Up to N guests" as their meta line because the card is the link to that section and a capacity is what makes the card useful; nowhere else on home. Event prose may name a capacity in its own copy (events.ts allows it in the first section only). FAQ "How many guests" answers in one sentence and links to The Space. |
| What the rental includes (the space, tables and chairs, on-site parking) | The Space, "What the rental includes" checklist | FAQ "What is included" links; Rates links ("What the rental includes is on The Space"). Cut from home (the feature strip) and from Rates (the panel). |
| The amenities (ballroom seating, hospitality areas, flexible layouts) | The Space, the amenities strip | nowhere else |
| The grounds, parking, directions | The Space, the grounds split (lead, Get Directions) | Home "Find us" (the address and Get Directions, which is arrival rather than a repeat), the footer's Visit column |
| The address | The footer | Home "Find us" (#location) shows it once beside the directions button, the only Get Directions button in a page body; FAQ "Where is" answers it (it is the question) and links to #location; cut from the menu and from The Space's grounds split |
| The rates wording | Rates, the rates split | Home: no rates band (cut); FAQ "How much does it cost" answers "We quote each event personally. See Rates to call us or send an inquiry." and links; event pages: cut the shared line, keep "Ask about rates" beside the checklist |
| The phone number | The footer and the header (icon on phones, number on desktop) | Rates: the Call button (it is the action); 404: the "or call us" line; the repast page's prose (contextual, kept); cut from the home rates band (gone), the menu (the Call button stays, the address line goes) |
| The email and the contact person | The footer | Rates: "Ask for Faith VanDyke" line under the Call button (kept: it is the inquiry page); nowhere else |
| The deposit and the building hours | Rates, a single "Before you book" panel (#before; two lines: the deposit sentence, the hours with the setup rule) | FAQ "How do deposits work" and "What days and hours" answer in one sentence each and link; the wizard states "Events end by 12:00 midnight" in its hours hint (a form hint, kept) |
| The styled-concept disclosure | Under each staged photo (section 2) | The section lead on /events/ carries the full sentence once; home's events split has one staged photo, so its caption carries it and the lead does not |
| The list of events | /events/, the grid | Home: the eight names as a text list beside one staged figure; the phone menu and the footer: the eight as navigation; event pages: three "Other events" text links; FAQ "What kinds of events" answers in one sentence and links |
| Setup and cleanup time | `SETUP_CLEANUP_RULE` in src/shared/booking-rules.ts ("Your booked hours include time to set up and clean up.") | Used word for word by the FAQ hours answer, Rates' Before you book, and the wizard's hours hint |
| Capacities | The Space (and the home space cards, which link there) | Event pages describe why a space suits the occasion without numbers; the wizard's space rows show them (a form that collects the choice) |
| Booking lead times | none: never stated (the client's rule 2) | nowhere; the two-year limit on online requests is behavior only, and its message states no timeline |
| How booking works ("choose a date and a space, send your request, we confirm personally") | /book/, the title lead | Home date checker lead: shortened to "See which spaces are open on your day." Cut from the closing band (gone) and the events index ("Planning something else?" band gone; the sentence moves to the /events/ lead as "For another kind of event, describe it in your request.") |
| The visit request | The Space, the visit section | Event checklists (Request a Visit), the footer's Plan column, FAQ "Can I see the venue" |
| Hours of operation for calls | not published (`site.hours` is empty) | |

### The FAQ rule

A Q&A page restates facts by nature, so: an answer whose fact lives elsewhere is one sentence plus a link
to the home. Only questions with no other home carry a full answer: who can book, catering (the one neutral
mention), room setup help, the rain plan and other event-page questions, what a repast is, recurring dates,
and so on. The FAQ page shows all four groups on one page with no topic bar. `faq.ts` carries the short
answer only: the `FAQPage` structured data and llms.txt are generated from `publishedFaqs`, so they show the
same one-sentence answer, which is what the page shows, and the facts they point to are already in the
venue's structured data and in llms.txt's own sections.

### Page by page: what is cut or merged

**Home**
- Cut the second "See All Events" link from the spaces heading (the events section has one).
- Cut the events carousel (eight cards); replace with one editorial split: the weddings staged figure with
  its disclosure caption beside the eight event names as links in two columns, and See All Events.
- Cut the feature strip "What every booking includes" (home of those facts: The Space).
- Cut the rates band (home: Rates).
- Cut the closing band and the footer blurb and button.
- Shorten the date checker lead to one sentence; keep the checker.
- Keep the welcome, the spaces row, the checker, "Find us".

**The Space**
- Cut the hero's facts (Location, Capacity) and descriptors; the intro's lead says it in a sentence.
- Cut the AnchorBar and the VerticalTabs; keep the three sections with their ids.
- Cut the "Rates: Ask about rates" fact from each of the three panels (three repeats on one page).
- Cut the intro paragraph's repeat of "Book one space, or The Hall and The Grove together" where the lead
  already says it; say it once.
- Merge the gallery into the sections: each space's extra views sit under its split as figures; the
  Gallery section and its carousel go.
- Cut the address line from the grounds split (the footer has it); keep Get Directions.
- Cut the closing band.

**Events**
- Cut the hero panel; the intro says it in text.
- The grid's cards lose the strip and the badge; meta begins "Styled concept"; the section lead carries the
  full sentence.
- Cut the "Planning something else?" band; its sentence moves into the lead.

**Event pages**
- Cut the hero panel's facts (capacity, lead time) and the breadcrumb band under it; breadcrumbs move into
  the intro.
- Cut the AnchorBar.
- Cut the "Rates vary with the season ..." line beside the checklist; keep Request a Visit and Ask about
  rates.
- "Other events" becomes three text links (no photos).
- Cut the closing band.

**Rates**
- Cut the "What the rental includes" panel (The Space) and fold deposit and hours into one small panel under
  the form.
- Keep: the title band, the rates split (hall-fireplace, wording, Call, the Faith line), the inquiry form
  beside the gazebo portrait.

**FAQ**
- Cut the topic AnchorBar.
- Shorten answers to one sentence plus a link where the fact has a home (capacity, included, rates,
  deposit, hours, where).
- Cut the closing band.

**Book**
- No change except the removal of the site-wide closing band (it never had one) and the footer changes.

**404**
- The caption panel goes; the title, lead, and links sit beside the gazebo.

**Footer (every page)**
- Cut the blurb and the button; move the statement to the top; add Check availability to Plan.

## 5. Page-by-page section order

Every section is `section.section > .container` with the hairline between sections, unless marked as a
band (Petal). "Split" means `ImageTextSplit`; "intro" means `PageIntro`.

### `/` Home

1. **Welcome** (`HeroVideo`, the rose clip, section 6): "Welcome to", the name as the lockup's words, the
   location line, Check Availability. Unchanged morph.
2. **The spaces** (`SectionHeading` + a grid of three `FigureCard`s: stacked whole below 48rem, three in a
   row from 48rem, never a peeking scroller): eyebrow "The spaces", h2 "Two halls and a grove" (not The
   Space's h1), a one-sentence lead about the spaces themselves (the occasions live in Events we host),
   Explore The Space (outline) on the right.
   Cards: hall-windows "The Hall" / main-hall "The Main Hall" / grove-tables "The Grove", meta "Up to N
   guests", each linking to its section on The Space.
3. **Check a date** (`SectionHeading` beside the `DateChecker` island, both top-aligned): lead "See which
   spaces are open on your day." (the checker shows no idle hint, so the sentence appears once). The
   checker's Continue to Booking is the in-page primary.
4. **Events we host** (split, photo left: the weddings staged figure, caption "Styled concept. Décor is not
   included. A ceremony at the gazebo in The Grove."): eyebrow "Occasions", h2 "Events we host", a lead that
   invites other occasions (the caption already carries the disclosure, so the lead does not repeat it), then the eight event names as Caslon Text links in two columns, and See All Events
   (text link). Weddings is the one event whose photo appears on home, so the weddings link in the list is
   still listed (the list is complete).
5. **Find us** (`#location`, split, driveway, caption "The drive and the parking lot"): eyebrow "Getting here", h2 "Find
   us in north Suffolk", the address, Get Directions (outline).
6. Footer.

### `/the-space/`

1. **Intro** (hall-windows, caption "The Hall, with its arched windows and fireplace wall"; the two Main
   Hall photos are the same view down the aisle, so the intro shows The Hall): eyebrow "The Space", h1
   "Three spaces, indoors and out", lead "Well-maintained indoor and outdoor spaces surrounded by nature,
   with bright natural light and a dedicated stage area. Book one space, or The Hall and The Grove
   together.", links The Hall / The Main Hall / The Grove (to the sections), no action.
2. **The Hall** (`#hall`, split, hall-doors left, the opposite end of the room from the intro, caption
   "The double doors and the wall-mounted screen"; `copyFirst`, so on phones the copy comes between the two
   photos): eyebrow "The Hall", h2 "A bright, open room", the lead, fact row Capacity / Features. No extra
   figures.
3. **The Main Hall** (`#main-hall`, split, flip, main-hall-stage right, caption "The raised stage"):
   eyebrow, h2 "Stage seating under a vaulted ceiling", the lead, fact row. No extra figures.
4. **The Grove** (`#grove`, split, grove-tables left, caption "Picnic tables and the gazebo"): eyebrow, h2
   "Among the pines", the lead, fact row; under it two figures: gazebo ("The gazebo") and grove-path ("The
   path to the gazebo").
5. **Premium amenities** (`SectionHeading` + `FeatureStrip`): `site.amenities`.
6. **The grounds** (split, flip, approach-dusk, caption "The drive at dusk"): eyebrow "The grounds", h2
   "Renovated grounds and on-site parking", the lead, Get Directions (outline).
7. **What the rental includes** (`SectionHeading` beside one `Checklist` panel): `site.included`.
8. **Schedule a visit** (`SectionHeading`): the owner's visit wording, Request a Visit (filled), "Or call
   (948) 205-2934" (text link).
9. Footer.

Photo map, each real photo once: main-hall (intro), hall-windows, hall-fireplace, hall-doors (The Hall),
main-hall-stage (The Main Hall), grove-tables, gazebo, grove-path (The Grove), approach-dusk (the grounds).
driveway is the home arrival photo and is not on this page. grove-pines is on no page (it is the venue's
image in structured data, and it is cut from the same original as grove-path, so it never shares a page with
it); exterior-dusk stays unused.

### `/events/`

1. **Intro** (styled-wedding-indoor-ceremony, caption "Styled concept. Décor is not included. A ceremony in
   The Main Hall."): eyebrow "Events", h1 "Weddings, celebrations, and gatherings in Suffolk", lead "Each
   occasion has its own planning guide, the space that suits it, and a practical checklist. For another kind
   of event, describe it in your request and we will confirm which space suits it.", no links, no action.
2. **Every occasion we host** (`SectionHeading` with the lead `EVENTS_STYLED_NOTE`, then a grid of eight
   `FigureCard`s, 1 up, 2 from 36rem, 3 from 56rem, 4 from 75rem): label = the event name, meta = "Styled
   concept" followed by a middle dot and the event's one-line summary, each linking to its page.
3. Footer.

Without the staged set (`eventsStaged` false): the intro shows main-hall with its plain caption and the grid
becomes the text list, as the all-or-nothing rule already provides.

### `/events/[slug]/` (template)

1. **Intro** (the event's staged photo, caption "Styled concept. Décor is not included." plus what it
   shows): breadcrumbs, eyebrow "Events", h1 `event.h1`, lead `event.intro[0]`, links = the event's spaces
   (each to its section on The Space), no action.
2. **About this occasion** (split, flip, the second view: weddings gets styled-wedding-indoor-ceremony with
   its disclosure caption; the others get the real photo named in `ABOUT_PHOTOS` with the caption "<space>,
   as photographed"): `event.intro[1..]` in Caslon Text. An event with a one-paragraph intro and no second
   view skips this section.
3. **Planning guide** (`SectionHeading` + two columns): `event.sections`.
4. **Checklist** (`SectionHeading` beside the `Checklist` panel): `event.checklist`, Request a Visit
   (outline), Ask about rates (text link).
5. **Questions** (`SectionHeading` beside `FaqAccordion`): `event.faqs`, where any.
6. **Other events we host** (`SectionHeading` with See All Events on the right, then three Caslon Text links
   with chevrons): `event.related`.
7. Footer (Plan's Check availability carries `?event=<slug>`).

### `/pricing/` Rates

1. **Title band** (Petal): eyebrow "Rates", h1 "Rates and inquiries".
2. **Our special rates** (split, hall-fireplace, caption "The Hall"): eyebrow "By phone", h2, the approved
   wording, Call (filled, large), "Ask for Faith VanDyke, or email faith@venueatncc.org."
3. **Send an inquiry** (the gazebo portrait figure beside the form, caption "The gazebo in The Grove";
   sticky on desktop as now): eyebrow "Contact us", h2, lead, the `InquiryForm` island, then under the form
   a small Petal panel "Before you send" with the deposit sentence and the building hours, and the line "What
   the rental includes is listed on The Space." as a link.
4. Footer.

### `/faq/`

1. **Title band** (Petal): eyebrow "Help", h1 "Frequently asked questions", lead.
2. **Groups**: Booking, The spaces, Rates and payments, About the venue, each the group head on the left
   and the accordion on the right, hairlines between, no topic bar. Answers follow the FAQ rule.
3. Footer.

### `/book/`

1. **Title band** (Petal): eyebrow "Availability", h1 "Check availability", lead "Choose a date and a
   space, and send your request in about two minutes."
2. The `BookingApp` island, unchanged (space rows with their 3:2 thumbnails beside the names, the summary
   card with the chosen space's photo above its rows).
3. Footer.

### `/404`

1. **Intro** (gazebo, caption "The gazebo in The Grove"): eyebrow "Page not found", h1 "This page could not
   be found", lead "The link may be out of date, or the address may have a typo. These pages can help.",
   then the link list (Home, Check Availability, The Space, Events, Rates) and "Or call us at
   (948) 205-2934." in the text column. noindex, no structured data, as now.
2. Footer.

### Footer (every page)

Statement, then Explore / Plan / Visit, then the lockup and the legal line (section 3).

## 6. The hero: pink roses

The client's complaint is that the petals "dont really look like flower petals". The replacement must read
as pink roses on a 390 phone, which shows only the centre of a 16:9 clip, as well as on a desktop, and the
Plum name must stay legible over it without a veil heavy enough to wash the roses out. Both are measured.

### Selection criteria (all must hold)

- Pink rose blooms, clearly roses (open blooms with visible layered petals), filling most of the frame.
  White roses mixed in are fine and match the staging palette; no red roses, no other flowers.
- A soft, pale or softly blurred background. Little or no green foliage, no garden setting, no sky, no
  table or vase that reads as a product shot. The Mixkit droplet clips (items 100900, 100901, 100902) are
  garden scenes with foliage and are second choices at best.
- Slow motion only: a drift, a slow push, or near-stillness. No drops splashing, no hands, no people, no
  building, no room, nothing that could be mistaken for the property.
- The centre third of the frame (what a portrait phone shows) must itself read as roses.
- 2560 wide or better from the source rendition (4K preferred), loopable with a crossfade as the current
  clip is, 8 to 15 seconds.
- A licence that allows commercial use without attribution: the Mixkit Stock Video Free License, the Pexels
  licence, or the Pixabay Content License. The source URL, author, licence, download date, and edit are
  recorded in `public/media/CREDITS.md`, as for the petals.
- The petals files (`hero-petals.*`, both posters) move to `design-archive/hero-petals/` with their credit
  (a move of exactly this kind is already staged in the worktree, with `hero-roses.*` files beside it in
  `public/media/`; whoever finishes that work records the clip in CREDITS.md and checks it against the
  criteria above); nothing generated or licensed is deleted.

### Candidates found on October 1, 2026 (the builder reviews each against the criteria; none is approved yet)

- Pexels: "Vibrant Pink Roses in Bloom Close-up" (video 38707625); "Close Up Of Pink Rose Flower" (video
  855281); "Beautiful Close-up of Pink Roses in Bloom" (videos 34972554 and 32342282); "Pink Roses in Bloom"
  (videos 12595892 and 12090929). Several are garden shots; check the background.
- Mixkit: "Pink rose underwater" (item 171, a single bloom on black: the wrong background for a white site),
  the three droplet clips above, "Pink rose with water drops on the petals" (item 40294, a bouquet).
- Pixabay: search "pink roses" (over 1,200 clips); filter 4K.

If no clip meets every criterion, the fallback is a still: a photograph of pink and white roses meeting the
same criteria, shown as the poster with no video, under the same veil rules. The home share card's rose
still life (`share-rose-bouquet.jpg`, generated) is not a candidate for the page: brand.md allows it only as
the share card.

### The veil and the floors (both measured, both must pass)

- **Legibility floor.** Over the brightest frame of the clip at 360, 390, 768, 1440, and 1920, sampled as
  today (12 frames, the 2nd-percentile pixel behind each line): the Plum name at 7:1 or better, the Cerise
  "@ NCC" at 4.5:1 or better, "Welcome to" and the location line at 4.5:1 or better. The 7:1 on the name
  keeps the version 5 acceptance figure.
- **Visibility ceiling.** The roses must stay recognisable: the first screen's mean HSL lightness between
  78 and 90 at 390 and 1440 (version 6 is about 95, which is what washed the petals out), the veil's centre
  no stronger than White at 0.5, and no colour blend layer (the portrait Peony tint was there to pink the
  white petals; pink roses need none). Saturation is not reduced by the veil.
- The clip's own brightness and saturation may be graded in the edit (as the petals were) to meet both
  floors before the veil is tuned; record the grade in CREDITS.md.
- Reduced motion shows the poster (a frame of the same clip); the portrait poster is the centre of the same
  frame at 9:16. The morph, the solid bar threshold, and the welcome's layout do not change.

The lead reviews the chosen clip at 390 and 1440, at the top of the page and mid-morph, before it is
committed.

## 7. Acceptance

The reviewer and the lead run these on `dist/` and `dist-demo/` at 390 x 844 and 1440 x 900, with every
image decoded before capture (scroll to the bottom, wait for `document.images` to all report `complete` and
`naturalWidth > 0`, scroll back, then capture). Grey boxes in a capture are a failed capture, not a pass.

1. **Nothing over any photo (automated).** For every `<img>` inside a `.photo__frame` on every route, sample
   a 5 x 5 grid of points over the image's box with `document.elementsFromPoint`. The elements returned above
   the image may only be: the image, its `<picture>`, the frame, the figure's button or the card's link, the
   figure, the card, and the carousel track. Any element with non-empty text content, any element with a
   background colour or backdrop filter, and any `.photo__badge`, `.pcard__text`, `.phero__panel`, or
   `.photo__zoom` fails the route. The sticky header is excluded only while the image is scrolled under it
   (sample with the image scrolled into the middle of the viewport).
2. **No cover crop (automated).** For every `.photo__frame`, the frame's aspect ratio equals the rendered
   source's ratio within one percent (3:2 for the landscape files, 4:5 for the portrait files below
   46.5rem, the booking thumbnails' 3:2).
3. **No repeats (automated).** No photo file name appears twice on one route (the existing check).
4. **Disclosure (automated).** Every `<img>` whose alt starts "Styled concept:" has, in its figure or card,
   a caption or meta line that contains "Styled concept".
5. **Navigation.** Every top-level page is one tap from the phone menu; every event page is one tap from
   the expanded Events row; no sticky element other than the header (and the wizard's own bottom bar on
   /book/); one filled button in each page body as table 3 lists; the footer has no button.
6. **Redundancy.** The fact table in section 4 is checked fact by fact against each route's text: a fact
   appears on its home and otherwise only as a link or in the forms that exist to collect it.
7. **The morph** lands in the bar at 390 and 1440 with the new clip; reduced motion shows the poster and the
   lockup at once.
8. **Contrast and legibility.** The hero floors in section 6; axe with no serious or critical issues; Plum
   and Mauve captions on White at 14.2:1 and 7.6:1 (no measurement needed, nothing is over a photo).
9. **No sideways scroll** at 320, 390, 768, 1024, and 1440.
10. **Build:** `npx astro check`, `npm test`, `npm run build`, `npm run build:demo` all pass.
11. **The lead reviews** captures of every route at both sizes, the top of each page and after scrolling,
    the phone menu open and the Events row expanded, the viewer open on a staged photo, and the hero clip,
    before anything is pushed. Nothing is pushed until then.

## 8. Build order

1. `Photo`, `Figure`, `FigureCard`, `PageIntro`; amend `ImageTextSplit`; remove `PageHero`, `PhotoCard`,
   `AnchorBar`, `VerticalTabs`, `CtaBand`.
2. Header (link order, the Events row), footer.
3. Pages in this order: The Space, /events/, the event template, 404, home, Rates, FAQ, book.
4. `events.ts` (retire `leadTime`), `faq.ts` (the FAQ rule), `site.ts` comments.
5. The hero clip (section 6), last, so the lead can review it on its own.
6. brand.md, redesign-spec.md, and fable-advice.md: the "superseded by version 7" notes from section 0.
7. The acceptance run (section 7), then the lead's review.
