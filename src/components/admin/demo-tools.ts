/**
 * Demo-only helpers. Every import here is dynamic and guarded by the build-time demo flag,
 * so production bundles contain neither the demo credentials nor the demo reset.
 */
import { api } from '../../lib/api';

const DEMO = import.meta.env.PUBLIC_DEMO === 'true';

/**
 * Show demo-only UI (banner, demo sign-in, reset). The build-time flag lets production bundles drop
 * that UI entirely; api.demo is the runtime signal from the API client.
 */
export const SHOW_DEMO: boolean = DEMO && api.demo;

export async function loadDemoCredentials(): Promise<{ email: string; password: string } | null> {
  if (!DEMO) return null;
  const m = await import('../../lib/api/demo-credentials');
  return { email: m.DEMO_ADMIN_EMAIL, password: m.DEMO_ADMIN_PASSWORD };
}

/** Restores the demo's sample data. Returns false when the demo backend has no reset. */
export async function resetDemo(): Promise<boolean> {
  if (!DEMO) return false;
  const m = (await import('../../lib/api/demo')) as unknown as {
    resetDemoData?: () => unknown;
    default?: unknown;
  };
  const fn = typeof m.resetDemoData === 'function' ? m.resetDemoData : typeof m.default === 'function' ? (m.default as () => unknown) : null;
  if (!fn) return false;
  await fn();
  return true;
}
