/** App chrome: a glass sidebar at 744px and wider, a floating glass tab bar on phones. */
import type { ComponentChildren } from 'preact';
import { SHOW_DEMO } from './demo-tools';
import type { AdminStats, AdminUser } from '../../shared/types';
import type { IconName } from '../../shared/icons';
import { Icon } from '../islands/Icon';
import { Monogram } from './ui';
import type { Route } from './route';

interface NavItem {
  id: 'today' | 'inbox' | 'calendar' | 'settings';
  label: string;
  icon: IconName;
  href: string;
}

const NAV: NavItem[] = [
  { id: 'today', label: 'Today', icon: 'home', href: '#/' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', href: '#/inbox' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', href: '#/calendar' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '#/settings' },
];

function currentSection(route: Route): NavItem['id'] | null {
  if (route.name === 'inquiry') return 'inbox';
  if (route.name === 'today' || route.name === 'inbox' || route.name === 'calendar' || route.name === 'settings') return route.name;
  return null;
}

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span class="adm-count" aria-hidden="true">
      {n > 99 ? '99+' : n}
    </span>
  );
}

function CountText({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span class="visually-hidden">, {n} new</span>;
}

export function Shell({
  route,
  user,
  stats,
  inboxHref,
  onSignOut,
  children,
}: {
  route: Route;
  user: AdminUser;
  stats: AdminStats | null;
  inboxHref: string;
  onSignOut: () => void;
  children: ComponentChildren;
}) {
  const current = currentSection(route);
  const newCount = stats?.byStatus.new ?? 0;
  // Inbox keeps its last filter and search, except when you are already on it (then it resets).
  const hrefFor = (item: NavItem) => (item.id === 'inbox' && route.name !== 'inbox' ? inboxHref : item.href);

  return (
    <div class="adm">
      <nav class="adm-sidebar glass" aria-label="Admin">
        <div class="adm-sidebar__brand">
          <Monogram class="adm-sidebar__mark" />
          <span class="adm-sidebar__text">
            <span class="adm-sidebar__name">
              The Venue <span class="adm-sidebar__at">at NCC</span>
            </span>
            <span class="adm-sidebar__role">Admin</span>
          </span>
        </div>
        <ul class="adm-sidebar__list">
          {NAV.map((item) => (
            <li key={item.id}>
              <a class="adm-nav" href={hrefFor(item)} aria-current={current === item.id ? 'page' : undefined}>
                <Icon name={item.icon} />
                <span class="adm-nav__label">
                  {item.label}
                  {item.id === 'inbox' && <CountText n={newCount} />}
                </span>
                {item.id === 'inbox' && <CountBadge n={newCount} />}
              </a>
            </li>
          ))}
        </ul>
        <div class="adm-sidebar__foot">
          <p class="adm-sidebar__user">
            <span class="adm-sidebar__username">{user.name}</span>
            <span class="adm-sidebar__email">{user.email}</span>
          </p>
          <button type="button" class="adm-nav adm-nav--button" onClick={onSignOut}>
            <Icon name="log-out" />
            <span class="adm-nav__label">Sign Out</span>
          </button>
        </div>
      </nav>

      <div class="adm-content">
        {SHOW_DEMO && (
          <p class="adm-demo-banner" role="note">
            <Icon name="info" />
            <span>Demo data. Changes stay in this browser.</span>
          </p>
        )}
        {children}
      </div>

      <nav class="adm-tabbar glass" aria-label="Admin tabs">
        {NAV.map((item) => (
          <a key={item.id} class="adm-tab" href={hrefFor(item)} aria-current={current === item.id ? 'page' : undefined}>
            <span class="adm-tab__icon">
              <Icon name={item.icon} />
              {item.id === 'inbox' && <CountBadge n={newCount} />}
            </span>
            <span class="adm-tab__label">
              {item.label}
              {item.id === 'inbox' && <CountText n={newCount} />}
            </span>
          </a>
        ))}
      </nav>
    </div>
  );
}
