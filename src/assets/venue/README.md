# Venue photos

Every jpg, jpeg, png, webp, or avif file in this folder is **published** on the site. Only real photographs
of the property belong here, plus clearly labeled styled concepts of them. Keep reference-only or unapproved
images somewhere else.

## Files

| Pattern | What it is | How the site uses it |
|---|---|---|
| `name.jpg` | 3:2 landscape, 2400px wide | One photo in `photos` (src/data/photos.ts). |
| `name-tall.jpg` | 4:5 portrait, 1600px wide | Attached to `name.jpg` as `tall`. Shown instead of the landscape file on phones (below 46.5rem) wherever a page asks for the tall crop. Never listed on its own. |
| `styled-<base>-<scene>.jpg` | A styled concept of a real photo: furniture, linens, florals, and lighting added, architecture unchanged | Attached to its base photo as `styled` when its `photoDetails` entry has `styledOf: '<base>.jpg'`. Always shown with a "Styled Concept" badge and the caption "Styled concept. Décor shown is not included with the rental." Never listed on its own, never a hero or share image, never the only image of a space. |

Use originals at least 1600px on the long edge. The build prints a warning for smaller files, for files with
no `photoDetails` entry, and for entries with no file.

## Describing a photo

Add an entry in `photoDetails` in `src/data/photos.ts`:

- `alt`: what the photo shows, precisely and factually. Describe only what is visible. Do not claim a
  kitchen, sound system, stage, bridal suite, rentable tables and chairs, or anything else not confirmed.
  A styled concept's alt text starts with "Styled concept:".
- `caption`: a short caption, shown where a page asks for one.
- `space`: `'hall'`, `'grove'`, or `'campus'`. `photosFor('hall')` returns The Hall's photos.
- `tags`: `hero` for the home hero (the first match wins), plus any labels pages look up with `photosTagged()`.
- `crop`: optional CSS object-position, such as `'center 70%'`, for frames whose ratio differs from the file.

## Where photos appear

- `heroPhoto()`: the home hero, `exterior-dusk`.
- `eventPhoto(slug)`: the photo that leads each event page. The map lives in `src/data/photos.ts`
  (weddings use `gazebo`, receptions and repasts use `hall-fireplace`, and so on). Unmapped slugs use `hall-windows`.
- `photoByName('approach-dusk')`: any single photo by name.

Photos render through `src/components/Photo.astro`, which serves responsive AVIF and WebP at widths up to the
source width, crops with CSS to the frame's ratio, and swaps in the tall file on phones when asked.

## Current set

| File | Space | Subject |
|---|---|---|
| `exterior-dusk` | campus | The building at blue hour, lit entry, white cross on the gable, pines behind |
| `approach-dusk` | campus | Long paved drive and lawn toward the building at dusk |
| `driveway` | campus | Wide paved drive and lot in daylight |
| `gable` | campus | Stucco gable with the white cross and arched windows |
| `hall-windows` | hall | Arched windows, fireplace feature wall, wood-look floor |
| `hall-fireplace` | hall | Toward the windows and the fireplace wall |
| `hall-doors` | hall | Double doors, wall-mounted screen, arched windows |
| `grove-tables` | grove | Gazebo and picnic tables on a paved patio under pines |
| `gazebo` | grove | Timber gazebo with a metal roof |
| `grove-path` | grove | Paved path to the gazebo through the trees |

Use descriptive file names. Search engines read them, and they become the fallback alt text when a photo has
no entry.
