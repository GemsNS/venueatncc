/**
 * A small real photo of a space, in the file's own 3:2 shape (nothing cropped), for the space rows and the
 * summary card. The combined choice shows its two spaces side by side. The row or card names the space, so
 * the picture is decorative to assistive technology.
 */
import type { SpaceChoice } from '../../shared/types';

export interface SpacePhoto {
  src: string;
  srcset: string;
  alt: string;
}

/**
 * One photo per single space. bothA and bothB would show the combined choice as a pair; since version 9 (one
 * real photo per subject, no repeats on a page) /book/ passes null for both, and that row has no photo.
 */
export interface SpacePhotos {
  indoor: SpacePhoto | null;
  main: SpacePhoto | null;
  outdoor: SpacePhoto | null;
  bothA: SpacePhoto | null;
  bothB: SpacePhoto | null;
}

function Img(props: { photo: SpacePhoto; sizes: string }) {
  return <img class="bk-thumb__img" src={props.photo.src} srcset={props.photo.srcset} sizes={props.sizes} alt="" loading="lazy" decoding="async" />;
}

/** Whether a photo exists for this choice. */
export function hasSpacePhoto(photos: SpacePhotos | undefined, space: SpaceChoice): boolean {
  if (!photos) return false;
  return space === 'both' ? Boolean(photos.bothA && photos.bothB) : Boolean(photos[space]);
}

export function SpaceThumb(props: { photos: SpacePhotos; space: SpaceChoice; sizes?: string; class?: string }) {
  const { photos, space } = props;
  const sizes = props.sizes ?? '120px';
  const cls = `bk-thumb${props.class ? ` ${props.class}` : ''}`;
  if (space === 'both') {
    if (!photos.bothA || !photos.bothB) return null;
    return (
      <span class={`${cls} bk-thumb--pair`} aria-hidden="true">
        <Img photo={photos.bothA} sizes={sizes} />
        <Img photo={photos.bothB} sizes={sizes} />
      </span>
    );
  }
  const photo = photos[space];
  if (!photo) return null;
  return (
    <span class={cls} aria-hidden="true">
      <Img photo={photo} sizes={sizes} />
    </span>
  );
}
