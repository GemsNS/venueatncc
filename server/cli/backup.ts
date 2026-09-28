/**
 * Online backup of the SQLite database (safe while the server is running, WAL included).
 *
 *   npx tsx server/cli/backup.ts [--out <dir>] [--keep <n>]
 *   docker compose exec app node server-dist/backup.mjs
 *
 * Writes <dir>/venue-YYYYMMDD-HHMMSS.db (default dir: "backups" next to the database) and keeps the
 * newest --keep files (default 14). Copy the backups somewhere off the server as well.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { loadDotEnv } from '../bootstrap';
import { databasePathFrom } from '../config';

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function run(argv: string[]): Promise<void> {
  loadDotEnv();
  const dbPath = databasePathFrom(process.env);
  if (!fs.existsSync(dbPath)) throw new Error(`No database at ${dbPath}.`);
  const outDir = path.resolve(arg(argv, '--out') ?? path.join(path.dirname(dbPath), 'backups'));
  const keep = Number(arg(argv, '--keep') ?? 14);
  if (!Number.isInteger(keep) || keep < 1) throw new Error('--keep must be a whole number of at least 1.');

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const target = path.join(outDir, `venue-${stamp}.db`);

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(target);
  } finally {
    db.close();
  }
  console.log(`Backed up ${dbPath} to ${target}`);

  const old = fs
    .readdirSync(outDir)
    .filter((f) => /^venue-[0-9]{8}-[0-9]{6}[.]db$/.test(f))
    .sort()
    .reverse()
    .slice(keep);
  for (const f of old) {
    fs.rmSync(path.join(outDir, f));
    console.log(`Removed old backup ${f}`);
  }
}

run(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
