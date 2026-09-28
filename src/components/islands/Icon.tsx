/** Preact version of the shared icon set (see src/shared/icons.ts). */
import { icons, type IconName } from '../../shared/icons';

export function Icon({ name, label, class: className }: { name: IconName; label?: string; class?: string }) {
  return (
    <svg
      class={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  );
}
