# Design archive

Files kept for reference. Nothing in this folder is built into or published with the website.

## generated-scenes

Every AI-staged ("styled concept") scene generated from the real photos of The Venue at NCC, in every color
variation, including drafts that were not used. Keep all of them; remove an image from the site by taking it out
of `src/assets/venue/`, never by deleting it here.

- `round-1-lavender/`: the first set, styled in white and lavender for the version 1 purple brand.
  `raw/` holds the images as generated; `web/` holds the upscaled versions that were used on the site.
- `round-2-warm-neutral/`: the eight event scenes styled in ivory, eucalyptus, natural wood, and peach.
  These are the images the site uses (copies live in `src/assets/venue/styled-event-*.jpg`).
- `share-bouquet/`: four still lifes of a hand-tied bouquet of pink and white roses, generated with Gemini
  (1024 x 572 each) for the home page's share card when the client asked to replace the building photo.
  `share-bouquet-v4.png` is the one used, upscaled to 1920 wide as `src/assets/venue/share-rose-bouquet.jpg`.
- `base-crops/`: the two tighter framings of The Hall that some round 2 scenes were generated from.

The same set is also kept next to the original photos in `C:\NoOnedrive\venue\Generated scenes`.

## photos-before-upscale

The 32 photos the site used until 2026-10-01 (real photos at 2400 x 1600 and 1600 x 2000, staged photos at
1800 x 1200), kept when they were replaced by sharper files: the real photos re-cut from the camera
originals at full resolution with the same framing and grade, the staged photos upscaled with Real-ESRGAN.
`src/assets/venue/README.md` (Resolution) says how. `grove-pines` and `share-rose-bouquet` did not change.

## staged-blend50

`styled-wedding-indoor-ceremony.jpg` and `styled-event-repasts-memorials.jpg` as first upscaled on 2026-10-01
(Real-ESRGAN and Lanczos half and half), replaced the same day by a one quarter Real-ESRGAN mix because the
ceremony's flower walls still looked waxy at 1:1 (`src/assets/venue/README.md`, Resolution).

## hero-roses-2560

The rose hero loop (second grade) and its posters at 2560 x 1440, with a 1216 x 2160 portrait poster, used on
2026-10-01 until the client's rule against blurry, over-enlarged images: the full-height hero drew them up to
1.76 times their size on phones and 1.5 times on 1920 x 1080 screens at 2x. They were replaced by the full
3840 x 2160 cut of the same 4K source and edit, with a 1620 x 2160 portrait cut (`public/media/CREDITS.md`).

## hero-roses-grade1

The rose hero loop and its posters with the first grade (gamma 1.5, brightness +0.02, saturation 1.05), used
on 2026-10-01 until the clip was recut from the same 4K source with a brighter grade so the Plum name meets
its 7:1 floor (`public/media/CREDITS.md`).

## driveway-tall-before-recut

`driveway-tall.jpg` (the home arrival photo on phones) before it was recut on 2026-10-01: the whole width of
IMG_4899, so the building sat small at the horizon over about 70 percent pavement. The new file is a tighter
4:5 window of the same original with the building near the upper third.

## hero-petals-1280

The home hero clip and poster at 1280 x 720 as used until 2026-10-01, replaced by 2560 x 1440 files cut from
the source's 4K rendition (`public/media/CREDITS.md`).

## hero-petals

The home hero clip of white rose petals on a pink ground (Mixkit item 3733) and its two posters at
2560 x 1440, as used until 2026-10-01, when the client asked for pink roses instead because the petals did
not read as flower petals. The rose clip that replaced them is credited in `public/media/CREDITS.md`.
