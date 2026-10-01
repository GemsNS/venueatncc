# The Venue @ NCC: redesign specification (version 5)

The site is rebuilt, page by page and component by component, on the patterns of the reference site
(https://www.wedgewoodweddings.com/) at 390 and 1440. Its patterns, layout system, rhythm, and quality are
adopted; none of its content, text, logos, or photographs. This document is the build spec for every page
owner. It applies on top of `brand.md` (version 5 amendments below) and `fable-advice.md` (the creative
director's binding decisions). Where the three disagree, `fable-advice.md` wins, then this spec, then `brand.md`.

Reference captures (home, a venue page, the gallery, packages, the venues index, the contact and tour form,
the mobile menu) are in the redesign scratchpad folder `redesign2/ref/`.

## 1. What the reference does, and what we take from it

| Reference pattern | What we build |
|---|---|
| One serif (Canela) carries nav links, buttons, leads, captions; a sans only for small body and forms | Libre Caslon Display for headings and the footer statement, Libre Caslon Text for nav links, button labels, leads, card labels, section copy, and captions; Inter (the interface stack) only for forms, the booking wizard, the admin, chips, and small labels |
| Header: links left, lockup centred, phone and a dark pill right; transparent over the hero, then a solid cream bar | The same, in our colours: transparent over the home hero, then a solid White bar (version 6) with a hairline as the hero leaves. Inner pages start with the solid bar (as the reference's venue page does); a page may pass `headerOver="photo"` to the layout for white text over a photo instead |
| Full-viewport video hero; content slides up over it; a rounded translucent caption panel bottom-left | A 100svh hero with a fixed, muted, looping petals video under a Blush overlay. On home the H1 "Welcome to The Venue @ NCC" is centred, not in a caption box, and morphs into the header lockup. Inner pages use a photo hero with a caption box bottom-left |
| Section header: 48px light serif h2 left, half-width lead beneath, pill button plus text link with chevron aligned right; a hairline between sections; about 96px of padding | `SectionHeading` and `.section` with `--section` = 96px on desktop; `.section + .section` draws the hairline |
| Cards: label and capacity inside the photo over a bottom scrim, 12px radius, in carousels that bleed past the viewport edge | `PhotoCard` and `Carousel` |
| Venue page: full-bleed hero with a caption box (name, adjectives, LOCATION / TYPE / CAPACITY), a sticky anchor bar, a left vertical tab list beside a photo and copy, a photo carousel, cards, FAQ, "Getting to" with address and map, a closing band | `PageHero`, `AnchorBar`, `VerticalTabs`, `Carousel`, `FaqAccordion`, `ImageTextSplit`, `CtaBand` |
| Checklist panels (the packages "essentials" grid) | `Checklist` |
| Contact and tour form: a full-width serif title band, then a photo beside the form; the fields sit in a tinted panel | The Rates inquiry form and the booking steps follow this arrangement |
| Footer: a dark surface with a short statement and a pill, three link columns, a very large centred serif statement, social row, legal line | `Footer` on Plum with the white lockup and Pink accent |
| Mobile: a menu button left, the lockup centred, one action right (the reference's search; ours is the phone); a full-screen menu with large serif links; no bottom bar of any kind; carousels stay swipeable | `Header` with its full-screen menu. Check Availability sits at the top of the menu and in the closing band of every page, so booking is always one tap away without a bar over the content |

## 2. Design system

### Colour

**Version 6 (October 1, 2026) supersedes this section: bright, white-first pastel pink, light only.** White
is the page, the bar, cards, panels, and the menu; the footer is Blush (very pale pink) under a hairline, with
no dark block; Petal is the quiet band and panel colour. Peony `#D6336C` fills buttons (white label 4.6:1),
Cerise `#C2185B` is the hover fill, links, accent text, focus rings, and the lockup's "@ NCC"; Plum `#3B2430`
stays the ink. Berry and Berry Deep are retired, and every dark-mode rule is removed (`color-scheme: light`).
Hero caption panels over photos are see-through frosted White (opacity tuned per photo, Plum text, blur 12px,
saturate 1.2, a white hairline), measured to 4.5:1 at 390, 768, 1024 and 1440. The full palette, the
contrast list, and the per-photo opacities are in `brand.md`, Color. The text below records version 5.

The version 4 pastel pink palette stays (`brand.md`, Color): Plum `#3B2430`, Mauve `#6A4B57`, Berry `#9E2B52`,
Berry Deep `#7E1F41`, Rose `#B5456E`, Pink `#E9A9BB`, Rose Mist `#EFC5D0`, Petal `#F6DFE5`, Blush `#FBF1F3`,
White `#FFFFFF`. Two amendments:

- **Page surface.** The page is Blush (`--bg`), like the reference's cream; White is for cards, form panels,
  and the inner-page hero caption panels. The old alternate-band rhythm (White, Blush, White) is replaced by one
  surface with hairlines between sections. `--bg-grouped` now points to Petal for the few quiet panels.
- **One dark surface.** The footer is Plum (`--footer-bg`) with Blush text, Pink links, and the white lockup:
  the reference's dark footer, in our family. Plum is otherwise still never a large surface in light mode.
  Contrast on Plum: Blush 12.8:1, Petal 11.2:1, Pink 7.3:1, white 14.2:1.

Contrast floors are unchanged: Plum on Blush 12.8:1, Mauve on Blush 6.9:1, Berry on Blush 6.5:1, white on Berry
7.2:1. Pink, Rose Mist, and Petal are never text on a light surface; `--label-3` is never set on Petal.

### Type scale (rem at the default text size; every step is a clamp between phone and desktop)

| Token | Phone | Desktop | Face | Use |
|---|---|---|---|---|
| `--t-display` | 2.75rem | 5.5rem | Caslon Display | The welcome name is the lockup's own outlines, not text; this size is for a display line on a hero caption |
| `--t-large-title` | 2.25rem | 3.5rem (56px) | Caslon Display | Inner page h1 (the reference's 56px hero title) |
| `--t-title-1` | 2rem | 3rem (48px; 47px at 1440) | Caslon Display | Section h2 (the reference's 48px light h2), light weight, line-height 1.08 |
| `--t-title-2` | 1.5rem | 1.75rem | Caslon Text | Sub-heads inside a section (a tab's title, a card group title) |
| `--t-title-3` | 1.25rem | 1.25rem | Caslon Text | Card labels, checklist heads, FAQ questions |
| `--t-lead` | 1.0625rem | 1.1875rem | Caslon Text | The lead under a section heading; half the container wide |
| `--t-body` | 1.0625rem | 1.0625rem | Inter by default; `.t-copy` sets Caslon Text for running copy in sections (tab panels, FAQ answers, event prose) | Copy. The reference sets its small feature copy in a sans and its longer venue copy in the serif; `.t-copy` is that serif |
| `--t-ui` | 1rem | 1rem | Caslon Text | Nav links, button labels, `.link-more`, card meta, anchor and tab labels |
| `--t-subhead` / `--t-footnote` / `--t-caption` | 0.9375 / 0.8125 / 0.75rem | same | Inter | Chips, badges, form hints, legal |
| `.eyebrow` | 0.8125rem | same | Caslon Text 400, 0.16em, uppercase, Berry | The small label above a heading (the reference's letterspaced serif "CONTACT US") |
| `.t-statement` | 2.5rem | 4.5rem | Caslon Display | The footer's centred statement |
| `.t-label` | 1.25rem | same | Caslon Text | A serif label between 18 and 22px: card names, checklist heads, feature titles |

Headings are sentence case; button labels are Title Case. No em or en dashes anywhere.

### Spacing scale

`--space-1` 4px, `-2` 8px, `-3` 12px, `-4` 16px, `-5` 24px, `-6` 32px, `-7` 48px, `-8` 64px, `-9` 96px.
`--section` = clamp(3.5rem, 2.5rem + 4vw, 6rem) (56px on phones, 96px on desktop). Section heading to content:
`--space-7`. Card gap: `--space-4` on phones, `--space-5` on desktop.

### Grid and containers

`--max` 1280px; `--gutter` clamp(1rem, 5.5vw, 5rem) (16px on a 390 phone, 80px at 1440, matching the
reference's 80px margins). `.container` = min(100% - 2 gutters, --max). Full-bleed sections (heroes, carousels)
use the `.bleed` grid: `[full-start] gutter [content-start] container [content-end] gutter [full-end]`.
Two-column splits are 5:7 or 1:1 from 60rem; card rows are 2 up from 36rem, 3 up from 56rem, 4 up from 75rem.

### Radii and shadows

Cards and photos 12px (`--r-card`); panels 16px (`--r-md`); hero caption panels 20px (`--r-lg`); buttons and
chips are capsules. Cards carry no shadow at rest (the reference's cards are flat); the hero caption panel and
menus use `--shadow-2`. Hairlines are `--separator` (Plum at 12%).

### Buttons: one component

`.btn` is the only button. Caslon Text 400 at `--t-ui`, capsule, 44px minimum height (52px for `.btn--lg`),
padding 0 22px. Variants: `.btn--filled` (Berry with a white label, the reference's dark pill; hover Berry Deep),
`.btn--outline` (a 1px hairline and label in the current text color, so it is Plum on the page and white on
Plum or a photo scrim), `.btn--light` (White with a Plum label, for photo scrims and the Plum footer), and
`.link-more` (a Caslon Text link with a chevron, the reference's "Explore Inspiration >"). The glass variant
is gone. The older names `.btn--tinted` and `.btn--gray` now draw the outline look and `.btn--plain` the
quiet text look, so the booking and admin islands already show one system; their owners rename them to
`.btn--outline` and `.btn--plain` as they touch each file. The admin keeps Inter on its buttons by setting
`font-family: var(--font)` in admin.css. The header CTA is filled on every page; an in-page primary may also
be filled (the reference does this), so the old one-filled-button-per-viewport rule is withdrawn.

### Motion

`--ease-out` cubic-bezier(0.22, 1, 0.36, 1); `--dur-1` 160ms, `--dur-2` 280ms, `--dur-3` 480ms. The hero video
loops muted. The name-to-logo morph runs over the hero's height (0 to 100svh minus the bar), transforms and
opacity only, on the browser's scroll timeline (brand.md, "Header and the morph"). The name is the lockup's
own words on one line and moves as one rigid shape: it holds still on the screen while the page scrolls.
"Welcome to" scrolls away above it and the line and the button fade below it over the first 20%; then the
name glides up and shrinks into the bar with an ease-in-out (cubic-bezier(0.65, 0, 0.35, 1)), still moving
as it lands, the ring gathers around it, and over the last 6 pixels the header's own lockup crossfades in
exactly the same place. The client found the earlier ease-out (which bolted and then parked short of the
bar) laggy, so this replaces fable-advice.md's "ease-out" for the morph. Nothing crosses anything. Carousels scroll with native snap. Under `prefers-reduced-motion: reduce`: the video is hidden and
paused and its poster shows, the morph is off (the header lockup shows at once and the bar turns solid after
8px), and every transition is instant.

The hero overlay (version 6) is a bright white veil with a pastel pink cast: White at 0.9 in the centre,
Blush at 0.68 at 70 percent and 0.52 at the edge, over a 0.3 pink-white wash; portrait screens add a Rose Mist
wash at 0.35 under a 0.62 near-white wash. The name carries no halo (no filter on anything that moves):
measured over 12 frames of the clip at 360, 390, 768 and 1440, Plum keeps at least 11.3:1 and Cerise 4.4:1
behind the name, "Welcome to" 6.4:1, and the line 5.0:1.

## 3. Component catalogue (`src/components/`)

| Component | Anatomy | Desktop | Phone |
|---|---|---|---|
| `Header.astro` | Menu button (phones), links (Events, The Space, Rates, FAQ) left, lockup centred, phone and Check Availability right. `over="light"` (default) keeps Plum text; `over="photo"` uses the white lockup and white text until the bar turns solid. Solid Blush with a hairline once the hero (`[data-hero]`) has scrolled past, or after 8px on pages without one. | Three columns, 80px tall with a 52px lockup (72px and 46px from 960px to 1119px) | Menu button left, lockup centred (40px; 44px on tablets in a 72px bar; less only where a 320px screen or large text leaves less room, never under 32px), phone icon right, 64px tall |
| The menu (inside `Header.astro`) | A native `<dialog>` that fills the screen on Blush: a close button where the menu button was, the lockup centred, then Home, Events, The Space, Rates, FAQ in Caslon Display 2.25rem with chevrons, Check Availability (filled, large), Call (outline), and the address. Escape closes it, focus starts on the close button and returns to the menu button, the page does not scroll behind it (`html.menu-open`), and any link inside closes it. | Never shown | Full screen |
| `HeroVideo.astro` | A 100svh section (`data-hero`) whose media is fixed to the viewport: a poster `<img>` beneath a muted, looping, playsinline `<video>` (WebM then MP4) under the Blush overlay; the slot content is centred; the content after it (`.page` on the home page, with its own background) slides up over it. The section makes no stacking context, so the welcome's name can rise above the bar. Reduced motion hides the video, pauses it by script, and shows the poster. | 100svh | 100svh (the poster is cropped by `object-fit: cover`, which is fine for petals) |
| `PageHero.astro` | Full-bleed photo (the `Photo` component, portrait file on phones) with a see-through frosted White caption panel bottom-left (version 6: no scrim, per-photo opacity, Plum text): eyebrow, h1, an optional line of three descriptors, and up to three fact columns (LABEL / value). | The screen under the bar (100svh minus the bar), never taller than the 3:2 photo at that width (66.67vw), so a subject that spans the photo's height (the gazebo) keeps its roof and its base; caption panel 34rem wide | 80svh, the panel spans the width minus the gutter; facts as LABEL: value lines that wrap as text |
| `SectionHeading.astro` | Eyebrow (optional), h2, lead (optional), and actions (a slot) aligned to the right on the h2's line. | Two columns: copy left (max 44rem), actions right | Stacked; actions wrap under the lead |
| `PhotoCard.astro` | The one card. With `href` the whole card is a link named by its label; without one it is a gallery figure whose photo opens in the viewer. The photo fills a 12px-radius frame with a bottom Plum scrim (0 to 0.72); the label (Caslon Text 1.25rem, white) and a meta line (capacity, place) sit inside the photo, bottom-left; a staged photo keeps its Styled Concept badge top-left. | Ratio 3:2, the file's own shape, so nothing is cropped | The 4:5 portrait file (`tall`, default on), so nothing is cropped |
| `Carousel.astro` | A horizontal, scroll-snapping row of slotted cards that starts at the container's left edge and bleeds one gutter past both screen edges; beneath it a progress track of dots (the current one a bar) and round previous and next buttons. `cols` sets how many cards show at once from 46.5rem (2, 3 or 4); phones show one card at 82% width. The controls hide when the row fits; the row is focusable and the arrow keys move it; a focused card scrolls fully into view. Pass `label` for the row's name. | Row of `cols` cards, the next peeking | Swipeable, snap to start |
| `ImageTextSplit.astro` | A photo beside copy (eyebrow, heading, text, actions), `flip` for photo right. | 1:1 from 60rem | Stacked, photo first |
| `FeatureStrip.astro` | Three or four items (`items`): a line icon, a Caslon Text title, one sentence in Inter. The reference's "We Do, So You Can" row; the section's hairline sits above it. | 3 or 4 columns from 60rem | 2 columns from 36rem, stacked below |
| `Checklist.astro` | A Petal panel (`title`, `items`) of check-marked serif items, 16px radius; several panels in a row. The reference's "essentials" panels. | Up to 3 panels across (the page sets the grid) | Stacked |
| `FaqAccordion.astro` | Native `details` rows split by hairlines, no card, the question in Caslon Text 1.125rem with a chevron, the answer in Caslon Text Mauve. | Max 50rem wide | Full width |
| `AnchorBar.astro` | A sticky row of in-page links (`items`: id and label) under the header (the reference venue page's tab bar), horizontally scrollable on phones, the current section underlined in Berry as the page scrolls (`aria-current="location"`). Targets need `scroll-margin-top` of about the bar plus 4rem. | Sticky at `--nav-h` | Sticky, scrollable |
| `VerticalTabs.astro` | A left list of section names (`items`) on a hairline rail, the current one marked in Berry, beside the stacked panels on the right, one named slot per item id (photo, sub-head, copy). Built as in-page anchors with `aria-current`; a small scroll listener marks the current one. | 1:2.2 columns, the list sticky | The list becomes a scrollable row above the panels |
| `CtaBand.astro` | The closing band: a heading, one sentence, one filled Check Availability, on Petal with a hairline (the reference's dark band, kept pastel here). | Copy left, button right | Stacked, button full width |
| `Footer.astro` | Blush surface under a hairline (version 6; Plum until then): a two-line serif statement with a white pill (Check Availability) left and three link columns right (Explore: Events, The Space, Rates, FAQ; Plan: Check availability, Request a visit, Send an inquiry; Visit: the address with directions, the phone, the email, the contact person), then the very large centred serif statement (`site.tagline`), and a bottom row with the white lockup and the legal line. Takes `bookHref` from the layout, so event pages book with their event chosen. | Columns | Explore and Plan side by side, Visit beneath; statement still centred |
| `Photo.astro` | Unchanged: responsive AVIF and WebP, the portrait file on phones, the Styled Concept badge, the tap-to-enlarge viewer. Radius now `--r-card`. |  |  |
| `Icon.astro`, `Logo.astro`, `Breadcrumbs.astro`, `JsonLd.astro` | Unchanged. Breadcrumbs are used only on event pages, under the hero. |  |  |

Removed: `TabBar.astro` (the floating tab bar), the `Petals.astro` canvas (the video replaced it; the file is
deleted rather than left unused), `LocationBand.astro` (replaced by `ImageTextSplit` on the home page),
`EventIndex.astro` (the white-body event tiles, replaced by `PhotoCard` in the events grid and carousels),
and `FaqList.astro` (every page imports `FaqAccordion` directly).

`PageHero` takes `phone="stack"` for a photo that has no portrait file (the staged event photos): below
46.5rem the photo is shown whole at its own 3:2 shape and the caption sits on the page beneath it, in the
page's own colors; from 46.5rem it is the same overlay hero. Facts on phones are LABEL: value rows.

### What the foundation built (commit "Redesign foundation:")

Tokens and the button system in `src/styles/global.css`; `Header.astro` (with the menu), `Footer.astro`,
`HeroVideo.astro`, `SectionHeading.astro`, `PhotoCard.astro`, `Carousel.astro`, `ImageTextSplit.astro`,
`FeatureStrip.astro`, `Checklist.astro`, `FaqAccordion.astro`,
`AnchorBar.astro`, `VerticalTabs.astro`, `PageHero.astro`, `CtaBand.astro`; `BaseLayout.astro` (no tab
bar, the `headerOver` prop, the Caslon Text preload); the home page; the hero video and its credits. Page
owners build the other routes from the plan below with these components and do not add a second button or
card style.

## 4. Page-by-page plan

Each section names its component, the reference pattern it follows, and its content source. Every fact keeps
one home (brand.md, Redundancy rules); no photo appears twice on a page; every staged photo keeps its badge.

### `/` Home (built by the foundation)

Built by the foundation, in this order:

1. **Hero** (`HeroVideo`): H1 "Welcome to The Venue @ NCC" (the italic serif "Welcome to", then the name as
   the lockup's own words on one line at 74vw on desktop and 94vw on phones, by far the largest type), the
   Berry serif line "Event venue in Suffolk, Virginia", one filled Check Availability. The name flies into the
   header lockup as one shape as the hero scrolls out. Video: `public/media/hero-petals.*`.
2. **The spaces** (`SectionHeading` + `Carousel` of three `PhotoCard`s, `cols=3`): eyebrow "The spaces", h2
   "Three spaces, indoors and out", the owner's welcome text as the lead, Explore The Space (filled) and
   "Check Availability >" (link). Cards: hall-windows / main-hall / grove-tables with "Up to N guests".
   Reference: "Unforgettable Venues" section with its venue cards.
3. **Check a date** (`SectionHeading` beside the `DateChecker` island in its White panel): the working
   checker, the page's second action. Reference: the venue page's pricing panel arrangement.
4. **Events we host** (`SectionHeading` + `Carousel` of eight `PhotoCard`s with the Styled Concept badge,
   `cols=4`): the styled note as the lead, See All Events (link). Reference: the "Real Weddings" carousel.
5. **What every booking includes** (`SectionHeading` + `FeatureStrip`): Indoors and outdoors, Full-day access,
   Tables and chairs included, On-site parking. Reference: "We Do, So You Can" row.
6. **Rates** (`SectionHeading` on the Petal band): the approved wording, Call (filled), "Or send an inquiry >".
7. **Find us** (`ImageTextSplit`, approach-dusk): the address, Get Directions (outline). Reference: "Getting to".
8. `CtaBand`.

### `/the-space/` (reference: the venue page)

1. `PageHero` with `main-hall` (portrait file on phones): eyebrow "The Space", h1 "Three spaces, indoors and
   out", descriptors "Indoor · Outdoor · Renovated grounds", facts LOCATION Suffolk, VA / CAPACITY up to 150
   (the title already counts the spaces).
2. `AnchorBar`: The Hall, The Main Hall, The Grove, Gallery, Amenities, The grounds, Included, Visit.
3. **Spaces** (`VerticalTabs`, one panel per space): the primary photo, the name (`--t-title-2`), the lead,
   a spec list (Capacity, Features, Rates: Ask about rates linking to /pricing/). Photos: the primaries
   brand.md names, hall-windows, main-hall-stage, grove-tables (the hero already shows main-hall).
4. **Photo gallery** (`Carousel` of `PhotoCard`s with the caption as the label): hall-fireplace, hall-doors,
   gazebo, grove-path, driveway. Tap to enlarge stays.
5. **Premium amenities** (`FeatureStrip`): `site.amenities`.
6. **The grounds** (`ImageTextSplit`, approach-dusk): parking, Get Directions.
7. **What the rental includes** (`Checklist`): `site.included`.
8. **Schedule a visit** (`SectionHeading` with Request a Visit, on Petal).
9. `CtaBand`.

### `/events/` (reference: the venues index and gallery)

1. `PageHero` with `styled-event-weddings` (badge and caption kept): eyebrow "Events", h1 "Weddings,
   celebrations, and gatherings in Suffolk", the styled note as the descriptor line.
2. **All events**: a grid of the other seven `PhotoCard`s (2 up from 36rem, 3 up from 56rem, 4 from 75rem),
   label = event name, meta = summary's first clause. Reference: the venues grid.
3. `CtaBand` ("Planning something else?").

### `/events/[slug]/` (reference: the venue page)

1. `PageHero` with the event's staged photo: eyebrow "Events", h1 `event.h1`, descriptors from the event's
   spaces, facts SPACE / CAPACITY / BOOKING LEAD TIME where the copy states them. Breadcrumbs under the hero.
2. `AnchorBar`: About, Planning guide, Checklist, Questions, Other events.
3. **About** (`ImageTextSplit`, flip): `event.intro[1..]` beside a second photo where one exists (weddings:
   the indoor ceremony), otherwise a `Checklist` panel of the checklist items.
4. **Planning guide**: `event.sections` as `--t-title-2` heads with Caslon Text copy, two columns from 60rem.
5. **Checklist** (`Checklist`) with Request a Visit.
6. **Questions** (`FaqAccordion`) from `event.faqs`.
7. **Other events we host** (`Carousel` of three `PhotoCard`s).
8. `CtaBand` with the event's booking link.

### `/pricing/` Rates (reference: the contact and tour page)

1. A serif title band on Petal: eyebrow "Rates", h1 "Rates and inquiries" (no photo; the reference's contact
   title band).
2. **Rates** (`ImageTextSplit`, hall-fireplace): `RATES_WORDING`, Call (filled), the contact person and email.
3. **Rental information and policies** (`Checklist`-style panel rows): included, deposit, hours (`site.included`,
   `site.depositPolicy`, `site.access`).
4. **Send an inquiry**: eyebrow "Contact us", h2, lead, then the `InquiryForm` island whose field groups sit
   in a Petal panel (the reference's tinted form panel), Submit filled and right-aligned.

### `/faq/` (reference: the FAQ pattern on venue pages)

1. Title band on Petal: eyebrow "Help", h1 "Frequently asked questions", lead.
2. Topics (`AnchorBar`) then one `FaqAccordion` per topic with a `--t-title-2` head.
3. `CtaBand`.

### `/book/` and the booking steps (reference: the contact form)

1. Title band on Petal: h1 "Check availability", the lead.
2. The `BookingApp` island: progress as a numbered list in Caslon Text; each step's fields in a White panel
   (16px radius, hairline); the summary card on the right as a White panel; buttons are the one `.btn`.
   Steps: Date and space (calendar in a panel, spaces as `PhotoCard`-like rows), Your event (event tiles as
   chips), Contact, Review, Success (a Caslon Display title, the reference number, next steps). The wizard's
   own bottom bar stays; it is the only bottom bar on the site.

### `/404`

`PageHero` with `gazebo`: h1 "This page could not be found", then a Caslon Text link list (Home, Check
Availability, Rates, Events) like the reference's 404.

### Admin (`/admin/`)

The admin keeps its own interface family (Inter) and its own chrome, restyled to the tokens only: Blush
surfaces (White since version 6), White cards with hairlines, Peony actions, 12px card radius, the Blush sidebar on desktop mirroring
the footer's surface, and a bottom tab row inside the app (it is an application, not the marketing site).

### Emails and share images

Unchanged in structure; the share images take the Blush surface and the Plum scrim, the lockup, and the
Caslon title.

## 5. Acceptance

Every route side by side with the reference at 390 and 1440; the header at the top and after scrolling; one
button and one card component; no prices, no church connection, no alcohol; a reduced-motion pass; a contrast
pass on the hero text over the brightest video frame (Plum on the overlaid poster's brightest region is above
7:1); `npx astro check`, `npm test`, `npm run build`, `npm run build:demo`, axe (no serious or critical), and
no sideways scrolling at 320, 390, 768, 1024, and 1440.
