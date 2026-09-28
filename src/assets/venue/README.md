# Venue photos

Every jpg, jpeg, png, webp, or avif file in this folder is **published** on the site. Only real photographs
of the property belong here, plus the staged event photos made from them. Keep reference-only or unapproved
images somewhere else.

## The rule (docs/design/brand.md, Photography)

- **Real photographs show the spaces**: the home hero, the space cards, The Space, the arrival band, share
  images, and structured data.
- **Staged photographs show events**: every event tile and event page hero, all eight in one décor style,
  each with the "Styled Concept" badge.
- **All or nothing**: `eventsStaged` in `src/data/photos.ts` is true only when all eight staged files are
  here. Until then every event uses its real photo, so a half-staged grid never ships.
- **No toggles, no repeats**: there is no As Photographed / Styled Concept switch, and no image appears
  twice on a page.

## Files

| Pattern | What it is | How the site uses it |
|---|---|---|
| `name.jpg` | 3:2 landscape, 2400px wide | One photo in `photos` (src/data/photos.ts). |
| `name-tall.jpg` | 4:5 portrait, 1600px wide | Attached to `name.jpg` as `tall`. Shown instead of the landscape file on phones (below 46.5rem) wherever a page asks for the tall crop. Never listed on its own. |
| `styled-event-<slug>.jpg` | The staged photo of one event: furniture, linens, florals, and lighting added; architecture, fixtures, and trees unchanged | Its `photoDetails` entry (already registered) names the real photo it was made from (`styledOf`) and the event (`event`). Shown only through `eventPhoto()`, with the badge, and on the event page with the caption "Styled concept. Décor is not included." |

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

Use originals at least 1600px on the long edge. The build prints a warning for smaller files, for files with
no `photoDetails` entry, and for real photos listed with no file.

## Describing a photo

Add an entry in `photoDetails` in `src/data/photos.ts`:

- `alt`: what the photo shows, precisely and factually. Describe only what is visible. Do not claim a
  kitchen, sound system, stage, bridal suite, rentable tables and chairs, or anything else not confirmed.
  A staged photo's alt text starts with "Styled concept:".
- `caption`: a short caption, shown where a page asks for one.
- `space`: `'hall'`, `'grove'`, or `'grounds'`. `photosFor('hall')` returns The Hall's real photos.
- `tags`: `hero` for the home hero (the first match wins), plus any labels pages look up with `photosTagged()`.
- `crop`: optional CSS object-position, such as `'center 70%'`, for frames whose ratio differs from the file.

## Where photos appear

- `heroPhoto()`: the home hero, `exterior-dusk`.
- `eventPhoto(slug)`: the photo that leads each event page and its tile: the staged photo when
  `eventsStaged`, otherwise the real photo mapped in `src/data/photos.ts`.
- `realPhoto(photo)`: the real photo behind a staged one, for share images and structured data.
- `photoByName('approach-dusk')`: any single photo by name.

Photos render through `src/components/Photo.astro`, which serves responsive AVIF and WebP at widths up to the
source width, crops with CSS to the frame's ratio, and swaps in the tall file on phones when asked.

## Current set

| File | Space | Subject |
|---|---|---|
| `exterior-dusk` | grounds | The building at blue hour, lit entry, pines behind |
| `approach-dusk` | grounds | Long paved drive and lawn toward the building at dusk |
| `driveway` | grounds | Wide paved drive and lot in daylight |
| `hall-windows` | hall | Arched windows, fireplace feature wall, wood-look floor |
| `hall-fireplace` | hall | Toward the windows and the fireplace wall |
| `hall-doors` | hall | Double doors, wall-mounted screen, arched windows |
| `grove-tables` | grove | Gazebo and picnic tables on a paved patio under pines |
| `gazebo` | grove | Timber gazebo with a metal roof |
| `grove-path` | grove | Paved path to the gazebo through the trees |

Use descriptive file names. Search engines read them, and they become the fallback alt text when a photo has
no entry.
