let n = 0;
/** Unique-per-build id for SVG gradient ids and ARIA relationships. */
export function uid(prefix = 'id'): string {
  n += 1;
  return `${prefix}-${n}`;
}
