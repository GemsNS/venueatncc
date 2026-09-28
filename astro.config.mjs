// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import { site } from './src/data/site.ts';

// /the-space/ is noindexed until it has photos, rooms, or amenities (see src/pages/the-space.astro).
// Apply the same rule here so the page joins the sitemap exactly when it becomes indexable.
// The extension list matches the glob in src/data/photos.ts.
const venuePhotoCount = fs.existsSync('./src/assets/venue')
  ? fs.readdirSync('./src/assets/venue').filter((f) => /\.(jpe?g|png|webp|avif|JPE?G|PNG|WEBP|AVIF)$/.test(f)).length
  : 0;
const spaceIndexable = venuePhotoCount > 0 || site.spaces.length > 0 || site.amenities.length > 0;

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404') && (spaceIndexable || !page.endsWith('/the-space/')),
      changefreq: 'monthly',
      priority: 0.7,
      serialize(item) {
        if (item.url === `${site.url}/`) item.priority = 1.0;
        return item;
      },
    }),
  ],
});
