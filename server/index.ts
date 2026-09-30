/**
 * The Venue @ NCC server: the REST API (see src/lib/api/http.ts) plus the built static site.
 *
 *   npm run dev:api     development, restarts on change (tsx watch)
 *   npm run build       builds the site into dist/ and this server into server-dist/index.mjs
 *   npm start           runs server-dist/index.mjs
 *
 * Configuration comes from environment variables (see .env.example); a .env file in the working
 * directory is read if present, and real environment variables win over it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { ensureFirstAdmin, loadDotEnv } from './bootstrap';
import { loadConfig } from './config';
import { iso, type Logger } from './context';
import { openDatabase } from './db';
import { pruneOutbox } from './email/mailer';
import { Repo } from './repo';
import { SESSION_IDLE_MS } from './routes/admin';

const HOUR = 60 * 60 * 1000;

async function main(): Promise<void> {
  loadDotEnv();
  const log: Logger = console;
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  const repo = new Repo(db);
  await ensureFirstAdmin(config, repo, log);

  if (!fs.existsSync(path.join(config.siteDir, 'index.html'))) {
    const message = `[site] ${config.siteDir} has no built site, so only the API is served.`;
    if (config.production) log.warn(`${message} Build it with npm run build:site.`);
    else log.info(`${message} That is expected under npm run dev, where Astro serves the pages.`);
  }

  const { app, ctx, whenIdle } = createApp({ config, db, log });
  if (ctx.mailer.transport === 'outbox') {
    log.warn(`[email] SMTP is not configured. Emails are saved to ${config.outboxDir} instead of being sent.`);
  } else {
    log.info(`[email] Sending through ${config.smtp?.host}:${config.smtp?.port} as ${config.mailFrom}. Notifications go to ${config.notifyTo}.`);
  }

  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
      // A client that sends headers or a body very slowly (or never finishes) gives up its
      // connection after these limits instead of holding it for Node's default 5 minutes.
      // Node checks these every connectionsCheckingInterval (30 s by default), so check more often.
      serverOptions: { headersTimeout: 10_000, requestTimeout: 15_000, connectionsCheckingInterval: 2_000 },
    },
    (info) => {
      const shown = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
      log.info(`[server] ${config.nodeEnv}: listening on http://${shown}:${info.port} (public origin ${config.publicOrigin})`);
    },
  );
  // No hard connection cap: a fixed cap lets one client that opens many slow connections lock every
  // visitor out. The header and request timeouts above end slow clients instead, and the reverse
  // proxy (Caddyfile) is the place for per-client connection limits.
  if (process.env.ADMIN_PASSWORD && !config.admin) {
    log.warn('[admin] ADMIN_PASSWORD is set without ADMIN_EMAIL, so it is ignored. Remove it from .env and the environment.');
  }

  if (config.outboxRetentionDays) {
    log.info(`[email] Outbox files older than ${config.outboxRetentionDays} days are deleted.`);
  }

  const housekeeping = setInterval(() => {
    const t = Date.now();
    try {
      repo.deleteExpiredSessions(iso(t), iso(t - SESSION_IDLE_MS));
      ctx.limits.login.prune(t);
      ctx.limits.loginIp.prune(t);
      ctx.limits.loginAccount.prune(t);
      ctx.limits.password.prune(t);
    } catch (err) {
      log.error('[housekeeping]', err);
    }
    if (config.outboxRetentionDays) {
      pruneOutbox(config.outboxDir, config.outboxRetentionDays, t)
        .then((removed) => {
          if (removed > 0) log.info(`[email] Deleted ${removed} outbox files older than ${config.outboxRetentionDays} days.`);
        })
        .catch((err: unknown) => log.error('[housekeeping] outbox', err));
    }
  }, HOUR);
  housekeeping.unref();

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info(`[server] ${signal} received, shutting down.`);
    clearInterval(housekeeping);
    server.close();
    await Promise.race([whenIdle(), new Promise((resolve) => setTimeout(resolve, 10_000))]);
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
