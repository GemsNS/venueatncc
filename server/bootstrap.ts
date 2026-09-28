/**
 * Startup helpers shared by the server entry and the CLI tools.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from './config';
import { iso, type Logger } from './context';
import type { Repo } from './repo';
import { hashPassword } from './security';

export const MIN_PASSWORD_LENGTH = 12;

/** Read ./.env if present. Variables already in the environment win. */
export function loadDotEnv(file = path.resolve('.env')): void {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

/** Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when there is none yet. */
export async function ensureFirstAdmin(config: Pick<Config, 'admin'>, repo: Repo, log: Logger, now: () => number = Date.now): Promise<void> {
  if (repo.countAdmins() > 0) {
    if (config.admin) {
      log.warn(
        '[admin] ADMIN_PASSWORD is still set, but an admin already exists, so it is ignored. Remove it from .env and the environment. Use the create-admin tool to add or reset an admin.',
      );
    }
    return;
  }
  if (!config.admin) {
    log.warn('[admin] No admin exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD, or run the create-admin tool (see docs/deploy.md).');
    return;
  }
  if (config.admin.password.length < MIN_PASSWORD_LENGTH) {
    log.error(`[admin] ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters. No admin was created.`);
    return;
  }
  repo.createAdmin(config.admin.email, config.admin.name, await hashPassword(config.admin.password), iso(now()));
  log.info(`[admin] Created the first admin: ${config.admin.email}. You can remove ADMIN_PASSWORD from the environment now.`);
}
