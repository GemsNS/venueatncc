/**
 * Production API client: talks to the venue's own API server.
 *
 * REST contract (the server in server/ implements exactly this):
 *   GET    /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD  -> AvailabilityResponse
 *   GET    /api/form-token                                   -> { token }
 *   POST   /api/inquiries            body InquiryInput       -> InquiryCreated (201)
 *   GET    /api/admin/session                                -> { user: AdminUser } | 401
 *   POST   /api/admin/login          { email, password }     -> AdminUser (sets session cookie)
 *   POST   /api/admin/logout                                 -> { ok: true }
 *   GET    /api/admin/stats                                  -> AdminStats
 *   GET    /api/admin/inquiries?status=&q=                   -> Inquiry[]
 *   GET    /api/admin/inquiries/:id                          -> InquiryDetail
 *   PATCH  /api/admin/inquiries/:id  { status }              -> InquiryDetail
 *   POST   /api/admin/inquiries/:id/notes { body }           -> InquiryDetail
 *   GET    /api/admin/blocks?from=&to=                       -> CalendarBlock[]
 *   POST   /api/admin/blocks         BlockInput              -> CalendarBlock (201)
 *   DELETE /api/admin/blocks/:id                             -> { ok: true }
 *   GET    /api/admin/export.csv                             -> text/csv
 *   POST   /api/admin/password       { current, next }       -> { ok: true }
 * Errors are JSON { ok: false, error, fields? } with a 4xx/5xx status.
 * Mutating requests send X-Requested-With: fetch; the server also checks Origin.
 */
import { apiBase } from '../env';
import type { AdminUser, ApiError } from '../../shared/types';
import type { Result, VenueApi } from './types';

const NETWORK_ERROR: ApiError = { ok: false, error: 'We could not reach the server. Check your connection and try again.' };

async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-Requested-With': 'fetch' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return NETWORK_ERROR;
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    if (data && typeof data === 'object' && (data as ApiError).ok === false) return data as ApiError;
    return { ok: false, error: res.status === 429 ? 'Too many requests. Wait a minute and try again.' : 'Something went wrong. Try again, or call us.' };
  }
  return data as T;
}

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const httpApi: VenueApi = {
  demo: false,
  availability: (from, to) => request('GET', `/api/availability${q({ from, to })}`),
  formToken: () => request('GET', '/api/form-token'),
  submitInquiry: (input) => request('POST', '/api/inquiries', input),
  admin: {
    async session() {
      const r = await request<{ user: AdminUser }>('GET', '/api/admin/session');
      return 'user' in (r as object) ? (r as { user: AdminUser }).user : null;
    },
    login: (email, password) => request('POST', '/api/admin/login', { email, password }),
    async logout() {
      await request('POST', '/api/admin/logout', {});
    },
    stats: () => request('GET', '/api/admin/stats'),
    listInquiries: (query) => request('GET', `/api/admin/inquiries${q({ status: query.status, q: query.q })}`),
    getInquiry: (id) => request('GET', `/api/admin/inquiries/${id}`),
    setStatus: (id, status) => request('PATCH', `/api/admin/inquiries/${id}`, { status }),
    addNote: (id, body) => request('POST', `/api/admin/inquiries/${id}/notes`, { body }),
    listBlocks: (from, to) => request('GET', `/api/admin/blocks${q({ from, to })}`),
    createBlock: (input) => request('POST', '/api/admin/blocks', input),
    deleteBlock: (id) => request('DELETE', `/api/admin/blocks/${id}`),
    async exportCsv() {
      try {
        const res = await fetch(`${apiBase}/api/admin/export.csv`, { credentials: 'same-origin' });
        if (!res.ok) return { ok: false, error: 'Export failed. Sign in again and retry.' };
        return await res.blob();
      } catch {
        return NETWORK_ERROR;
      }
    },
    changePassword: (current, next) => request('POST', '/api/admin/password', { current, next }),
  },
};
