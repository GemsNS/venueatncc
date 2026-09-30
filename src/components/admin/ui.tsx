/** Small shared pieces for the admin screens. */
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { Icon } from '../islands/Icon';
import type { IconName } from '../../shared/icons';
import type { InquiryStatus } from '../../shared/types';
import { statusLabel, statusTone } from './format';

/**
 * The monogram from src/assets/brand/venue-mark.svg, inlined in currentColor so it follows the
 * theme: the logo accent, Berry in light mode and Blossom in dark mode (brand.md).
 */
export function Monogram(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3" />
      <circle cx="50" cy="50" r="40.5" fill="none" stroke="currentColor" stroke-width="1.1" />
      <path
        fill="currentColor"
        d="M62.52 32.03Q63.52 32.10 63.95 32.41Q64.38 32.72 64.38 33.34Q64.38 33.89 64.14 34.51L51.55 68.12L51.30 68.12L38.16 32.22L43.55 31.72L43.55 31.23L28.05 31.23L28.05 31.72L33.14 32.22L48.82 75L49.94 75L65.13 34.51Q65.62 33.09 66.28 32.62Q66.93 32.16 68.48 32.03L71.95 31.72L71.95 31.23L58.74 31.23L58.74 31.72"
      />
    </svg>
  );
}

export function StatusBadge({ status }: { status: InquiryStatus }) {
  return <span class={`badge adm-tone--${statusTone(status)}`}>{statusLabel(status)}</span>;
}

export function PageHeader({
  title,
  subtitle,
  children,
  titleId,
}: {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  children?: ComponentChildren;
  titleId?: string;
}) {
  return (
    <header class="adm-header">
      <div class="adm-header__text">
        <h1 id={titleId} class="adm-title" tabIndex={-1}>
          {title}
        </h1>
        {subtitle && <p class="adm-header__sub">{subtitle}</p>}
      </div>
      {children && <div class="adm-header__actions">{children}</div>}
    </header>
  );
}

export function Skeleton({ width = '100%', height = '1em', radius }: { width?: string; height?: string; radius?: string }) {
  return <span class="adm-skel" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function SkeletonRows({ count = 4, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div class="list-group adm-list" aria-busy="true">
      <span class="visually-hidden" role="status">
        {label}
      </span>
      {Array.from({ length: count }, (_, i) => (
        <div class="list-row adm-skelrow" key={i}>
          <div class="list-row__main adm-skelrow__main">
            <Skeleton width={`${46 + ((i * 17) % 30)}%`} height="0.95rem" />
            <Skeleton width={`${30 + ((i * 11) % 25)}%`} height="0.8rem" />
          </div>
          <Skeleton width="4.5rem" height="1.4rem" radius="999px" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ComponentChildren;
  action?: ComponentChildren;
}) {
  return (
    <div class="adm-empty">
      <span class="adm-empty__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <h2 class="adm-empty__title">{title}</h2>
      {children && <p class="adm-empty__text">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div class="adm-banner adm-banner--error" role="alert">
      <Icon name="info" />
      <p>{message}</p>
      {onRetry && (
        <button type="button" class="btn btn--outline btn--sm adm-btn-44" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

/** A segmented control with radio semantics: one tab stop, arrow keys move the selection. */
export function SegmentedRadio<T extends string>({
  label,
  options,
  value,
  onChange,
  class: className,
  labelledBy,
}: {
  label?: string;
  labelledBy?: string;
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
  class?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((o) => o.id === value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const onKeyDown = (e: KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const current = Math.max(0, options.findIndex((o) => o.id === (e.target as HTMLElement).dataset.id));
    let next = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % options.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    onChange(options[next].id);
    const btn = ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next];
    btn?.focus();
  };

  return (
    <div
      ref={ref}
      class={`segmented adm-segmented${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => (
        <button
          type="button"
          key={o.id}
          role="radio"
          data-id={o.id}
          class="segmented__item"
          aria-checked={o.id === value ? 'true' : 'false'}
          tabIndex={i === focusIndex ? 0 : -1}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
