import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { AdminStats, AdminUser } from '../../shared/types';
import type { Result } from '../../lib/api';

export type ToastTone = 'success' | 'error' | 'info';

export interface AdminCtx {
  user: AdminUser;
  /** Run an admin API call. Any error is checked for an ended session, which returns to sign-in. */
  run: <T>(call: Promise<Result<T>>) => Promise<Result<T>>;
  toast: (message: string, tone?: ToastTone) => void;
  stats: AdminStats | null;
  statsError: string | null;
  refreshStats: () => void;
  navigate: (hash: string, replace?: boolean) => void;
  /** The last Inbox address, so "back to Inbox" keeps its filter and search. */
  inboxHref: string;
  signOut: () => void;
}

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin outside AdminContext');
  return ctx;
}
