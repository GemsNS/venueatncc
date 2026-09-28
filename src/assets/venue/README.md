# Venue photos

Every jpg, jpeg, png, webp, or avif file in this folder is **published** on the site. Each one is
cropped to the arch shape, resized, converted to AVIF and WebP, and shown in the gallery on /the-space/.
Keep reference-only or unapproved images somewhere else.

Use originals at least 1600px on the long edge. The build prints a warning for smaller files.

To control alt text, captions, crop, and where a photo appears, add an entry for it in
`src/data/photos.ts`. Tag options:

- `hero` for the arched photo at the top of the home page
- `space` for the home page "the space" row
- `about` for the arched photo on the About page
- an event slug such as `weddings` or `repasts-memorials` for that event page

Use descriptive file names, for example `fellowship-hall-reception-tables.jpg`.
Search engines read them, and they become the fallback alt text when a photo has no entry.
