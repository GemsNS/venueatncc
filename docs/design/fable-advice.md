# Creative director advice for the full redesign (binding for all redesign agents)

Written by a Fable 5.1 creative director after comparing the live site with https://www.wedgewoodweddings.com/ at 390 and 1440.
Reference and live screenshots: C:/Users/bytec/AppData/Local/Temp/claude/C--Users-bytec-orca-workspaces-NCC-Venues-stingaree/2ca5c194-c92c-4f97-9f58-253aceb30606/scratchpad/advisor/ (slices/ for page segments).

## Decisions (resolved by the lead)

- **Video hero is approved.** brand.md v4 said "no footage, petals are the only motion graphic". That is superseded: the client asked for a
  royalty-free video hero. Amend brand.md's Motion section accordingly. Petals may remain as a subtle accent only if they do not compete.
- **Mobile navigation follows the reference:** hamburger (menu button) on the left, centred logo, one right-side action (phone or Check
  Availability), opening a full-screen or sheet menu with large serif links. Remove the floating bottom tab bar entirely (it covers photos and
  copy on The Space and Rates). Keep 44px targets, focus trap and Escape to close in the menu, and a visible way to book on every page.

## What makes Wedgewood feel like Wedgewood (must capture)

1. One serif carries nearly everything: nav links, button labels, leads, card captions (light weight, 15 to 16px). Sans only for small body
   and forms. Use Libre Caslon Text for nav and button labels at minimum; Inter everywhere reads "Apple", not Wedgewood.
2. Header: links left, lockup centred, phone and a dark pill button right; transparent with light text over the hero, then dark text on a
   solid cream or blush bar (not glass) once the hero has scrolled away.
3. Hero: full-viewport (100svh) fixed video; the page content slides up over it. A caption panel (rounded, translucent) sits bottom-left.
4. Section header: h2 about 48px, light weight, left; a half-width lead beneath; a pill button plus a text link with chevron aligned right
   to the h2; a full-width hairline between sections; cream or off-white surfaces; generous padding (about 96px desktop).
5. Cards: the label and capacity sit inside the photo over a bottom gradient scrim, 12px radius, arranged in horizontal carousels that bleed
   past the viewport edge. No white card body under the photo.
6. Venue page pattern (use for The Space): full-bleed hero with a caption box (name, three adjectives, LOCATION / TYPE / CAPACITY facts), a
   sticky in-page anchor bar, then a left vertical tab list (The Hall, The Main Hall, The Grove) with image and copy on the right.
7. Footer: a large centred serif statement, three link columns, a contact row, on a contrasting surface.
8. Mobile: everything stacks in the same order, carousels stay horizontal and swipeable, buttons keep the pill shape, type stays large.

## Gaps on the current site, page by page

- Home: below the welcome, cards, buttons and footer statement are still the old system; the "Find us" photo can render as an empty box
  (lazy loading in captures; make sure it loads).
- The Space: no hero, no anchor bar, no tab list; alternating bands feel templated.
- Events and event pages: no hero band; tiles are white-body cards; the event page is a two-column article, not a venue-style page.
- Rates and FAQ: text-only openings with no hero image; FAQ accordion cards are heavy.
- Book and 404: untouched old UI; 404 needs a full-bleed image and a link list like the reference.
- Buttons vary in fill and weight across pages; the footer statement is small and left-aligned.

## Hero guidance

- Clip: soft-focus, slow, unidentifiable: macro blossoms or petals in shallow focus, moving tulle, candle bokeh. Never a building, ballroom,
  or landscape that could be mistaken for the property. Muted, playsinline, poster, WebM + MP4, still frame under reduced motion, license note
  in the repo.
- Legibility: either a Blush glass panel (Blush at 0.85 opacity, Plum text) or a Plum bottom scrim with the white lockup. Check contrast
  against the brightest frame of the video, not only the poster.
- "Welcome to The Venue @ NCC" stays the H1 and the dominant element; "The Venue @ NCC" is by far the largest type.
- Morph: tie progress to the hero leaving the viewport (0 to 100svh of scroll), not a fixed 420px, so the name lands in the header exactly as
  the header turns solid. Ease-out, transforms only, no layout shift. (Amended October 1, 2026, after the client called the
  morph laggy: the ease-out bolted and then parked short of the bar, so the name now waits while the welcome fades over the
  first 20% and then flies on an ease-in-out, still moving as it lands. Transforms only and no layout shift still hold. For
  the lead to confirm when reviewing the morph.)

## Pitfalls to avoid

- Recolouring instead of rebuilding. Two button systems or two card systems coexisting. Skipped pages (book, 404, admin, emails). A spec
  written against the unamended brand.md. Tab bar and hamburger both present.

## Acceptance checks (the reviewer and the lead run these)

- Every route (home, The Space, events, one event page, Rates, FAQ, Book, 404) side by side with the reference at 390 and 1440.
- Scroll fully before capturing and confirm every image and the video load.
- One button component and one card component sitewide.
- Header state at the top and after scrolling; the nav choice applied consistently on every page.
- No prices, no church connection, no alcohol.
- A reduced-motion pass.
- Contrast pass on the hero text over the brightest video frame.
