/**
 * Stands in for ./demo in production builds (see "venue:demo-off" in astro.config.mjs). The demo
 * backend computes the internal rate card estimate for its admin screens, so a static import of it
 * from ./index would place the rate card in a chunk every public island loads, even though the demo
 * code itself is dropped. Production never uses the demo backend, so it resolves to this instead.
 */
import type { VenueApi } from './types';

export const demoApi: VenueApi = new Proxy({} as VenueApi, {
  get() {
    throw new Error('The demo backend is not part of this build.');
  },
});
