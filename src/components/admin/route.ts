/**
 * Hash routing, so the admin works as one static page (including on GitHub Pages):
 *   #/                  Today
 *   #/inbox?status=&q=  Inbox
 *   #/inquiry/<id>      Request detail
 *   #/calendar?m=YYYY-MM&d=YYYY-MM-DD
 *   #/mail?box=archived&q=  Mail (the venue mailbox)
 *   #/mail/<thread id>
 *   #/mail/new?to=&subject=
 *   #/settings
 */
import { useEffect, useState } from 'preact/hooks';
import { isDateKey } from '../../shared/dates';
import { INQUIRY_STATUSES, type DateKey, type InquiryStatus, type MailBox } from '../../shared/types';

export type InboxFilter = InquiryStatus | 'open' | 'all';

export type Route =
  | { name: 'today' }
  | { name: 'inbox'; status: InboxFilter; q: string }
  | { name: 'inquiry'; id: number }
  | { name: 'calendar'; month: string | null; day: DateKey | null }
  | { name: 'mail'; box: MailBox; q: string }
  | { name: 'mailThread'; id: number }
  | { name: 'mailNew'; to: string; subject: string }
  | { name: 'settings' }
  | { name: 'notfound' };

const FILTERS: InboxFilter[] = ['open', 'all', ...INQUIRY_STATUSES.map((s) => s.id)];

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart);
  const head = parts[0] ?? '';

  if (head === '' || head === 'today') return { name: 'today' };
  if (head === 'inbox') {
    const s = params.get('status') as InboxFilter | null;
    return { name: 'inbox', status: s && FILTERS.includes(s) ? s : 'open', q: params.get('q') ?? '' };
  }
  if (head === 'inquiry' && parts[1] && /^[0-9]+$/.test(parts[1])) return { name: 'inquiry', id: Number(parts[1]) };
  if (head === 'calendar') {
    const m = params.get('m');
    const d = params.get('d');
    return {
      name: 'calendar',
      month: m && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(m) ? m : null,
      day: d && isDateKey(d) ? d : null,
    };
  }
  if (head === 'mail') {
    if (parts[1] === 'new') return { name: 'mailNew', to: params.get('to') ?? '', subject: params.get('subject') ?? '' };
    if (parts[1] && /^[0-9]+$/.test(parts[1])) return { name: 'mailThread', id: Number(parts[1]) };
    return { name: 'mail', box: params.get('box') === 'archived' ? 'archived' : 'inbox', q: params.get('q') ?? '' };
  }
  if (head === 'settings') return { name: 'settings' };
  return { name: 'notfound' };
}

export function inboxHash(status: InboxFilter, q: string): string {
  const p = new URLSearchParams();
  if (status !== 'open') p.set('status', status);
  if (q.trim()) p.set('q', q.trim());
  const s = p.toString();
  return `#/inbox${s ? `?${s}` : ''}`;
}

export function calendarHash(month: string | null, day?: DateKey | null): string {
  const p = new URLSearchParams();
  if (month) p.set('m', month);
  if (day) p.set('d', day);
  const s = p.toString();
  return `#/calendar${s ? `?${s}` : ''}`;
}

export function mailHash(box: MailBox, q: string): string {
  const p = new URLSearchParams();
  if (box !== 'inbox') p.set('box', box);
  if (q.trim()) p.set('q', q.trim());
  const s = p.toString();
  return `#/mail${s ? `?${s}` : ''}`;
}

/** A stable key for "which screen is this", ignoring filters, so focus moves only on real navigation. */
export function screenKey(route: Route): string {
  if (route.name === 'inquiry') return `inquiry:${route.id}`;
  if (route.name === 'mailThread') return `mail:${route.id}`;
  return route.name;
}

export function useHash(): [string, (hash: string, replace?: boolean) => void] {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  const navigate = (next: string, replace = false) => {
    if (next === location.hash) return;
    if (replace) {
      history.replaceState(history.state, '', next);
      setHash(next);
    } else {
      location.hash = next;
    }
  };
  return [hash, navigate];
}
