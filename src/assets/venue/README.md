# Venue photos

Every jpg, jpeg, png, webp, or avif file in this folder is **published** on the site. Only real photographs
of the property belong here, plus the staged event photos made from them and the one share card still,
`share-rose-bouquet.jpg`. Keep reference-only or unapproved images somewhere else.

## The rule (docs/design/brand.md, Photography)

- **One real photo per subject (version 9).** The client: "no redundant images, like multiple angles of the
  gazebo, choose the best one (for raw image)". The site shows exactly four real photos, one per subject
  (`SUBJECT_PHOTO` in `src/data/photos.ts`): `hall-windows` (The Fireside Room), `main-hall-stage` (The
  Stage Hall), `grove-tables` (The Pine Garden and its gazebo), and `driveway` (the building and the drive).
  Every other real photo here is marked `unused` in `photoDetails`, with the reason it lost, and is never
  shown; see "Unused real photos" below. Never delete one.
- **Real photographs show the spaces**: the home hero, the space cards, The Space, the arrival band, share
  images (except the home card), and structured data.
- **The home share card is a still life**: `share-rose-bouquet.jpg`, a generated bouquet of pink and white
  roses, is the home page's link preview only (`src/pages/og/_cards.ts`). Files named `share-*` are never
  listed in `photos`, never shown in a gallery, and never used in structured data.
- **Staged photographs show events**: every event tile and event page hero, all eight in one décor style,
  each with the "Styled Concept" badge.
- **All or nothing**: `eventsStaged` in `src/data/photos.ts` is true only when all eight staged files are
  here. Until then each event page hero shows the real photo its staged file is made from (no badge, no
  caption), event tiles are text only, and the styled-photo note is hidden, so a half-staged grid never
  ships and no real photo repeats in a grid.
- **No toggles, no repeats**: there is no As Photographed / Styled Concept switch, and no image appears
  twice on a page.

## Files

| Pattern | What it is | How the site uses it |
|---|---|---|
| `name.jpg` | 3:2 landscape, as wide as the camera original allows up to 3840px (3840 for most; `grove-path` 3600, `gazebo` 3000, `exterior-dusk` 2880) | One photo in `photos` (src/data/photos.ts). |
| `name-tall.jpg` | 4:5 portrait, 2000px wide (a phone hero draws it about 1800px wide at 3x) | Attached to `name.jpg` as `tall`. Shown instead of the landscape file on phones (below 46.5rem) wherever a page asks for the tall crop. Never listed on its own. |
| `grove-pines.jpg`, `grove-pines-tall.jpg` | The home hero, the one exception: both are cut from the original after leveling it by 2.5 degrees (the camera was slightly rotated); the landscape file is nearly its full width (3500 x 2532) for full-bleed screens, and the portrait file is 7:10 | The hero's frames in src/pages/index.astro are fitted to these two framings (the roof, the gazebo, and the cut through the front table's legs). Re-measure them there if either file changes. |
| `styled-event-<slug>.jpg` | The staged photo of one event: furniture, linens, florals, and lighting added; architecture, fixtures, and trees unchanged | Its `photoDetails` entry (already registered) names the real photo it was made from (`styledOf`) and the event (`event`). Shown only through `eventPhoto()`, with the badge, and on the event page with the caption "Styled concept. Décor is not included." |
| `share-<name>.jpg` | A still life for a share card, not a photo of the property. Today only `share-rose-bouquet.jpg`: Gemini's 1024 x 572 output (variant 4 of 4, all kept in `design-archive/generated-scenes/share-bouquet/`) upscaled to 1920 wide | Read from disk by `src/pages/og/[key].jpg.ts` for the home card. Skipped by `src/data/photos.ts`. |

The eight staged files and the real photo each is made from:

| File | Made from |
|---|---|
| `styled-event-weddings.jpg` | `gazebo.jpg` |
| `styled-event-receptions-banquets.jpg` | `hall-windows.jpg` |
| `styled-event-baby-bridal-showers.jpg` | `hall-fireplace.jpg` |
| `styled-event-birthday-parties.jpg` | `hall-windows.jpg` (fireplace corner crop) |
| `styled-event-repasts-memorials.jpg` | `hall-doors.jpg` (window corner crop) |
| `styled-event-meetings-trainings.jpg` | `hall-doors.jpg` |
| `styled-event-graduations-reunions.jpg` | `grove-tables.jpg` |
| `styled-event-community-events.jpg` | `grove-path.jpg` |
| `styled-wedding-indoor-ceremony.jpg` | `main-hall.jpg` (outside the event set: the weddings page's indoor ceremony) |

Use originals at least 1600px on the long edge. The build prints a warning for smaller files, for files with
no `photoDetails` entry, and for real photos listed with no file.

## driveway-tall (recut 2026-10-01)

`driveway-tall.jpg` is a 3100 x 3875 window of IMG_4899 (left 420, top 700, the camera original's pixels)
scaled to 2000 x 2500, with the building near the upper third and the landscaped island in the lower half,
in the tone of `driveway.jpg` (a per-channel curve fitted from the original to `driveway.jpg` over the
area they share). The earlier full-width framing is in `design-archive/driveway-tall-before-recut/`.

## Resolution (re-exported 2026-10-01)

The client found the photos soft. Every real photo except `grove-pines` (already at the original's width) is
re-cut from its camera original at the original's own resolution, with the same framing, leveling and grade
as before: the HEIC files in `C:\NoOnedrive\venue\Venue` (IMG_4899, 4906, 4908, 4922, 4932, 4933, 4946,
5154, 5159) and, for The Stage Hall, the full-size JPEG copies of IMG_4937 and IMG_4940 its earlier files
were cut from (IMG_4940 has no HEIC in that folder). Each framing was matched to the earlier
file by image registration (scale, rotation and position), the earlier grade reapplied, and the result
checked against the earlier file: below 1.2 levels of mean difference once fine detail is blurred out.

The staged photos have no larger source (Gemini returned 1024 x 682). They are upscaled with Real-ESRGAN
x4plus (the official xinntao release) and mixed with a Lanczos resize with a gentle unsharp mask: pure
Real-ESRGAN turned dense flowers into smooth, waxy blobs. Most are mixed half and half. The two with dense
flower walls, `styled-wedding-indoor-ceremony` and `styled-event-repasts-memorials`, are one quarter
Real-ESRGAN and three quarters Lanczos: at half and half the small roses and carnations of the ceremony
backdrop still lost their petal structure at 1:1, and at one quarter they keep it as the earlier 1800 file
did (the half and half files are kept in `design-archive/staged-blend50/`). They are 2880 x 1920 (1440 wide
at 2x). The ESRGAN outputs are kept in `C:\NoOnedrive\venue\Generated scenes\upscaled-esrgan-x4`.

The files they replace are kept in `design-archive/photos-before-upscale/`. `share-rose-bouquet.jpg` is
unchanged: it only feeds a 1200 wide share card.

`Photo.astro` serves widths up to 3840 and encodes AVIF at quality 60 and WebP at 82 (sharp's defaults, 50
and 80, smeared texture).

Page weight, measured fully scrolled in Chrome (AVIF) against the earlier files and code, on the commit that
re-exported the photos: 1.34 times overall, from 1.19 to 1.88 times by page and screen. The largest rises are
the phone 404 at 390 x 844 at 3x (477 to 899 KB; its gazebo hero alone is about 0.7 MB), the community events
page at 1440 at 2x (638 to 1093 KB, 1.71 times), graduations and reunions (732 to 1167 KB, 1.59 times) and The
Space at 1920 at 2x (1078 to 1726 KB, 1.60 times). Since then the portrait file on phones is chosen by the
card's real width (`tallSizes` defaults to `sizes`, so a carousel card fetches the 960 file, not 1280), the
carousels on tablets ask for files that match their cards, and the photo viewer offers 1600, 2400 and 3200
wide files instead of one 3200 file, so a phone's tap to enlarge fetches the 1600 file.

## Files shown on no page

`styled-driveway-petals.jpg` (the building's cross is front and centre in it) is kept in the set but placed
on no page. The unused real photos (below) are also shown nowhere. They stay for reference; take them out of
this folder only by moving them to `design-archive/`.

## The picks, and the unused real photos (version 9)

Each real photo was viewed whole and at 100%, and its 4:5 file at phone size.

| Subject | In use | Why |
|---|---|---|
| The Fireside Room | `hall-windows` | The only frame with both features the room is named for, the arched windows and the fireplace wall; level, evenly lit, and its 4:5 crop reads on a phone |
| The Stage Hall | `main-hall-stage` | Brighter and cleaner than `main-hall`; the red seats lead to the raised stage, and its 4:5 crop holds the whole stage wall |
| The Pine Garden and the gazebo | `grove-tables` | The gazebo, the patio, the tables, the lawn, and the pines in one evenly lit frame, with the gazebo at its centre |
| The building and the drive | `driveway` | Daylight, the paved lot that shows the parking, the building small and incidental |

| Unused | Why |
|---|---|
| `hall-fireplace` | Mostly empty floor, slightly tilted, the fireplace cut by the right edge |
| `hall-doors` | Leads with a blank wall-mounted screen and shows no fireplace |
| `main-hall` | Dim, mostly ceiling, a lectern and palms at the centre of a small stage (still the base of `styled-wedding-indoor-ceremony`) |
| `gazebo` | A close-up whose largest subject is the roof, with none of the garden around it |
| `grove-path` | A foreground trunk and leaves down the right side; the gazebo sits small |
| `grove-pines` | Another crop of `grove-path`, with the same trunk |
| `approach-dusk` | Dim blue-hour light and a small building |
| `exterior-dusk` | The cross on the gable is the subject of the frame |

A staged photo made from an unused angle is still shown (staged photos are one per event); its real photo
for share cards (`realPhoto()`) is the one photo in use of the space it shows.

## Describing a photo

Add an entry in `photoDetails` in `src/data/photos.ts`:

- `alt`: what the photo shows, precisely and factually. Describe only what is visible. Do not claim a
  kitchen, sound system, stage, bridal suite, rentable tables and chairs, or anything else not confirmed.
  A staged photo's alt text starts with "Styled concept:".
- `caption`: a short caption, shown where a page asks for one.
- `space`: `'hall'`, `'main'`, `'grove'`, or `'grounds'`. `spacePhoto('hall')` returns The Fireside Room's one photo in use.
- `unused`: for a real photo that is not its subject's pick, the reason. It is then never shown.
- `tags`: `hero` for the photo `heroPhoto()` returns (the first match wins), plus any labels pages look up with `photosTagged()`.
- `crop`: optional CSS object-position, such as `'center 70%'`, for frames whose ratio differs from the file.

## Where photos appear

- `spacePhoto(space)`: the one real photo of a subject: the home cards and "Find us", The Space, Rates &
  FAQ, the 404, the Book thumbnails, and the share cards.
- `heroPhoto()`: `grove-tables`, tagged `hero`: the venue's image in structured data on every page and the
  fallback share image.
- The home share card: `share-rose-bouquet.jpg`, a still life, named in src/pages/og/_cards.ts.
- `eventPhoto(slug)`: the photo that leads each event block (and its tile, when staged): the staged photo
  when `eventsStaged`, otherwise the one real photo of the space it shows.
- `styled-wedding-indoor-ceremony`: the indoor ceremony beside the gazebo ceremony in the Weddings block on
  /events/ (`SECOND_PHOTO` in src/pages/events/index.astro).
- `realPhoto(photo)`: the real photo behind a staged one (the one photo in use of its space), for share
  images and structured data.
- `photoByName('driveway')`: any single photo in use, or any staged photo, by name. Unused photos return null.

Photos render through `src/components/Photo.astro`, which serves responsive AVIF and WebP at widths up to the
source width, crops with CSS to the frame's ratio, and swaps in the tall file on phones when asked.

## Current set

| File | Space | Subject |
|---|---|---|
| `hall-windows` | hall | **In use.** Arched windows, fireplace feature wall, wood-look floor |
| `main-hall-stage` | main | **In use.** Red seats facing the raised stage, the screen above (owner's IMG_4940) |
| `grove-tables` | grove | **In use.** Gazebo and picnic tables on a paved patio under pines |
| `driveway` | grounds | **In use.** Wide paved drive and lot in daylight, the building beyond |
| `hall-fireplace` | hall | Unused. Toward the windows and the fireplace wall |
| `hall-doors` | hall | Unused. Double doors, wall-mounted screen, arched windows |
| `main-hall` | main | Unused. The Stage Hall down its aisle: red upholstered chairs in rows, vaulted ceiling, raised stage (owner's IMG_4937, leveled) |
| `gazebo` | grove | Unused. Timber gazebo |
| `grove-path` | grove | Unused. Paved path to the gazebo through the trees |
| `grove-pines` | (none) | Unused. The gazebo under tall pines, picnic tables in front; another framing of the `grove-path` original |
| `approach-dusk` | grounds | Unused. Long paved drive and lawn toward the building at dusk |
| `exterior-dusk` | grounds | Unused. The building at blue hour, lit entry, pines behind |

Use descriptive file names. Search engines read them, and they become the fallback alt text when a photo has
no entry.
