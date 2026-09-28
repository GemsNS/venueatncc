#!/usr/bin/env node
/**
 * npm run dev: the Astro dev server (http://localhost:4321) and the API server (port 8787) together,
 * with prefixed output. Astro proxies /api to the API (see astro.config.mjs). Ctrl+C stops both,
 * and if either one exits, the other is stopped too.
 *
 * The API gets NODE_ENV=development, HOST=127.0.0.1, and PUBLIC_ORIGIN=http://localhost:4321 unless
 * they are already set in the environment. Put ADMIN_EMAIL and ADMIN_PASSWORD in .env for an admin.
 *
 * Extra arguments go to astro dev, e.g. npm run dev -- --host
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const color = process.stdout.isTTY && !process.env.NO_COLOR;

/** The JS entry of a package's CLI, run with this same node binary (no shell, works on Windows). */
function binOf(pkg, name) {
  const dir = path.join(root, 'node_modules', pkg);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[name ?? pkg];
  if (!bin) throw new Error(`Cannot find the ${pkg} command. Run npm install first.`);
  return path.join(dir, bin);
}

const ESC = String.fromCharCode(27);
const NL = String.fromCharCode(10);
const paint = (code, text) => (color ? `${ESC}[${code}m${text}${ESC}[0m` : text);

/** Astro logs JSON lines when its output is piped; turn them back into readable text. */
function readable(line) {
  const t = line.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return [line];
  try {
    const entry = JSON.parse(t);
    if (typeof entry.message !== 'string') return [line];
    const label = entry.label && entry.label !== 'SKIP_FORMAT' ? `[${entry.label}] ` : '';
    return entry.message.split(NL).map((l, i) => (i === 0 ? label + l : l));
  } catch {
    return [line];
  }
}

/**
 * With trailingSlash: 'always', Astro's dev server puts its trailing-slash check at the top of the
 * middleware stack, so /api/form-token gets Astro's 404 before Vite's /api proxy runs. Until
 * astro.config.mjs moves the proxy first itself, run astro dev with a wrapper config that does.
 */
const PROXY_FIX = `// Written by scripts/dev.mjs for npm run dev. Safe to delete.
import base from '../astro.config.mjs';
const apiProxyFirst = {
  name: 'venue:api-proxy-first',
  configureServer(server) {
    return () => {
      const stack = server.middlewares.stack;
      const i = stack.findIndex((layer) => layer.handle && layer.handle.name === 'viteProxyMiddleware');
      if (i > 0) stack.unshift(...stack.splice(i, 1));
    };
  },
};
const server = base.vite?.server ?? {};
export default {
  ...base,
  vite: {
    ...base.vite,
    plugins: [...(base.vite?.plugins ?? []), apiProxyFirst],
    // The API writes its database and email outbox under data/; no need to watch them.
    server: { ...server, watch: { ...server.watch, ignored: ['**/data/**', '**/.tmp/**'] } },
  },
};
`;

function astroConfigArgs() {
  const userConfig = fs.readFileSync(path.join(root, 'astro.config.mjs'), 'utf8');
  if (userConfig.includes('viteProxyMiddleware') || process.argv.includes('--config')) return [];
  const file = path.join(root, '.astro', 'dev-api-proxy.config.mjs');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PROXY_FIX);
  return ['--config', path.relative(root, file).split(path.sep).join('/')];
}

const apiEnv = {
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PUBLIC_ORIGIN: 'http://localhost:4321',
  ...process.env,
  ...(color ? { FORCE_COLOR: '1' } : {}),
};

const tasks = [
  {
    name: 'site',
    code: '35',
    args: [binOf('astro'), 'dev', ...astroConfigArgs(), ...process.argv.slice(2)],
    env: { ...process.env, ...(color ? { FORCE_COLOR: '1' } : {}) },
  },
  { name: 'api ', code: '36', args: [binOf('tsx'), 'watch', '--clear-screen=false', 'server/index.ts'], env: apiEnv },
];

const children = [];
let stopping = false;
let exitCode = 0;

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) killTree(child);
  setTimeout(() => process.exit(exitCode), 1500).unref();
}

for (const task of tasks) {
  const child = spawn(process.execPath, task.args, {
    cwd: root,
    env: task.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWindows,
    windowsHide: true,
  });
  children.push(child);
  const prefix = paint(task.code, `[${task.name}]`);
  for (const stream of [child.stdout, child.stderr]) {
    readline.createInterface({ input: stream }).on('line', (line) => {
      for (const out of readable(line)) process.stdout.write(`${prefix} ${out}${NL}`);
    });
  }
  child.on('exit', (code, signal) => {
    if (!stopping) {
      process.stdout.write(`${prefix} exited (${signal ?? code}). Stopping the other process.${NL}`);
      stopAll(typeof code === 'number' ? code : 1);
    }
    if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) process.exit(exitCode);
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
process.on('exit', () => {
  for (const child of children) killTree(child);
});
