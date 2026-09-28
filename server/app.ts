/**
 * Builds the Hono app. server/index.ts runs it; tests call app.request() directly.
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Config } from './config';
import { apiError, Tasks, type AppEnv, type Logger, type ServerContext } from './context';
import type { Db } from './db';
import { createMailer, type Mailer } from './email/mailer';
import { noStore, sameOrigin, securityHeaders } from './middleware';
import { Repo } from './repo';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';
import { dummyPasswordHash, ipHasher, RateLimiter } from './security';
import { createNotFoundPage, mountStatic } from './static';

export interface AppDeps {
  config: Config;
  db: Db;
  mailer?: Mailer;
  now?: () => number;
  log?: Logger;
}

export interface VenueServerApp {
  app: Hono<AppEnv>;
  ctx: ServerContext;
  /** Resolves when background work (emails) has finished. */
  whenIdle(): Promise<void>;
}

const MAX_BODY_BYTES = 64 * 1024;

/** Sign-in attempts allowed from one address (or IPv6 /64) in 15 minutes, across all emails. */
export const LOGIN_ATTEMPTS_PER_ADDRESS = 20;

export function createApp(deps: AppDeps): VenueServerApp {
  const log = deps.log ?? console;
  const now = deps.now ?? Date.now;
  const ctx: ServerContext = {
    config: deps.config,
    repo: new Repo(deps.db),
    mailer: deps.mailer ?? createMailer(deps.config, now),
    now,
    log,
    tasks: new Tasks(log),
    hashIp: ipHasher(deps.config.sessionSecret),
    limits: {
      login: new RateLimiter(10, 15 * 60 * 1000),
      loginIp: new RateLimiter(LOGIN_ATTEMPTS_PER_ADDRESS, 15 * 60 * 1000),
      password: new RateLimiter(10, 15 * 60 * 1000),
    },
  };

  // Compute the decoy hash now, so the first sign-in with an unknown email is not measurably faster.
  dummyPasswordHash().catch(() => undefined);

  const app = new Hono<AppEnv>();

  app.use('*', securityHeaders(deps.config));
  app.use('/api/*', noStore);
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ ok: false as const, error: 'That request is too large.' }, 413),
    }),
  );
  app.use('/api/*', sameOrigin(deps.config));

  app.route('/api', publicRoutes(ctx));
  app.route('/api/admin', adminRoutes(ctx));
  app.all('/api/*', (c) => apiError(c, 404, 'Not found.'));
  app.all('/api', (c) => apiError(c, 404, 'Not found.'));

  mountStatic(app, deps.config.siteDir);
  const notFoundPage = createNotFoundPage(deps.config.siteDir, deps.config.production);
  app.notFound((c) => notFoundPage(c));

  app.onError((err, c) => {
    log.error(`[error] ${c.req.method} ${c.req.path}:`, err);
    const p = c.req.path;
    if (p === '/api' || p.startsWith('/api/')) {
      return c.json({ ok: false as const, error: 'Something went wrong on our side. Try again, or call us.' }, 500);
    }
    return c.text('Something went wrong on our side. Try again in a moment.', 500);
  });

  return { app, ctx, whenIdle: () => ctx.tasks.idle() };
}
