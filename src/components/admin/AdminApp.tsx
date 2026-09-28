/**
 * The staff admin app: one Preact island on /admin/ (client:only), hash-routed so it also works as a
 * static page on GitHub Pages. Talks to the API only through src/lib/api, so the same code runs against
 * the venue's API server and the in-browser demo backend.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api, isError, type Result } from '../../lib/api';
import type { AdminStats, AdminUser } from '../../shared/types';
import { AdminContext, type AdminCtx } from './context';
import { CalendarView } from './CalendarView';
import { SHOW_DEMO, resetDemo } from './demo-tools';
import { InboxView } from './InboxView';
import { InquiryView } from './InquiryView';
import { parseHash, screenKey, useHash, type Route } from './route';
import { SettingsView } from './SettingsView';
import { Shell } from './Shell';
import { SignIn } from './SignIn';
import { ToastRegion, useToasts } from './Toasts';
import { TodayView } from './TodayView';
import { EmptyState, PageHeader } from './ui';

type Phase = 'loading' | 'signedOut' | 'signedIn';

const EXPIRED = 'Your session ended. Sign in again to pick up where you left off.';

function screenTitle(route: Route): string {
  switch (route.name) {
    case 'today':
      return 'Today';
    case 'inbox':
      return 'Inbox';
    case 'inquiry':
      return 'Request';
    case 'calendar':
      return 'Calendar';
    case 'settings':
      return 'Settings';
    default:
      return 'Not found';
  }
}

/** Move focus to the screen's title so keyboard and screen reader users land on the new screen. */
function focusTitle() {
  const h = document.querySelector<HTMLElement>('.adm-content .adm-title');
  h?.focus({ preventScroll: true });
}

export function BootScreen() {
  return (
    <div class="adm-boot" role="status">
      <span class="adm-boot__spinner" aria-hidden="true" />
      <span class="visually-hidden">Loading the admin</span>
    </div>
  );
}

export default function AdminApp() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [hash, navigate] = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);
  const key = screenKey(route);
  const { items, push, dismiss } = useToasts();
  const [inboxHref, setInboxHref] = useState('#/inbox');
  const userRef = useRef<AdminUser | null>(null);
  const expiring = useRef(false);
  const statsReq = useRef(0);
  const lastScreen = useRef<string | null>(null);
  const focusAfterSignIn = useRef(false);
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title : 'Venue admin');

  userRef.current = user;

  const enter = useCallback((u: AdminUser) => {
    expiring.current = false;
    setUser(u);
    setNotice(null);
    setPhase('signedIn');
  }, []);

  const leave = useCallback((message: string | null) => {
    setUser(null);
    setStats(null);
    setStatsError(null);
    setNotice(message);
    setPhase('signedOut');
    lastScreen.current = null;
  }, []);

  // Initial session check.
  useEffect(() => {
    let alive = true;
    api.admin
      .session()
      .then((u) => {
        if (!alive) return;
        if (u) enter(u);
        else setPhase('signedOut');
      })
      .catch(() => alive && setPhase('signedOut'));
    return () => {
      alive = false;
    };
  }, []);

  const expire = useCallback(() => {
    if (expiring.current) return;
    expiring.current = true;
    leave(EXPIRED);
  }, [leave]);

  const run = useCallback(
    async <T,>(call: Promise<Result<T>>): Promise<Result<T>> => {
      const res = await call;
      if (isError(res) && userRef.current && !expiring.current) {
        // The API reports errors without a status code, so confirm the session is still alive.
        // Offline is not an ended session.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (!offline) {
          const still = await api.admin.session().catch(() => userRef.current);
          if (!still) expire();
        }
      }
      return res;
    },
    [expire],
  );

  const refreshStats = useCallback(async () => {
    const id = ++statsReq.current;
    const res = await run(api.admin.stats());
    if (id !== statsReq.current) return;
    if (isError(res)) setStatsError(res.error);
    else {
      setStats(res);
      setStatsError(null);
    }
  }, [run]);

  // Stats feed the Inbox badge and the Today tiles; refresh on every screen change.
  useEffect(() => {
    if (phase === 'signedIn') refreshStats();
  }, [phase, key]);

  useEffect(() => {
    if (phase !== 'signedIn') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshStats();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase]);

  // Title, focus, and scroll on navigation (effects run after the new screen is in the DOM).
  useEffect(() => {
    if (phase === 'signedIn') {
      document.title = `${screenTitle(route)} | ${baseTitle.current}`;
      if (focusAfterSignIn.current) {
        focusAfterSignIn.current = false;
        focusTitle();
      } else if (lastScreen.current !== null && lastScreen.current !== key) {
        window.scrollTo(0, 0);
        focusTitle();
      }
      lastScreen.current = key;
    } else if (phase === 'signedOut') {
      document.title = `Sign in | ${baseTitle.current}`;
    }
  }, [phase, key]);

  useEffect(() => {
    if (route.name === 'inbox') setInboxHref(hash || '#/inbox');
  }, [hash]);

  const signOut = useCallback(async () => {
    await api.admin.logout();
    leave('You are signed out.');
    navigate('#/', true);
  }, [leave]);

  const onReset = useCallback(async (): Promise<string | null> => {
    if (!SHOW_DEMO) return 'Reset is not available in this build.';
    try {
      const ok = await resetDemo();
      if (!ok) return 'Reset is not available in this build.';
    } catch {
      return 'The reset did not work. Try again.';
    }
    const u = await api.admin.session();
    if (!u) {
      leave('Demo data reset. Sign in to continue.');
      navigate('#/', true);
      return null;
    }
    refreshStats();
    push('Demo data reset.');
    return null;
  }, [leave, refreshStats, push]);

  const ctx: AdminCtx | null = user
    ? { user, run, toast: push, stats, statsError, refreshStats, navigate, inboxHref, signOut }
    : null;

  if (phase === 'loading') return <BootScreen />;

  if (phase === 'signedOut' || !ctx || !user) {
    return (
      <>
        <SignIn
          notice={notice}
          onSignedIn={(u) => {
            focusAfterSignIn.current = true;
            enter(u);
          }}
        />
        <ToastRegion items={items} onDismiss={dismiss} />
      </>
    );
  }

  let view;
  switch (route.name) {
    case 'today':
      view = <TodayView />;
      break;
    case 'inbox':
      view = <InboxView status={route.status} q={route.q} />;
      break;
    case 'inquiry':
      view = <InquiryView key={route.id} id={route.id} />;
      break;
    case 'calendar':
      view = <CalendarView month={route.month} day={route.day} />;
      break;
    case 'settings':
      view = <SettingsView onReset={onReset} />;
      break;
    default:
      view = (
        <div class="adm-screen">
          <PageHeader title="Not found" />
          <div class="list-group adm-list">
            <EmptyState
              icon="info"
              title="That page does not exist"
              action={
                <a class="btn btn--gray" href="#/">
                  Go to Today
                </a>
              }
            >
              The link may be old. Start from Today.
            </EmptyState>
          </div>
        </div>
      );
  }

  return (
    <AdminContext.Provider value={ctx}>
      <Shell route={route} user={user} stats={stats} inboxHref={inboxHref} onSignOut={signOut}>
        {view}
      </Shell>
      <ToastRegion items={items} onDismiss={dismiss} />
    </AdminContext.Provider>
  );
}
