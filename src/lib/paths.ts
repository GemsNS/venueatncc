/**
 * Base-aware internal links. Use href('/events/') for every internal link and public asset,
 * so the same code works at https://venueatncc.org/ and at https://gemsns.github.io/venueatncc/.
 */
import { basePath } from './env';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|[/][/]|#)/i;

export function href(path: string): string {
  if (!path || EXTERNAL.test(path)) return path;
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${basePath}${clean}`;
}

/** Strip the base path from a pathname, e.g. for "current page" checks. */
export function withoutBase(pathname: string): string {
  if (basePath !== '/' && pathname.startsWith(basePath)) return `/${pathname.slice(basePath.length)}`;
  return pathname;
}
