/**
 * Create an admin, or reset an existing admin's password.
 *
 *   npm run admin:create -- --email faith@venueatncc.org --name Faith
 *   echo "a long passphrase" | npm run admin:create -- --email faith@venueatncc.org --password-stdin
 *
 * In the Docker image: docker compose exec app node server-dist/create-admin.mjs --email ... --name ...
 * The password is typed at a hidden prompt (asked twice), or read from standard input with
 * --password-stdin. Uses DATABASE_PATH (default ./data/venue.db). Resetting a password signs that
 * admin out everywhere.
 */
import { z } from 'zod';
import { loadDotEnv, MIN_PASSWORD_LENGTH } from '../bootstrap';
import { databasePathFrom } from '../config';
import { iso } from '../context';
import { openDatabase } from '../db';
import { Repo } from '../repo';
import { hashPassword } from '../security';

const NL = String.fromCharCode(10);

const USAGE = [
  'Usage: create-admin --email <address> [--name <name>] [--password-stdin]',
  '',
  '  --email           the admin sign-in email (required)',
  '  --name            display name, required for a new admin',
  '  --password-stdin  read the password from standard input instead of a hidden prompt',
].join(NL);

interface Args {
  email?: string;
  name?: string;
  passwordStdin: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { passwordStdin: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    const value = () => inline ?? argv[++i];
    if (flag === '--email') args.email = value();
    else if (flag === '--name') args.name = value();
    else if (flag === '--password-stdin') args.passwordStdin = true;
    else if (flag === '--help' || flag === '-h') args.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return args;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '');
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const done = (fn: () => void) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(NL);
      fn();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (code === 13 || code === 10) return done(() => resolve(value));
        if (code === 3) return done(() => reject(new Error('Cancelled.')));
        if (code === 127 || code === 8) {
          value = Array.from(value).slice(0, -1).join('');
          continue;
        }
        if (code < 32) continue;
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function readPassword(args: Args): Promise<string> {
  if (args.passwordStdin) return readStdin();
  if (!process.stdin.isTTY) throw new Error('No terminal to prompt in. Pipe the password in with --password-stdin.');
  const first = await promptHidden('New password: ');
  const second = await promptHidden('Repeat it: ');
  if (first !== second) throw new Error('The passwords do not match.');
  return first;
}

async function run(argv: string[]): Promise<void> {
  loadDotEnv();
  const args = parseArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const email = z.email().safeParse(args.email?.trim().toLowerCase());
  if (!email.success) throw new Error(`Give a valid --email.${NL}${NL}${USAGE}`);

  const dbPath = databasePathFrom(process.env);
  const db = openDatabase(dbPath);
  try {
    const repo = new Repo(db);
    const existing = repo.findAdminByEmail(email.data);
    const name = args.name?.trim();
    if (!existing && !name) throw new Error(`A new admin needs a --name.${NL}${NL}${USAGE}`);

    const password = await readPassword(args);
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password.length > 500) throw new Error('Use 500 characters or fewer.');
    const hash = await hashPassword(password);
    const stamp = iso(Date.now());

    if (existing) {
      repo.updateAdmin(existing.id, { passwordHash: hash, name }, stamp);
      const ended = repo.deleteAllSessions(existing.id);
      console.log(`Updated the password for ${existing.email}${name ? ` and set the name to ${name}` : ''}. Signed out ${ended} session(s).`);
    } else {
      const created = repo.createAdmin(email.data, name!, hash, stamp);
      console.log(`Created admin ${created.email} (${created.name}) in ${dbPath}.`);
    }
  } finally {
    db.close();
  }
}

run(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
