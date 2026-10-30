/**
 * Microsoft 365 sign-in for the server: an app registration's client credentials exchanged for an
 * access token, which both IMAP (IMAP.AccessAsApp) and SMTP (SMTP.SendAsApp) accept. Microsoft 365 no
 * longer takes passwords from apps, so this is how the server reads and sends as faith@venueatncc.org.
 * One token serves both; it is cached until a minute before it expires.
 */
export interface M365App {
  /** The directory: its id, or a domain in it such as venueatncc.org. */
  tenant: string;
  clientId: string;
  clientSecret: string;
}

export type TokenSource = (app: M365App) => Promise<string>;

export function createTokenSource(fetchFn: typeof fetch = fetch, now: () => number = Date.now): TokenSource {
  const cache = new Map<string, { value: string; expires: number }>();
  return async (app) => {
    const key = `${app.tenant}|${app.clientId}`;
    const hit = cache.get(key);
    if (hit && hit.expires > now() + 60_000) return hit.value;
    const res = await fetchFn(`https://login.microsoftonline.com/${encodeURIComponent(app.tenant)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        scope: 'https://outlook.office365.com/.default',
        grant_type: 'client_credentials',
      }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !body.access_token) {
      throw new Error(`Microsoft 365 did not sign the website in: ${(body.error_description ?? `HTTP ${res.status}`).split('\n')[0].slice(0, 200)}`);
    }
    cache.set(key, { value: body.access_token, expires: now() + (body.expires_in ?? 3600) * 1000 });
    return body.access_token;
  };
}
