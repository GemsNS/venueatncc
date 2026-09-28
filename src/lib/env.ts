/**
 * Build-time switches.
 *
 * PUBLIC_DEMO=true builds the static GitHub Pages demo: the booking and admin screens use an
 * in-browser demo backend (localStorage), nothing is sent anywhere, and every page is noindex.
 * Otherwise the site talks to the venue's own API server (server/), same origin by default.
 */
export const isDemo = import.meta.env.PUBLIC_DEMO === 'true';

/** Where the API lives. Empty means same origin (the API server also serves the site). */
export const apiBase: string = (import.meta.env.PUBLIC_API_BASE ?? '').replace(/[/]+$/, '');

/** The site's base path: '/' in production, '/venueatncc/' on GitHub Pages. Always ends with '/'. */
export const basePath: string = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
