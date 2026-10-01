# Runbook: venueatncc.org on the shared Google Cloud VM (Apache + pm2)

This is the complete, copy-pasteable runbook for deploying The Venue @ NCC to the existing shared
server `instance-20260502-213133` (34.30.208.144), next to the three sites already running there.
It is written for the operator **grokbot** (SSH with sudo). The approver for shared changes is **Joel**.

The generic notes in [deploy.md](deploy.md) (Docker, Caddy) do **not** apply to this server. Docker
and Caddy are not used here: Apache terminates HTTPS and proxies to the Node app, which pm2 keeps
running.

Conventions in this document:

- Every command is meant to be pasted as is. Paths are real; nothing needs filling in unless the
  text says so in `<ANGLE BRACKETS>`.
- Commands run as **grokbot** unless they start with `sudo -H -u mvandykeanthony bash -c '...'`,
  which runs them as the site owner with the patched Node 24 first on `PATH` (the only working way
  to run npm and pm2 as the owner on this server).
- **[SHARED]** marks a command that touches state other sites share (Apache, certbot, pm2's process
  list, the owner's crontab). **[SHARED, JOEL OK]** marks one that must not run until Joel has said
  yes, in writing, for that specific change.
- Snapshots and notes go in `~/venueatncc-deploy/` in grokbot's home directory.

Contents:

- [0. Summary and the changes that need Joel's OK](#0-summary-and-the-changes-that-need-joels-ok)
- [1. Preflight and before-snapshots](#1-preflight-and-before-snapshots)
- [2. Directory layout and ownership](#2-directory-layout-and-ownership)
- [3. Getting the code onto the server](#3-getting-the-code-onto-the-server)
- [4. Node: the patched v24 binary](#4-node-the-patched-v24-binary)
- [5. Install and build](#5-install-and-build)
- [6. The .env file](#6-the-env-file)
- [7. pm2](#7-pm2)
- [8. Apache vhost](#8-apache-vhost)
- [9. TLS with certbot](#9-tls-with-certbot)
- [10. First admin and smoke test](#10-first-admin-and-smoke-test)
- [11. Email: the owner's decision](#11-email-the-owners-decision)
- [12. Backups](#12-backups)
- [13. Post-install verification checklist](#13-post-install-verification-checklist)
- [14. Updating later, and rollback](#14-updating-later-and-rollback)
- [15. Troubleshooting](#15-troubleshooting)

---

## 0. Summary and the changes that need Joel's OK

| Item | Value |
| --- | --- |
| Domains | `venueatncc.org`, `www.venueatncc.org` (both serve the site; every page's canonical link points at `https://venueatncc.org`) |
| Public IP (DNS A records already point here) | `34.30.208.144` |
| Site directory | `/var/www/venueatncc.org/` (owner `mvandykeanthony:www-data`) |
| Code (git checkout) | `/var/www/venueatncc.org/app/` |
| Data (SQLite database, email outbox, backups) | `/var/www/venueatncc.org/data/` (mode 700) |
| Database file | `/var/www/venueatncc.org/data/venue.db` |
| Backups | `/var/www/venueatncc.org/data/backups/venue-YYYYMMDD-HHMMSS.db` |
| Email outbox (while SMTP is unset) | `/var/www/venueatncc.org/data/outbox/` |
| Env file | `/var/www/venueatncc.org/.env` (mode 600, owner `mvandykeanthony`), symlinked as `app/.env` |
| Logs (app) | `/var/www/venueatncc.org/logs/` |
| Empty DocumentRoot (ACME fallback only) | `/var/www/venueatncc.org/public_html/` |
| App listens on | `127.0.0.1:3020` (verify the port is free first; fallbacks 3030, 4010) |
| pm2 process name | `venueatncc` |
| pm2 ecosystem file | `/var/www/venueatncc.org/ecosystem.config.cjs` |
| Node binary | `/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node` (patched, glibc 2.28) |
| Apache vhost files | `/etc/apache2/sites-available/venueatncc.org.conf` (written by hand), `/etc/apache2/sites-available/venueatncc.org-le-ssl.conf` (written by certbot) |
| Apache logs | `/var/log/apache2/venueatncc.org-error.log`, `/var/log/apache2/venueatncc.org-access.log` |
| Certificate name | `venueatncc.org` (new, separate; covers `venueatncc.org` and `www.venueatncc.org`) |
| Health check | `GET /api/health` returns `{"ok":true,"time":"..."}` (503 if the database is unavailable) |
| Git source | `https://github.com/GemsNS/venueatncc.git` (public), branch `main` |

### Changes that touch shared state

**Need Joel's explicit OK before running** (ask, quote the reason, wait for a yes):

| # | Change | Why it is shared | When it is needed |
| --- | --- | --- | --- |
| J1 | Adding two lines to `mvandykeanthony`'s crontab (nightly database backup, weekly log rotation), [section 12](#12-backups) | It is the shared owner account's crontab, which may hold other sites' jobs. The change is additive and the existing crontab is saved first. | Every deploy (backups protect guest inquiries). |
| J2 | `pm2 startup systemd` for `mvandykeanthony`, [section 7.5](#75-reboots-the-known-gap-and-the-optional-fix) | Creates a system service that brings back **all** pm2 apps at boot, not only this one. | Optional, but without it no site comes back after a reboot until someone runs `pm2 resurrect`. |
| J3 | Any `apt install` (for example `build-essential` and a newer Python to compile better-sqlite3), [section 5.4](#54-the-native-add-on-better-sqlite3) | System packages on an EOL OS that every site depends on. | Only if the prebuilt better-sqlite3 binary does not load **and** building elsewhere is not possible. Unlikely to be needed. |
| J4 | Deleting the new certificate (`certbot delete --cert-name venueatncc.org`) during a full rollback | certbot's state is shared with the other three certificates. | Only on a full removal of the site. |
| J5 | `/etc/logrotate.d/` file, GCP firewall rules, installing a database server, enabling Apache modules, `ufw` | System-wide. | **Not needed by this runbook.** Listed so grokbot knows not to do them. |

**Pre-authorized by the server brief's procedure** (no separate OK needed, but announce each one to
Joel when done, and follow the steps exactly):

| Change | Section |
| --- | --- |
| New vhost `venueatncc.org.conf`, `a2ensite`, `apachectl configtest`, graceful `systemctl reload apache2` | [8](#8-apache-vhost) |
| `certbot --apache` for a new, separate certificate `venueatncc.org` (adds `venueatncc.org-le-ssl.conf`, a renewal config, and another graceful reload) | [9](#9-tls-with-certbot) |
| `pm2 start` of the new process `venueatncc`, and `pm2 save` once all three apps are online (rewrites the shared dump file) | [7](#7-pm2) |

**Decisions for the venue owner** (not Joel's server, but blocking for email): the email option in
[section 11](#11-email-the-owners-decision). The site can launch before that decision (option a).

---

## 1. Preflight and before-snapshots

Nothing in this section changes anything. Save everything so [section 13](#13-post-install-verification-checklist)
can diff against it.

```sh
mkdir -p ~/venueatncc-deploy && cd ~/venueatncc-deploy

# Apache: vhost map, enabled sites, and a checksum of every vhost file
sudo apachectl -S > ~/venueatncc-deploy/apache-S-before.txt 2>&1
cp ~/venueatncc-deploy/apache-S-before.txt ~/apache-S-before.txt     # the name the brief uses
ls -la /etc/apache2/sites-enabled/ > ~/venueatncc-deploy/sites-enabled-before.txt
sudo md5sum /etc/apache2/sites-available/*.conf /etc/letsencrypt/options-ssl-apache.conf > ~/venueatncc-deploy/vhost-md5-before.txt
sudo apachectl configtest 2>&1 | tee ~/venueatncc-deploy/configtest-before.txt   # expect: Syntax OK

# pm2 (as the owner, with the documented PATH)
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls' | tee ~/venueatncc-deploy/pm2-before.txt
# expect: ncc-backend (id 0) and vandyke-home-loan (id 1), both online

# Node versions that must not change
sudo -H -u mvandykeanthony bash -c 'cat /home/mvandykeanthony/.nvm/alias/default; /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node -v' | tee ~/venueatncc-deploy/node-before.txt
# expect: 16.20.2 (or v16.20.2) and v24.16.0

# Memory, disk, ports
free -m | tee ~/venueatncc-deploy/free-before.txt
df -h / | tee ~/venueatncc-deploy/df-before.txt
sudo ss -tlnp | tee ~/venueatncc-deploy/ss-before.txt

# Certificates
sudo certbot certificates 2>&1 | tee ~/venueatncc-deploy/certbot-before.txt
sudo ls -la /etc/letsencrypt/renewal/ /etc/letsencrypt/live/ > ~/venueatncc-deploy/letsencrypt-ls-before.txt

# Baseline: every existing URL must return 200
for u in https://pinnaclepublishinggroup.net https://www.pinnaclepublishinggroup.net \
         https://vandykehomeloan.net https://www.vandykehomeloan.net \
         https://vandyke.loans https://www.vandyke.loans \
         https://wearencc.org https://www.wearencc.org \
         https://nccfamily.us https://www.nccfamily.us \
         https://wearencc.org/api/health; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$u")" "$u"
done | tee ~/venueatncc-deploy/baseline-before.txt
curl -s --max-time 5 http://127.0.0.1:4000/api/health; echo
curl -sI --max-time 5 http://127.0.0.1:3010/ | head -1
```

Stop and report to Joel if any baseline URL is not 200 **before** you change anything, so a
pre-existing problem is not blamed on this deploy.

Check that nothing named venueatncc exists yet, and that the port is free:

```sh
test ! -e /var/www/venueatncc.org && echo "OK: /var/www/venueatncc.org does not exist" || echo "STOP: /var/www/venueatncc.org already exists"
ls /etc/apache2/sites-available/ | grep -i venue || echo "OK: no venue vhost yet"
sudo ss -tlnp | grep -E ':3020\b' && echo "STOP: 3020 in use" || echo "OK: 3020 is free"
```

If 3020 is in use, check 3030 and then 4010 the same way and use the first free one **everywhere**
this document says 3020 (the `.env`, the ecosystem file, both vhost files, and the curl checks).

Check DNS (both names must resolve to 34.30.208.144, and there must be **no AAAA record**: Let's
Encrypt prefers IPv6, and an AAAA pointing anywhere else makes validation fail):

```sh
for n in venueatncc.org www.venueatncc.org; do
  echo "$n A:    $(dig +short A $n @8.8.8.8 | tr '\n' ' ')"
  echo "$n AAAA: $(dig +short AAAA $n @8.8.8.8 | tr '\n' ' ')"
done
# If dig is missing: getent ahosts venueatncc.org ; getent ahosts www.venueatncc.org
```

If an AAAA record exists, the venue owner must delete it in GoDaddy DNS before [section 9](#9-tls-with-certbot).

---

## 2. Directory layout and ownership

Everything is created inside `/var/www/venueatncc.org/` only. Nothing else under `/var/www` is
touched, and no `chown`/`chmod` is ever recursive above this directory.

```
/var/www/venueatncc.org/            2775  mvandykeanthony:www-data
├── .env                            600   mvandykeanthony   (secrets; symlinked as app/.env)
├── ecosystem.config.cjs            664   pm2 definition
├── logrotate.conf                  644   user-level rotation of logs/ (section 12)
├── app/                            git checkout: code, node_modules, dist/, server-dist/
├── data/                           700   venue.db (+ -wal, -shm), outbox/, backups/
├── logs/                           750   pm2 out/error logs, backup log
└── public_html/                    2775  empty; DocumentRoot only so ACME has a safe fallback
```

Two deliberate tightenings of the brief's "dirs 775, files 664" rule, both inside the new directory
only (not shared changes):

- `data/` is **700**: it holds guests' names, emails, and phone numbers. vsftpd chroots FTP users
  to `/var/www`, so a group- or world-readable data folder would be visible over FTP. The app also
  creates `data/outbox/` as 700 and its files as 600 (`server/email/mailer.ts:62-68`).
- `logs/` is **750**: logrotate, run as a normal user, refuses to rotate in a directory that is
  writable by a group other than root.

No app code, `.env`, `node_modules`, or data sits under a DocumentRoot that Apache serves files from:
the vhost proxies every path to the app except `/.well-known/acme-challenge/`, which maps to the empty
`public_html/`.

```sh
sudo install -d -o mvandykeanthony -g www-data -m 2775 /var/www/venueatncc.org
sudo install -d -o mvandykeanthony -g www-data -m 2775 /var/www/venueatncc.org/public_html
sudo install -d -o mvandykeanthony -g www-data -m 700  /var/www/venueatncc.org/data
sudo install -d -o mvandykeanthony -g www-data -m 750  /var/www/venueatncc.org/logs
ls -la /var/www/venueatncc.org/
```

The setgid bit (the `2` in 2775) makes new files inherit the `www-data` group, matching the other
site directories.

---

## 3. Getting the code onto the server

The repository is public, so clone it over HTTPS as the owner. Use a full clone (not `--depth 1`):
the sitemap's `lastmod` dates come from git history and are left out in a shallow clone
(`astro.config.mjs:48-56`).

```sh
sudo -H -u mvandykeanthony bash -c 'umask 002; git clone --branch main https://github.com/GemsNS/venueatncc.git /var/www/venueatncc.org/app'
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && git log -1 --oneline && ls src/data/site.ts package-lock.json'
git -C /var/www/venueatncc.org/app rev-parse HEAD | tee ~/venueatncc-deploy/deployed-commit.txt
```

`umask 002` gives the 775/664 modes the brief asks for, while keeping executable bits that
`node_modules` needs (never `chmod -R 664` the app folder: it would break `esbuild` and other binaries).

**Alternative: rsync** (from a machine that has the repository, when cloning is not possible). Upload
to a staging folder grokbot owns, then copy in as the owner:

```sh
# on the source machine
rsync -az --delete --exclude node_modules --exclude dist --exclude dist-demo --exclude server-dist \
  --exclude data --exclude .env --exclude .tmp --exclude .astro \
  ./ grokbot@34.30.208.144:/tmp/venueatncc-src/
# on the server
sudo -H -u mvandykeanthony bash -c 'umask 002; mkdir -p /var/www/venueatncc.org/app && cp -a /tmp/venueatncc-src/. /var/www/venueatncc.org/app/'
rm -rf /tmp/venueatncc-src
```

Do not use FTP: it is plaintext and creates files with mode 600.

---

## 4. Node: the patched v24 binary

- Use **only** `/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node`. It is the official
  Node 24.16.0 binary patched with `patchelf` to load through `/opt/glibc-2.28`. The official Node
  18+ binaries do not run on this OS's glibc 2.27, and v18.20.8 here is broken.
- Put it first on `PATH` in each owner command, exactly as this document does:
  `export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH`. npm's scripts start
  `node` through `PATH` (`#!/usr/bin/env node`), so without this they would find no Node or the
  wrong one.
- **Never** run `nvm alias default`, `nvm use --default`, `nvm install`, or `npm install -g`. Never
  modify `/opt/glibc-2.28` or the v16/v24 trees.
- The app needs Node 22.12 or newer (`README.md`; `process.loadEnvFile` in `server/bootstrap.ts:15`
  and the esbuild target `node22` in `package.json`). v24.16.0 satisfies that, and better-sqlite3
  12.11.1 supports Node 24 (`package-lock.json:3480-3481`).

Quick check:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; which node npm; node -v; npm -v'
# expect: .../v24.16.0/bin/node, .../v24.16.0/bin/npm, v24.16.0, 11.16.0
```

---

## 5. Install and build

There are two ways. **Path A** builds on the server. **Path B** builds on another machine and uploads
the built output, so the server only installs the five runtime packages. Try Path A first; switch
to Path B if memory is short, the build fails on a native module (sharp, resvg), or it is too slow.

### 5.1 Memory check (both paths)

```sh
free -m
```

Continue with Path A only if the `available` column shows **at least 2500 MB**. The site build
converts every venue photo to AVIF and WebP with sharp and can use 1 to 2 GiB and both CPUs for
several minutes. Build one thing at a time; never run two builds at once on this server.

### 5.2 Path A: build on the server

Install everything, including devDependencies (Astro, esbuild, sharp, tsx), which the build needs:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; umask 002; cd /var/www/venueatncc.org/app && npm ci --no-audit --no-fund'
```

Check the native add-on now, before spending time on the build ([5.4](#54-the-native-add-on-better-sqlite3)):

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; cd /var/www/venueatncc.org/app && node -e "const D=require(\"better-sqlite3\");console.log(new D(\":memory:\").prepare(\"select sqlite_version() v\").get())"'
# expect: { v: '3.x.y' }
```

Build at low priority so the other sites keep their CPU, with the Node heap capped:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; umask 002; cd /var/www/venueatncc.org/app && NODE_OPTIONS=--max-old-space-size=1536 nice -n 19 npm run build'
```

`npm run build` runs `astro build` (static site into `dist/`) and then esbuild (the server into
`server-dist/index.mjs`) (`package.json`, scripts `build` and `build:server`).

Then bundle the two command-line tools, exactly as the Dockerfile does (`Dockerfile:562-563`), so
the admin tool and the nightly backup run with plain `node` and never need `tsx` or `npx`:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; umask 002; cd /var/www/venueatncc.org/app && npx esbuild server/cli/create-admin.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/create-admin.mjs && npx esbuild server/cli/backup.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/backup.mjs'
```

Check the output:

```sh
ls -la /var/www/venueatncc.org/app/dist/index.html /var/www/venueatncc.org/app/dist/404.html /var/www/venueatncc.org/app/server-dist/
# expect: index.mjs, create-admin.mjs, backup.mjs
free -m
```

Leave the devDependencies installed. They are needed for every future rebuild on the server, and
removing them (`npm prune --omit=dev`) saves only disk space, of which there is plenty.

### 5.3 Path B: build elsewhere, upload the output

On any machine with Node 22.12+ (Windows, macOS, or Linux; the output is plain HTML, CSS, JS, and
images, and does not depend on the build machine), at the **same commit** as the server checkout:

```sh
git clone https://github.com/GemsNS/venueatncc.git && cd venueatncc && git checkout <COMMIT FROM deployed-commit.txt>
npm ci
npm run build
npx esbuild server/cli/create-admin.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/create-admin.mjs
npx esbuild server/cli/backup.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/backup.mjs
tar czf venueatncc-build.tgz dist server-dist
scp venueatncc-build.tgz grokbot@34.30.208.144:/tmp/
```

On the server, unpack as the owner and install only the runtime dependencies (hono,
@hono/node-server, better-sqlite3, nodemailer, zod):

```sh
chmod 644 /tmp/venueatncc-build.tgz
sudo -H -u mvandykeanthony bash -c 'umask 002; cd /var/www/venueatncc.org/app && rm -rf dist server-dist && tar xzf /tmp/venueatncc-build.tgz'
rm -f /tmp/venueatncc-build.tgz
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; umask 002; cd /var/www/venueatncc.org/app && npm ci --omit=dev --no-audit --no-fund'
```

Then run the better-sqlite3 check from [5.4](#54-the-native-add-on-better-sqlite3). With Path B,
`npm run build` and `npx esbuild` are not available on the server; every update is built the same way.

### 5.4 The native add-on: better-sqlite3

**The check** (one line, run from the app folder with v24 on `PATH`):

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; cd /var/www/venueatncc.org/app && node -e "const D=require(\"better-sqlite3\");console.log(new D(\":memory:\").prepare(\"select sqlite_version() v\").get())"'
```

**Why it should work.** `npm ci` runs better-sqlite3's install script, which first tries
`prebuild-install`: it downloads a prebuilt `better_sqlite3.node` for linux-x64 and the ABI of the
Node that runs npm (Node 24, because v24 is first on `PATH`). The add-on is loaded with `dlopen`
into the patched Node process, which already runs on glibc 2.28 from `/opt/glibc-2.28` and has
already loaded the system `libstdc++`. So the add-on works as long as the glibc and libstdc++
symbol versions it needs are no newer than glibc 2.28 and the GLIBCXX versions of Ubuntu 18.04's
libstdc++.

**If it fails** (`GLIBC_2.29 not found`, `GLIBCXX_3.4.xx not found`, `invalid ELF header`, or
`was compiled against a different Node.js version`), work down this ladder and stop at the first
step that makes the check pass:

1. **See what it needs.** Compare against what the server has:

   ```sh
   cd /var/www/venueatncc.org/app
   objdump -T node_modules/better-sqlite3/build/Release/better_sqlite3.node | grep -o 'GLIBC[X]*_[0-9.]*' | sort -uV
   strings /usr/lib/x86_64-linux-gnu/libstdc++.so.6 | grep -o '^GLIBCXX_[0-9.]*' | sort -uV | tail -3
   ls /opt/glibc-2.28/lib/libc.so.6 && echo "glibc 2.28 is the maximum GLIBC_ version available"
   ```

   Anything above `GLIBC_2.28`, or a `GLIBCXX_` above the highest one listed, is why it fails.
   (`objdump` and `strings` come with binutils; if they are missing, skip to step 3.)

2. **Retry the prebuilt download** in case it was interrupted or fetched for the wrong Node:

   ```sh
   sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; cd /var/www/venueatncc.org/app && npm rebuild better-sqlite3'
   ```

   If `npm rebuild` falls back to compiling and fails with gyp or compiler errors, that is expected
   on this server; go to step 3.

3. **Build the add-on on a compatible machine and upload it (recommended fallback).** A
   RHEL/Rocky/Alma 8 system has glibc 2.28, and its `gcc-toolset` compilers link newer C++ runtime
   parts statically, which is exactly how the official Node 24 binaries are built. With Docker on
   any machine:

   ```sh
   docker run --rm -v "$PWD/out:/out" rockylinux:8 bash -c '
     dnf -y install gcc-toolset-12 python3.11 make tar xz &&
     source /opt/rh/gcc-toolset-12/enable &&
     curl -fsSL https://nodejs.org/dist/v24.16.0/node-v24.16.0-linux-x64.tar.xz | tar xJ -C /opt &&
     export PATH=/opt/node-v24.16.0-linux-x64/bin:$PATH PYTHON=python3.11 &&
     mkdir /b && cd /b && npm init -y >/dev/null &&
     npm install better-sqlite3@12.11.1 --build-from-source &&
     cp node_modules/better-sqlite3/build/Release/better_sqlite3.node /out/'
   scp out/better_sqlite3.node grokbot@34.30.208.144:/tmp/
   ```

   On the server:

   ```sh
   chmod 644 /tmp/better_sqlite3.node
   sudo -H -u mvandykeanthony bash -c 'cp /tmp/better_sqlite3.node /var/www/venueatncc.org/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
   rm -f /tmp/better_sqlite3.node
   ```

   Re-run the check. Keep a copy of this file in `/var/www/venueatncc.org/better_sqlite3.node.keep`
   (as the owner), because every `npm ci` replaces it; copy it back in after each `npm ci` until a
   prebuilt version works.

4. **Compile on the server** (last resort). This needs `gcc`/`g++`/`make` (not surveyed) and a Python
   that current node-gyp accepts (3.6.9 is too old), and Ubuntu 18.04's GCC 7 is likely too old for
   Node 24's C++20 headers. Installing a toolchain is an **apt install: [SHARED, JOEL OK] (J3)**,
   and may still not succeed. Prefer step 3.

### 5.5 Do the admin and backup tools need devDependencies?

No, as long as they are bundled into `server-dist/create-admin.mjs` and `server-dist/backup.mjs`
(the esbuild lines above). The npm script `npm run admin:create` uses `tsx`, a devDependency
(`package.json`, script `admin:create`), and is meant for development machines. On this server, run
the bundled files with the v24 `node` by absolute path, from the app folder (they read `./.env`, so
the working directory matters):

```sh
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node server-dist/create-admin.mjs --help'
```

`server-dist/` is not in git (`.gitignore`), so these two bundles are rebuilt on every deploy, along
with the server.

---

## 6. The .env file

The server reads `./.env` from its **working directory** at startup, and real environment variables
win over it (`server/bootstrap.ts:13-16`, `server/index.ts:26`). The CLI tools read it the same way
(`server/cli/create-admin.ts:100`, `server/cli/backup.ts:22`). pm2 starts the app with
`cwd: /var/www/venueatncc.org/app`, so the file must be reachable as `app/.env`. It lives one level
up (so a re-clone of `app/` cannot delete it) and is symlinked in. `.env` is in `.gitignore`.

Every relative path in the config is resolved against the working directory (`server/config.ts:95,125,135`),
so all paths below are absolute.

### Every variable the server reads

| Variable | Default in code | Production value here | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` (`config.ts:99`) | `production` | Production refuses to start without both secrets (`config.ts:79-91`) and always sets Secure cookies (`config.ts:130`). Also set in the pm2 ecosystem. |
| `HOST` | `0.0.0.0` (`config.ts:123`) | `127.0.0.1` | Never leave the default here: 0.0.0.0 would expose the app on the public IP, bypassing Apache. Also set in the ecosystem. |
| `PORT` | `8787` (`config.ts:122`) | `3020` | Also set in the ecosystem. |
| `PUBLIC_ORIGIN` | `https://venueatncc.org` (`site.url`, `config.ts:101`, `src/data/site.ts:47`) | `https://venueatncc.org` | Used for the same-origin check on every POST/PATCH/DELETE (`middleware.ts:60-86`) and links in emails. Because it is https, the app sends HSTS with `includeSubDomains` (`config.ts:131`, `middleware.ts:43`): once a browser has visited the site, every venueatncc.org subdomain must be served over HTTPS. |
| `TRUST_PROXY` | `false` (`config.ts:129`) | `true` | The client IP becomes the right-most `X-Forwarded-For` entry (`server/context.ts:77-88`). Safe here because the app listens on 127.0.0.1 only and Apache's mod_proxy_http appends the real client address as the last entry, so a visitor cannot spoof it. With `false`, every visitor would share 127.0.0.1 and one person's failed sign-ins would lock everyone out. |
| `SITE_DIR` | `./dist` (`config.ts:125`) | `/var/www/venueatncc.org/app/dist` | The built site the app serves. |
| `DATABASE_PATH` | `./data/venue.db` (`config.ts:95`) | `/var/www/venueatncc.org/data/venue.db` | Its folder is created if missing (`db.ts:238`). WAL mode (`db.ts:240`). |
| `SESSION_SECRET` | none; required in production, at least 32 characters (`config.ts:45,127`) | `openssl rand -hex 32` (64 characters) | Also salts the stored IP hashes used for rate limits (`app.ts:47`, `security.ts:163-166`). Changing it does not sign admins out (sessions are random tokens), but it resets the per-address booking limits. |
| `FORM_TOKEN_SECRET` | none; required in production, at least 32 characters (`config.ts:128`) | `openssl rand -hex 32`, different from the session secret | Signs the booking form's anti-spam token (`security.ts:132-158`). |
| `SMTP_HOST` | unset, which means the outbox (`config.ts:104-114`) | unset at launch (option a) | See [section 11](#11-email-the-owners-decision). |
| `SMTP_PORT` | `587` (`config.ts:109`) | `587` | Only used when `SMTP_HOST` is set. |
| `SMTP_SECURE` | `false` (`config.ts:110`) | `false` for 587, `true` for 465 | |
| `SMTP_USER` | unset | per provider | |
| `SMTP_PASS` | empty when `SMTP_USER` is set (`config.ts:112`) | per provider | Not trimmed, so no trailing spaces. |
| `MAIL_FROM` | `The Venue @ NCC <faith@venueatncc.org>` (`config.ts:133`) | leave unset (default) | Must be an address the SMTP account may send as. |
| `NOTIFY_TO` | `faith@venueatncc.org` (`config.ts:134`) | `faith@venueatncc.org` while on the outbox; **a working mailbox** once SMTP sends | That address has no MX record yet, so real mail to it bounces. |
| `OUTBOX_DIR` | `./data/outbox` (`config.ts:135`) | `/var/www/venueatncc.org/data/outbox` | Created as 700, files 600 (`mailer.ts:62-68`). |
| `OUTBOX_RETENTION_DAYS` | unset or `0`: keep forever (`config.ts:136`) | unset | Set (for example `90`) only once SMTP is sending; checked hourly (`index.ts:68-90`). |
| `ADMIN_EMAIL` | unset (`config.ts:116`) | unset (use the CLI, [section 10](#10-first-admin-and-smoke-test)) | With `ADMIN_PASSWORD`, creates the first admin at startup when none exists (`bootstrap.ts:19-38`). |
| `ADMIN_PASSWORD` | unset (`config.ts:117`) | unset | At least 12 characters (`bootstrap.ts:11`). Logs a warning at every start while still set (`bootstrap.ts:22-24`, `index.ts:64-66`). |
| `ADMIN_NAME` | `Faith VanDyke` (`site.contact.contactName`, `config.ts:139`, `src/data/site.ts:60`) | unset | Only used with the two above. |

Not read by this server: `SITE_DOMAIN` (Docker Compose and Caddy only). `UV_THREADPOOL_SIZE` is read
by Node itself and is set in the pm2 ecosystem, not here. `X-Forwarded-Proto` is not read by the
app at all (see [section 8](#8-apache-vhost)).

### Create it

Secrets are generated on the server and never printed. Run as the owner with `umask 077`, so the
file is created 600:

```sh
sudo -H -u mvandykeanthony bash -c 'umask 077; test -e /var/www/venueatncc.org/.env && { echo "STOP: .env exists"; exit 1; }; cat > /var/www/venueatncc.org/.env <<EOF
# The Venue @ NCC, production on instance-20260502-213133. Mode 600. Never commit or copy elsewhere.
NODE_ENV=production
HOST=127.0.0.1
PORT=3020
PUBLIC_ORIGIN=https://venueatncc.org
TRUST_PROXY=true

SITE_DIR=/var/www/venueatncc.org/app/dist
DATABASE_PATH=/var/www/venueatncc.org/data/venue.db
OUTBOX_DIR=/var/www/venueatncc.org/data/outbox
OUTBOX_RETENTION_DAYS=

SESSION_SECRET=$(openssl rand -hex 32)
FORM_TOKEN_SECRET=$(openssl rand -hex 32)

# Email: unset SMTP_HOST means every email is saved to OUTBOX_DIR (docs/deploy-gcloud-apache.md, section 11).
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
# MAIL_FROM defaults to: The Venue @ NCC <faith@venueatncc.org>
NOTIFY_TO=faith@venueatncc.org

# First admin: created with server-dist/create-admin.mjs instead (section 10). Leave these empty.
ADMIN_EMAIL=
ADMIN_PASSWORD=
EOF'
sudo -H -u mvandykeanthony bash -c 'ln -s /var/www/venueatncc.org/.env /var/www/venueatncc.org/app/.env'
sudo stat -c '%a %U:%G %n' /var/www/venueatncc.org/.env          # expect: 600 mvandykeanthony:www-data
sudo grep -c '^SESSION_SECRET=[0-9a-f]\{64\}$' /var/www/venueatncc.org/.env     # expect: 1
sudo grep -c '^FORM_TOKEN_SECRET=[0-9a-f]\{64\}$' /var/www/venueatncc.org/.env  # expect: 1
```

To edit later: `sudo -u mvandykeanthony nano /var/www/venueatncc.org/.env`, then
`pm2 restart venueatncc` ([section 14](#14-updating-later-and-rollback)). Do not put secrets in the
ecosystem file, the vhost, or anything under `dist/`.

---

## 7. pm2

### 7.1 The ecosystem file

```sh
sudo -H -u mvandykeanthony bash -c 'umask 002; cat > /var/www/venueatncc.org/ecosystem.config.cjs <<"EOF"
// pm2 definition for The Venue @ NCC. Secrets are NOT here: the app reads /var/www/venueatncc.org/app/.env
// (a symlink to /var/www/venueatncc.org/.env) from its working directory at startup.
module.exports = {
  apps: [
    {
      name: "venueatncc",
      cwd: "/var/www/venueatncc.org/app",
      script: "/var/www/venueatncc.org/app/server-dist/index.mjs",
      interpreter: "/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      // Password hashing (scrypt) uses 128 MB per hash, at most two at once, on top of the normal
      // footprint, so leave room for sign-ins without triggering a restart.
      max_memory_restart: "600M",
      // The app waits up to 10 s for in-flight emails before exiting on SIGTERM.
      kill_timeout: 12000,
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "/var/www/venueatncc.org/logs/out.log",
      error_file: "/var/www/venueatncc.org/logs/error.log",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3020",
        UV_THREADPOOL_SIZE: "8",
      },
    },
  ],
};
EOF'
```

Why these values: one instance in fork mode because SQLite is one file and the rate limiters live in
memory (`security.ts:170-172`); `max_memory_restart` above the scrypt peak (`security.ts:50,59`);
`kill_timeout` above the 10 second graceful shutdown (`index.ts:93-103`); `UV_THREADPOOL_SIZE=8`
as in the Dockerfile, so password hashing does not starve file serving. `NODE_ENV`, `HOST`, and
`PORT` are repeated from `.env` so the process is correct even if `.env` is unreadable (environment
variables win over `.env`).

### 7.2 Start it

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 start /var/www/venueatncc.org/ecosystem.config.cjs --only venueatncc && sleep 5 && pm2 ls'
```

### 7.3 Verify

```sh
sudo ss -tlnp | grep -E ':3020\b'                   # expect ONE line: 127.0.0.1:3020 ... node; never 0.0.0.0 or *
curl -s http://127.0.0.1:3020/api/health; echo     # expect {"ok":true,"time":"..."}
curl -sI http://127.0.0.1:3020/ | head -1           # expect HTTP/1.1 200 OK
sudo tail -n 30 /var/www/venueatncc.org/logs/out.log /var/www/venueatncc.org/logs/error.log
```

Expected log lines: `[server] production: listening on http://127.0.0.1:3020 (public origin https://venueatncc.org)`,
`[email] SMTP is not configured. Emails are saved to /var/www/venueatncc.org/data/outbox instead of being sent.`,
and `[admin] No admin exists yet...` (fixed in [section 10](#10-first-admin-and-smoke-test)). If you
see `[site] ... has no built site`, `SITE_DIR` is wrong or the build did not finish.

Check that the process is not restarting: run `pm2 ls` twice, 30 seconds apart; the `↺` (restarts)
count for `venueatncc` must not grow.

### 7.4 Save the process list [SHARED]

Only when `pm2 ls` shows **all three** (`ncc-backend`, `vandyke-home-loan`, `venueatncc`) online:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls; pm2 save'
```

Never `pm2 restart all`, `pm2 delete all`, `pm2 kill`, `pm2 update`, or any command on the other two
processes. Restart this app only by name: `pm2 restart venueatncc`.

### 7.5 Reboots: the known gap and the optional fix

pm2 boot startup is not configured on this server: after a reboot, **no** pm2 app (including the two
existing sites) comes back until someone starts pm2 by hand.

**Manual recovery after a reboot** [SHARED: brings back all saved pm2 apps, as the brief prescribes] (until J2 is approved):

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 resurrect; sleep 5; pm2 ls'
curl -s http://127.0.0.1:3020/api/health; echo
```

`pm2 resurrect` restores the list saved by the last `pm2 save`, which is why 7.4 matters.

**Optional permanent fix: [SHARED, JOEL OK] (J2).** It affects all three apps. Only after Joel says yes:

```sh
sudo env PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/pm2 startup systemd -u mvandykeanthony --hp /home/mvandykeanthony
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls'   # all three online?
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 save'
systemctl status pm2-mvandykeanthony --no-pager | head -5
```

---

## 8. Apache vhost

### 8.1 What the app needs from Apache

- **Host header:** `ProxyPreserveHost On`. The app's same-origin check accepts a request whose
  `Origin` equals `PUBLIC_ORIGIN` or whose host matches the `Host` header (`middleware.ts:60-70`),
  which is how `www.venueatncc.org` works too.
- **Client IP:** nothing extra. mod_proxy_http appends the visitor's address to `X-Forwarded-For`,
  and with `TRUST_PROXY=true` the app takes the right-most entry (`context.ts:77-88`).
- **HTTPS awareness:** the app does **not** read `X-Forwarded-Proto`. Secure cookies come from
  `NODE_ENV=production` / an https `PUBLIC_ORIGIN` (`config.ts:130`), and redirects use relative
  `Location` headers (`static.ts:146-161`). The header is still set (the brief requires it, and it
  is correct for any future code).
- **Request size:** the API takes at most 64 KB (`app.ts:32,64-70`); Apache enforces the same on `/api/`.
- **ACME:** `/.well-known/acme-challenge/` is excluded from the proxy so certbot's challenge files
  are always reachable.
- **`retry=0`:** without it, Apache marks the backend as failed for 60 seconds after any refused
  connection (for example during `pm2 restart venueatncc`) and answers 503 for that whole time.

### 8.2 Write the :80 vhost [SHARED: Apache config]

```sh
sudo test -e /etc/apache2/sites-available/venueatncc.org.conf && echo "STOP: file exists" || sudo tee /etc/apache2/sites-available/venueatncc.org.conf > /dev/null <<'EOF'
# The Venue @ NCC: reverse proxy to the Node app on 127.0.0.1:3020 (pm2 process "venueatncc").
# Runbook: docs/deploy-gcloud-apache.md in the venueatncc repository.
<VirtualHost *:80>
    ServerName venueatncc.org
    ServerAlias www.venueatncc.org

    # Empty folder: nothing is served from disk except ACME challenge files.
    DocumentRoot /var/www/venueatncc.org/public_html

    ProxyRequests Off
    ProxyPreserveHost On
    ProxyPass        /.well-known/acme-challenge/ !
    ProxyPass        / http://127.0.0.1:3020/ retry=0
    ProxyPassReverse / http://127.0.0.1:3020/
    # The scheme the visitor used; certbot copies this into the :443 vhost, where it is https.
    RequestHeader set X-Forwarded-Proto "expr=%{REQUEST_SCHEME}"

    <Location /api/>
        LimitRequestBody 65536
    </Location>

    ErrorLog ${APACHE_LOG_DIR}/venueatncc.org-error.log
    CustomLog ${APACHE_LOG_DIR}/venueatncc.org-access.log combined
</VirtualHost>
EOF
cat /etc/apache2/sites-available/venueatncc.org.conf
```

All modules used (proxy, proxy_http, headers, rewrite, ssl) are already enabled; nothing is enabled
by this runbook.

### 8.3 Enable, test, reload gracefully [SHARED]

```sh
sudo a2ensite venueatncc.org.conf
sudo apachectl configtest           # must say: Syntax OK. If not: sudo a2dissite venueatncc.org.conf, fix, retry.
sudo systemctl reload apache2       # graceful; NEVER systemctl restart apache2
sudo apachectl -S 2>&1 | tee ~/venueatncc-deploy/apache-S-after-80.txt
```

In the `apachectl -S` output, check:

- `*:80` still says `default server pinnaclepublishinggroup.net`, and `*:443` likewise. Apache picks
  the first vhost loaded, in alphabetical order of `sites-enabled`; `pinnaclepublishinggroup.net.conf`
  sorts before `venueatncc.org.conf`, so the default does not change.
- A new line `port 80 namevhost venueatncc.org (/etc/apache2/sites-available/venueatncc.org.conf:3)`
  with `alias www.venueatncc.org`.
- Every other line is identical to `apache-S-before.txt`: `diff ~/venueatncc-deploy/apache-S-before.txt ~/venueatncc-deploy/apache-S-after-80.txt`
  shows only additions.

Check through Apache:

```sh
curl -sI -H 'Host: venueatncc.org' http://127.0.0.1/ | head -1                  # expect 200
curl -s  -H 'Host: venueatncc.org' http://127.0.0.1/api/health; echo            # expect {"ok":true,...}
curl -sI http://venueatncc.org/ | head -1                                        # expect 200 (redirect comes with certbot)
```

Until [section 9](#9-tls-with-certbot) is done, `https://venueatncc.org` reaches the default :443 vhost
(Pinnacle) with a certificate that does not match. Move on to TLS straight away.

---

## 9. TLS with certbot

### 9.1 Before running certbot

Confirm which ACME server the existing setup uses. certbot 0.27 is old; its built-in default may
still be the retired ACME v1 endpoint, so pass the v2 server explicitly:

```sh
sudo grep -h '^server' /etc/letsencrypt/renewal/*.conf | sort | uniq -c
sudo ls /etc/letsencrypt/accounts/
# expect acme-v02.api.letsencrypt.org in both
```

If an account exists under `acme-v02.api.letsencrypt.org`, certbot reuses it silently. If not,
certbot asks for an email and the terms of service; use the email Joel names.

Snapshot the files certbot may touch:

```sh
sudo md5sum /etc/apache2/sites-available/*.conf /etc/letsencrypt/options-ssl-apache.conf > ~/venueatncc-deploy/vhost-md5-before-certbot.txt
sudo ls -la /etc/letsencrypt/renewal/ > ~/venueatncc-deploy/renewal-before-certbot.txt
```

### 9.2 Get the certificate [SHARED: certbot, Apache config]

```sh
sudo certbot --apache \
  --cert-name venueatncc.org \
  -d venueatncc.org -d www.venueatncc.org \
  --redirect \
  --server https://acme-v02.api.letsencrypt.org/directory
```

Rules: exactly these two names; no `--expand`; no other `--cert-name`; never `delete`, `revoke`,
`renew --force-renewal`, or `--reinstall` for any other certificate. If certbot shows a menu of
vhosts or offers to change any file other than `venueatncc.org.conf`, answer **c** (cancel) and see
[section 15](#15-troubleshooting).

### 9.3 Prove certbot touched only the new site

```sh
sudo md5sum /etc/apache2/sites-available/*.conf /etc/letsencrypt/options-ssl-apache.conf > ~/venueatncc-deploy/vhost-md5-after-certbot.txt
diff ~/venueatncc-deploy/vhost-md5-before-certbot.txt ~/venueatncc-deploy/vhost-md5-after-certbot.txt
ls -la /etc/apache2/sites-enabled/
sudo ls -la /etc/letsencrypt/renewal/
```

Expected: the diff shows only `venueatncc.org.conf` changed and `venueatncc.org-le-ssl.conf` added.
`sites-enabled` gained exactly `venueatncc.org.conf` and `venueatncc.org-le-ssl.conf`.
`renewal/` gained exactly `venueatncc.org.conf`. If any other vhost's checksum or
`options-ssl-apache.conf` changed, stop and tell Joel; do not edit them back yourself.

### 9.4 Set the forwarded-proto header literally in the :443 vhost

certbot copied `RequestHeader set X-Forwarded-Proto "expr=%{REQUEST_SCHEME}"`, which already yields
`https` there. Make it the literal value the brief specifies, in the new file only:

```sh
sudo sed -i 's|^\(\s*\)RequestHeader set X-Forwarded-Proto .*|\1RequestHeader set X-Forwarded-Proto "https"|' /etc/apache2/sites-available/venueatncc.org-le-ssl.conf
sudo cat /etc/apache2/sites-available/venueatncc.org-le-ssl.conf
sudo cat /etc/apache2/sites-available/venueatncc.org.conf
```

The :443 file should now read like this (certbot's exact layout may differ slightly; this is also
the content to write by hand if the webroot fallback in [section 15](#15-troubleshooting) is used):

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName venueatncc.org
    ServerAlias www.venueatncc.org

    DocumentRoot /var/www/venueatncc.org/public_html

    ProxyRequests Off
    ProxyPreserveHost On
    ProxyPass        /.well-known/acme-challenge/ !
    ProxyPass        / http://127.0.0.1:3020/ retry=0
    ProxyPassReverse / http://127.0.0.1:3020/
    RequestHeader set X-Forwarded-Proto "https"

    <Location /api/>
        LimitRequestBody 65536
    </Location>

    ErrorLog ${APACHE_LOG_DIR}/venueatncc.org-error.log
    CustomLog ${APACHE_LOG_DIR}/venueatncc.org-access.log combined

    SSLCertificateFile /etc/letsencrypt/live/venueatncc.org/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/venueatncc.org/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
```

And the :80 file gained certbot's redirect:

```apache
    RewriteEngine on
    RewriteCond %{SERVER_NAME} =www.venueatncc.org [OR]
    RewriteCond %{SERVER_NAME} =venueatncc.org
    RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]
```

### 9.5 Test, reload, verify [SHARED]

```sh
sudo apachectl configtest && sudo systemctl reload apache2
curl -sI http://venueatncc.org/ | grep -iE '^(HTTP|location)'          # expect 301, Location: https://venueatncc.org/
curl -sI http://www.venueatncc.org/ | grep -iE '^(HTTP|location)'      # expect 301, Location: https://www.venueatncc.org/
curl -sI https://venueatncc.org/ | grep -iE '^(HTTP|strict-transport)' # expect 200 and Strict-Transport-Security
curl -sI https://www.venueatncc.org/ | head -1                          # expect 200
echo | openssl s_client -connect 34.30.208.144:443 -servername venueatncc.org 2>/dev/null | openssl x509 -noout -subject -enddate -text | grep -E "subject=|notAfter|DNS:"
# expect subject CN venueatncc.org, SAN DNS:venueatncc.org, DNS:www.venueatncc.org
sudo certbot certificates
sudo certbot renew --dry-run      # [SHARED] runs the challenge for all four certificates and reloads Apache gracefully; changes no real certificate
```

If `http://venueatncc.org/` answers 200 instead of 301, the proxy is taking the request before the
redirect. Fix it in the :80 file only: delete its `ProxyPass`, `ProxyPassReverse`, and `RequestHeader`
lines (keep the rewrite lines), then `sudo apachectl configtest && sudo systemctl reload apache2`.

`certbot certificates` must list `venueatncc.org` (both names) and the three existing certificates
with the same names, domains, and expiry dates as in `certbot-before.txt`. `renew --dry-run` must
report success for all four; it does not change real certificates.

Renewal is automatic through the existing `certbot.timer`; nothing to add.

---

## 10. First admin and smoke test

### 10.1 Create the first admin with the CLI

Use the bundled CLI with `--password-stdin` (the tool needs a terminal for its hidden prompt and
throws without one, `create-admin.ts:90-97`). This keeps the password out of `.env` and out of the
logs. Ask Joel (or the venue owner) for the admin's email and name; the defaults below are the venue
contact in `src/data/site.ts:58-60`. Signing in does not need a working mailbox.

```sh
ADMIN_EMAIL=faith@venueatncc.org
ADMIN_NAME='Faith VanDyke'
PW=$(openssl rand -base64 18)
printf '%s' "$PW" | sudo -H -u mvandykeanthony bash -c "cd /var/www/venueatncc.org/app && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node server-dist/create-admin.mjs --email '$ADMIN_EMAIL' --name '$ADMIN_NAME' --password-stdin"
# expect: Created admin faith@venueatncc.org (Faith VanDyke) in /var/www/venueatncc.org/data/venue.db.
```

Hand `$PW` to Joel through a private channel, never in a file, a chat log, or a commit, and ask that
the admin change it at first sign-in (the admin has a Change password screen). Keep `PW` set in this
shell until the admin sign-in test below is done, then `unset PW`.

The same command adds another admin or resets a password (an existing email gets the new password
and is signed out everywhere, `create-admin.ts:123-126`). Passwords need 12 to 500 characters.

**Alternative:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) in `.env` and
`pm2 restart venueatncc`; the admin is created at startup when none exists (`bootstrap.ts:19-38`).
Then remove `ADMIN_PASSWORD` from `.env` and restart again. Not recommended here: the password
sits on disk until removed.

### 10.2 Smoke test: pages, health, redirects

```sh
BASE=https://venueatncc.org
for p in / /the-space/ /pricing/ /faq/ /events/ /events/weddings/ /book/ /admin/ /sitemap-index.xml /robots.txt; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p"
done
curl -s "$BASE/api/health"; echo                                                    # {"ok":true,...}
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/no-such-page/"                      # 404 (the site's own 404 page)
curl -sI "$BASE/about/" | grep -iE '^(HTTP|location)'                               # 301, location: /the-space/
curl -sI "$BASE/events/church-community-events/" | grep -iE '^(HTTP|location)'      # 301, location: /events/community-events/
curl -sI "$BASE/pricing" | grep -iE '^(HTTP|location)'                              # 301, location: /pricing/
curl -sI "$BASE/" | grep -iE '^(content-security-policy|x-frame-options|strict-transport-security)'
```

If a page path in the first loop answers 404, check the real route names with
`ls /var/www/venueatncc.org/app/dist/`; the redirects and the 404 must behave as shown.
The two moved-page redirects are answered by the app itself (`server/static.ts:38-48`), so they
only exist on this server, not in the GitHub Pages demo.

### 10.3 Smoke test: a booking request

This creates one real inquiry (archived again in 10.4). The form token must be at least 3 seconds
old (`security.ts:132`), POSTs need an `Origin` from this site (`middleware.ts:76-86`), the date must
be Monday to Saturday within two years, and the start time 09:00 or later (`schemas.ts:57-101`).

```sh
BASE=https://venueatncc.org
TOKEN=$(curl -s "$BASE/api/form-token" | sed -E 's/.*"token":"([^"]+)".*/\1/')
DATE=$(date -d 'next tuesday + 8 weeks' +%F)
sleep 4
curl -s -X POST "$BASE/api/inquiries" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" -H 'X-Requested-With: fetch' \
  --data "{\"eventType\":\"meetings-trainings\",\"date\":\"$DATE\",\"startTime\":\"10:00\",\"hours\":2,\"space\":\"indoor\",\"guests\":10,\"name\":\"Deploy Test\",\"email\":\"deploy-test@example.com\",\"contactPreference\":\"email\",\"message\":\"Deployment smoke test. Please archive.\",\"formToken\":\"$TOKEN\"}"
echo
# expect: {"ok":true,"reference":"NCC-XXXXX"}  (note the reference)
sudo ls -l /var/www/venueatncc.org/data/outbox/
# expect two .eml + two .html files: ...-NCC-XXXXX-venue-... and ...-NCC-XXXXX-guest-..., mode -rw-------
```

Each visitor address may send 5 requests an hour (`public.ts:21`); do not loop this test.

### 10.4 Smoke test: admin sign-in, see the inquiry, archive it

```sh
BASE=https://venueatncc.org
JAR=$(mktemp)
printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$PW" | curl -s -i -c "$JAR" -X POST "$BASE/api/admin/login" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" -H 'X-Requested-With: fetch' --data @- | grep -iE '^(HTTP|set-cookie)'
# expect HTTP 200 and: set-cookie: __Host-ncc_session=...; Max-Age=1209600; Path=/; HttpOnly; Secure; SameSite=Lax
curl -s -b "$JAR" "$BASE/api/admin/inquiries?q=<NCC-XXXXX>"; echo
# expect the test inquiry; note its numeric "id"
curl -s -b "$JAR" -X PATCH "$BASE/api/admin/inquiries/<ID>" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" -H 'X-Requested-With: fetch' --data '{"status":"archived"}'; echo
curl -s -b "$JAR" -X POST "$BASE/api/admin/logout" -H "Origin: $BASE" -H 'X-Requested-With: fetch' -o /dev/null -w '%{http_code}\n'
rm -f "$JAR"; unset PW
```

The `__Host-` cookie with `Secure` proves the app knows it is behind HTTPS (`routes/admin.ts:19-20,104-111`).
Sessions last 14 days and end after 12 hours idle (`routes/admin.ts:21-23`).

A person should also do the same once in a real browser: open https://venueatncc.org/book/, send a
request, then sign in at https://venueatncc.org/admin/ and find it.

---

## 11. Email: the owner's decision

Every booking request sends two emails: a notification to `NOTIFY_TO` (Reply-To set to the guest)
and a confirmation to the guest. Requests are **always saved to the database first**; an email
problem never loses one, and each send attempt is recorded on the request's timeline in the admin.

Today `venueatncc.org` has no MX records, so `faith@venueatncc.org` cannot
receive mail. Outbound SMTP on ports 587 and 465 works from Google Cloud (only port 25 is blocked),
so options b and c need no firewall change.

All DNS for `venueatncc.org` is managed by the **venue owner** at GoDaddy (My Products,
venueatncc.org, DNS). Keep exactly **one** SPF (`v=spf1 ...`) TXT record on `@`; merge includes into it.

### Option a: launch with SMTP unset (no decision or DNS needed; the default above)

- Every email is written to `/var/www/venueatncc.org/data/outbox/` as an `.eml` (the full message)
  and an `.html` (its body), files mode 600 (`server/email/mailer.ts:57-70`). Nothing is sent, so
  guests get **no** confirmation email; the booking page still shows them their reference number.
- **Staff see every new inquiry in the admin anyway:** https://venueatncc.org/admin/, the inquiry
  list, newest first, with status, details, notes, and the email timeline (which says "saved to the
  outbox"). Staff should check it daily and contact guests by phone or from their own email.
- To read or copy the outbox files on the server:

  ```sh
  sudo ls -lt /var/www/venueatncc.org/data/outbox/ | head
  sudo cat /var/www/venueatncc.org/data/outbox/<FILE>.html
  ```

- Leave `OUTBOX_RETENTION_DAYS` unset while on this option (the files are the only copy of the
  rendered emails).

### Option b: a transactional SMTP relay (owner decision + DNS changes)

A sending service such as Postmark, Amazon SES, Brevo, or Mailgun. Sending only: it does **not** make
`faith@venueatncc.org` receive mail, so `NOTIFY_TO` must be a mailbox that works today (for example
the owner's existing address), and guests' replies go there too.

1. **Owner:** create the account, add `venueatncc.org` as a sending domain.
2. **Owner, GoDaddy DNS:** add the records the provider shows. Typical shapes (use the provider's
   exact values; selectors and tokens are generated per account):

   | Type | Name | Value | Purpose |
   | --- | --- | --- | --- |
   | TXT | `@` | `v=spf1 include:amazonses.com ~all` (SES), `v=spf1 include:spf.brevo.com ~all` (Brevo), `v=spf1 include:mailgun.org ~all` (Mailgun) | SPF. Postmark needs no SPF on `@`; it uses a Return-Path CNAME instead (below). |
   | CNAME (x3) | `<token>._domainkey` | `<token>.dkim.amazonses.com` | DKIM for SES |
   | TXT | `<selector>pm._domainkey` | `k=rsa; p=<key from Postmark>` | DKIM for Postmark |
   | CNAME | `pm-bounces` | `pm.mtasv.net` | Postmark Return-Path (SPF alignment) |
   | TXT | `mail._domainkey` / `<selector>._domainkey` | key from Brevo or Mailgun | DKIM for Brevo or Mailgun |
   | TXT | `_dmarc` | `v=DMARC1; p=none` (add `; rua=mailto:<working address>` if reports are wanted) | DMARC |

3. **Owner:** wait until the provider shows the domain as verified.
4. **grokbot:** edit `.env` (`sudo -u mvandykeanthony nano /var/www/venueatncc.org/.env`):

   ```ini
   SMTP_HOST=<provider SMTP host, e.g. smtp.postmarkapp.com, email-smtp.us-east-1.amazonaws.com, smtp-relay.brevo.com, smtp.mailgun.org>
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=<provider SMTP username or token>
   SMTP_PASS=<provider SMTP password or token>
   NOTIFY_TO=<a mailbox that receives mail today>
   OUTBOX_RETENTION_DAYS=90
   ```

   `MAIL_FROM` stays at its default (`The Venue @ NCC <faith@venueatncc.org>`) if the provider allows
   any address on the verified domain; otherwise set it to the address the provider allows.
5. `pm2 restart venueatncc`, check the log says `[email] Sending through <host>:587 as ...`, and send
   one test request (10.3) with **your own** email address instead of `example.com`.

### Option c: mailbox hosting for faith@venueatncc.org (owner decision + DNS changes)

A real mailbox (Google Workspace, Microsoft 365, or Zoho Mail; GoDaddy resells the first two).
Receiving works, and the same account can usually send through its SMTP server.

1. **Owner:** buy the mailbox for `faith@venueatncc.org` and verify the domain (a TXT record the
   provider gives).
2. **Owner, GoDaddy DNS:** remove any existing MX records, then add:

   | Provider | MX records (priority, host) | SPF TXT on `@` |
   | --- | --- | --- |
   | Google Workspace | `1 smtp.google.com` | `v=spf1 include:_spf.google.com ~all` |
   | Microsoft 365 | `0 venueatncc-org.mail.protection.outlook.com` (confirm the exact host in the Microsoft 365 admin center) | `v=spf1 include:spf.protection.outlook.com -all` |
   | Zoho Mail | `10 mx.zoho.com`, `20 mx2.zoho.com`, `50 mx3.zoho.com` | `v=spf1 include:zohomail.com ~all` |

   Plus the provider's DKIM record (`google._domainkey` TXT for Google; `selector1._domainkey` and
   `selector2._domainkey` CNAMEs for Microsoft; `zmail._domainkey` TXT for Zoho) and a DMARC record
   `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:faith@venueatncc.org`.
3. **Check:** `dig +short MX venueatncc.org @8.8.8.8` shows the new MX; send a test message to
   `faith@venueatncc.org` from another account.
4. **grokbot:** set SMTP in `.env` with the mailbox's own sign-in (Microsoft 365: `smtp.office365.com`
   587 `false`, SMTP AUTH enabled for the mailbox; Google: `smtp.gmail.com` 587 `false` with an app
   password; Zoho: `smtp.zoho.com` 465 `true`), keep `NOTIFY_TO=faith@venueatncc.org`, set
   `OUTBOX_RETENTION_DAYS=90`, `pm2 restart venueatncc`, and test as in option b.

Options b and c combine well (mailbox for people, relay for automated mail); then the single SPF
record includes both, for example `v=spf1 include:_spf.google.com include:amazonses.com ~all`.

None of the email options touches the server's shared state.

---

## 12. Backups

The database file is everything that matters (inquiries, admins, calendar blocks). The bundled
backup tool takes a consistent online copy with SQLite's backup API while the server runs, WAL
included (`server/cli/backup.ts`). It writes `data/backups/venue-YYYYMMDD-HHMMSS.db` next to the
database and keeps the newest N (default 14, `backup.ts:26`). It fails with "No database" before
the app has first started (`backup.ts:24`).

Run it once by hand:

```sh
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node server-dist/backup.mjs --keep 30'
sudo ls -l /var/www/venueatncc.org/data/backups/
```

### 12.1 Log rotation config (inside the site folder; not a shared change)

pm2-logrotate is not installed and installing pm2 modules is not allowed, so rotate `logs/` with
the system `logrotate` binary run as the owner, with its own config and state file:

```sh
sudo -H -u mvandykeanthony bash -c 'umask 022; cat > /var/www/venueatncc.org/logrotate.conf <<"EOF"
/var/www/venueatncc.org/logs/*.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF'
sudo -H -u mvandykeanthony bash -c '/usr/sbin/logrotate -d -s /var/www/venueatncc.org/logs/.logrotate-state /var/www/venueatncc.org/logrotate.conf' 2>&1 | tail -5
# -d is a dry run; expect no "error:" lines
```

### 12.2 The crontab entries [SHARED, JOEL OK] (J1)

Only after Joel approves. Save the current crontab first, then **append** (never replace). Cron runs
in the server's time zone, America/New_York.

```sh
sudo crontab -u mvandykeanthony -l > ~/venueatncc-deploy/crontab-mvandykeanthony-before.txt 2>&1; cat ~/venueatncc-deploy/crontab-mvandykeanthony-before.txt
( sudo crontab -u mvandykeanthony -l 2>/dev/null
  echo '# venueatncc: nightly SQLite backup, keeps 30 (docs/deploy-gcloud-apache.md section 12)'
  echo '15 3 * * * cd /var/www/venueatncc.org/app && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node server-dist/backup.mjs --keep 30 >> /var/www/venueatncc.org/logs/backup.log 2>&1'
  echo '# venueatncc: weekly rotation of /var/www/venueatncc.org/logs'
  echo '30 3 * * 0 /usr/sbin/logrotate -s /var/www/venueatncc.org/logs/.logrotate-state /var/www/venueatncc.org/logrotate.conf'
) | sudo crontab -u mvandykeanthony -
sudo crontab -u mvandykeanthony -l
diff ~/venueatncc-deploy/crontab-mvandykeanthony-before.txt <(sudo crontab -u mvandykeanthony -l)   # only the 4 new lines
```

(If the "before" file says `no crontab for mvandykeanthony`, the diff also shows that line removed;
that is expected.)

Check the next morning: `sudo tail /var/www/venueatncc.org/logs/backup.log` shows
`Backed up /var/www/venueatncc.org/data/venue.db to .../venue-YYYYMMDD-HHMMSS.db`.

**Off-server copies** are the owner's decision (where to keep them). Backups on the same disk do not
survive the loss of the VM. The simplest option is a periodic pull from another machine:
`scp grokbot@34.30.208.144:...` after grokbot copies the newest file somewhere readable, or a GCP disk
snapshot schedule (a GCP change, needs Joel).

### 12.3 Check a backup

```sh
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && F=$(ls -1 /var/www/venueatncc.org/data/backups/venue-*.db | tail -1) && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node -e "const D=require(\"better-sqlite3\");const db=new D(process.argv[1],{readonly:true});console.log(process.argv[1],db.pragma(\"integrity_check\",{simple:true}),\"schema\",db.pragma(\"user_version\",{simple:true}),\"inquiries\",db.prepare(\"select count(*) n from inquiries\").get().n)" "$F"'
# expect: <file> ok schema 4 inquiries <n>
```

### 12.4 Restore

```sh
# 1. Stop only this app
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 stop venueatncc'
# 2. Keep the current database aside, then put the backup in place
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/data && S=$(date +%Y%m%d-%H%M%S) && mkdir -p pre-restore-$S && cp -a venue.db* pre-restore-$S/ && cp backups/<venue-YYYYMMDD-HHMMSS.db> venue.db && rm -f venue.db-wal venue.db-shm'
# 3. Start it again and check
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 start venueatncc && sleep 5 && pm2 ls'
curl -s http://127.0.0.1:3020/api/health; echo
```

If the backup is from an older schema, the server migrates it on start (`db.ts:205-235`). A backup
from a **newer** schema than the running code is refused ("Database schema version N is newer than
this server"); deploy the matching code first.

---

## 13. Post-install verification checklist

Run everything; every line must match. Then report the results to Joel.

```sh
cd ~/venueatncc-deploy

# 1. Listening on loopback only
sudo ss -tlnp | grep -E ':3020\b'                     # exactly 127.0.0.1:3020, node

# 2. App directly
curl -sI http://127.0.0.1:3020/ | head -1             # HTTP/1.1 200 OK
curl -s http://127.0.0.1:3020/api/health; echo        # {"ok":true,...}

# 3. Public: https 200 with a valid cert; http 301 to https
for u in https://venueatncc.org/ https://www.venueatncc.org/; do curl -s -o /dev/null -w "%{http_code} %{ssl_verify_result} $u\n" "$u"; done   # 200 0
for u in http://venueatncc.org/ http://www.venueatncc.org/; do curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$u"; done            # 301 https://...

# 4. Certificates: the new one plus the three existing, unchanged
sudo certbot certificates 2>&1 | tee certbot-after.txt
diff <(grep -E 'Certificate Name|Domains|Expiry Date' certbot-before.txt | sed 's/(VALID.*//') \
     <(grep -E 'Certificate Name|Domains|Expiry Date' certbot-after.txt  | sed 's/(VALID.*//')   # only venueatncc.org lines added

# 5. .env
sudo stat -c '%a %U %n' /var/www/venueatncc.org/.env  # 600 mvandykeanthony

# 6. Apache
sudo apachectl configtest                              # Syntax OK
sudo apachectl -S > apache-S-after.txt 2>&1
diff apache-S-before.txt apache-S-after.txt            # only added venueatncc.org lines (80 and 443); default server still pinnaclepublishinggroup.net
ls -la /etc/apache2/sites-enabled/ > sites-enabled-after.txt
diff <(awk '{print $9,$10,$11}' sites-enabled-before.txt) <(awk '{print $9,$10,$11}' sites-enabled-after.txt)   # only venueatncc.org.conf and venueatncc.org-le-ssl.conf added
sudo md5sum /etc/apache2/sites-available/*.conf /etc/letsencrypt/options-ssl-apache.conf > vhost-md5-after.txt
diff vhost-md5-before.txt vhost-md5-after.txt          # only the two venueatncc.org files

# 7. Existing sites
for u in https://pinnaclepublishinggroup.net https://www.pinnaclepublishinggroup.net \
         https://vandykehomeloan.net https://www.vandykehomeloan.net \
         https://vandyke.loans https://www.vandyke.loans \
         https://wearencc.org https://www.wearencc.org \
         https://nccfamily.us https://www.nccfamily.us \
         https://wearencc.org/api/health; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$u")" "$u"
done | tee baseline-after.txt
diff baseline-before.txt baseline-after.txt            # no output: all still 200
curl -s http://127.0.0.1:4000/api/health; echo         # JSON
curl -sI http://127.0.0.1:3010/ | head -1              # 200

# 8. pm2: three apps online, no restart loops (run twice, 30 s apart; restart counts must not grow)
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls' | tee pm2-after.txt
# ncc-backend (0), vandyke-home-loan (1), venueatncc: all "online". Compare ids, names, and restart counts of 0 and 1 with pm2-before.txt.
# Then (only now): pm2 save, as in section 7.4, if not done yet.

# 9. Node untouched
sudo -H -u mvandykeanthony bash -c 'cat /home/mvandykeanthony/.nvm/alias/default; /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node -v' | tee node-after.txt
diff node-before.txt node-after.txt                    # no output

# 10. Resources after warm-up (wait a few minutes after the smoke tests)
free -m                                                 # available above 1500 MB
df -h /

# 11. App behaviour (from section 10)
curl -sI https://venueatncc.org/about/ | grep -i '^location'                         # /the-space/
curl -sI https://venueatncc.org/events/church-community-events/ | grep -i '^location' # /events/community-events/
sudo -H -u mvandykeanthony bash -c 'ls -la /var/www/venueatncc.org/data /var/www/venueatncc.org/data/backups'
```

Also confirm: the first admin exists and signed in (10.4), the test inquiry is archived, a backup
file exists, the crontab has the two venueatncc jobs (if J1 was approved), and `pm2 save` ran after
all three apps were online.

---

## 14. Updating later, and rollback

### 14.1 Update (new site only)

```sh
# 0. Record what is running now, and check memory
git -C /var/www/venueatncc.org/app rev-parse HEAD | tee ~/venueatncc-deploy/previous-commit.txt
free -m

# 1. Back up the database (a new version can run a migration that rebuilds tables)
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node server-dist/backup.mjs --keep 30'

# 2. Pull the new code
sudo -H -u mvandykeanthony bash -c 'umask 002; cd /var/www/venueatncc.org/app && git fetch origin && git checkout main && git pull --ff-only origin main && git log -1 --oneline'

# 3. Install and build (Path A). The site is built into .tmp/dist-next so the live dist/ keeps serving until the swap.
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; umask 002; cd /var/www/venueatncc.org/app && npm ci --no-audit --no-fund && node -e "require(\"better-sqlite3\")" && NODE_OPTIONS=--max-old-space-size=1536 nice -n 19 npx astro build --outDir .tmp/dist-next && npm run build:server && npx esbuild server/cli/create-admin.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/create-admin.mjs && npx esbuild server/cli/backup.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/backup.mjs'

# 4. Swap the site in and restart this app only (migrations run automatically at start, db.ts:244)
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && test -f .tmp/dist-next/index.html && rm -rf .tmp/dist-prev && mv dist .tmp/dist-prev && mv .tmp/dist-next dist'
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && sleep 5 && pm2 ls'

# 5. Check
curl -s http://127.0.0.1:3020/api/health; echo
curl -s -o /dev/null -w '%{http_code}\n' https://venueatncc.org/
sudo tail -n 20 /var/www/venueatncc.org/logs/error.log
```

If better-sqlite3 needed the uploaded binary from 5.4 step 3, copy it back in after `npm ci` (before
the `node -e` check). With Path B, build on the other machine as in 5.3 and upload; then
`npm ci --omit=dev`, swap, restart. Changing only `.env`: edit it, then `pm2 restart venueatncc`.

### 14.2 Roll back the code (new site only)

```sh
sudo -H -u mvandykeanthony bash -c "umask 002; cd /var/www/venueatncc.org/app && git checkout $(cat ~/venueatncc-deploy/previous-commit.txt)"
# then repeat step 3 (build) and step 4 (swap and restart) of 14.1
```

If the new version ran a migration, the older code refuses the database ("schema version N is newer
than this server"). Then also restore the backup from step 1 ([12.4](#124-restore)).

The quick undo for a bad site build alone, without rebuilding: swap `.tmp/dist-prev` back into
`dist` and `pm2 restart venueatncc`.

### 14.3 Remove the site entirely (new site only)

```sh
# pm2: delete only venueatncc, then save once the other two are confirmed online [SHARED]
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 delete venueatncc && pm2 ls'
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 save'
# Apache: disable only the new vhosts, then a graceful reload [SHARED]
sudo a2dissite venueatncc.org.conf venueatncc.org-le-ssl.conf && sudo apachectl configtest && sudo systemctl reload apache2
sudo apachectl -S
# crontab: remove the venueatncc lines only (restores the saved copy if nothing else changed since) [SHARED]
sudo crontab -u mvandykeanthony -l | grep -v -e 'venueatncc' | sudo crontab -u mvandykeanthony -
# certificate: [SHARED, JOEL OK] (J4) only if asked
# sudo certbot delete --cert-name venueatncc.org
```

Keep `/var/www/venueatncc.org/data/` (guest data) until the owner decides what to do with it.

---

## 15. Troubleshooting

**`GLIBC_2.28 not found`, `GLIBC_2.29 not found`, or `node: command not found`.** The wrong Node
ran. Every owner command must start with
`export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH`, and pm2's `interpreter`
must be the absolute v24 path. Check with `which node; node -v` inside the same `bash -c`. Do not
"fix" this with `nvm use`, `nvm alias`, or by touching `/opt/glibc-2.28`. If the v24 binary itself
fails, run `patchelf --print-interpreter --print-rpath /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node`
(expect `/opt/glibc-2.28/lib/ld-linux-x86-64.so.2` and the RUNPATH from the brief) and tell Joel;
do not re-patch it yourself.

**better-sqlite3 will not load** (`Error loading shared library`, `GLIBCXX_3.4.xx not found`,
`NODE_MODULE_VERSION` mismatch, `Could not locate the bindings file`). Work down the ladder in
[5.4](#54-the-native-add-on-better-sqlite3). A `NODE_MODULE_VERSION` mismatch means npm ran under a
different Node; re-run `npm ci` with the v24 `PATH`.

**sharp or the Astro build fails on the server** (`Could not load the "sharp" module`, `GLIBC`
errors from `@img/sharp-linux-x64` or `@resvg/resvg-js`, or the build is killed for memory). Use
Path B ([5.3](#53-path-b-build-elsewhere-upload-the-output)); the runtime does not need sharp.

**Apache answers 502 or 503.** The app is not listening. `pm2 ls` (is `venueatncc` online or
looping?), `sudo tail -n 50 /var/www/venueatncc.org/logs/error.log`, `sudo ss -tlnp | grep 3020`,
`curl -s http://127.0.0.1:3020/api/health`. Common causes in the log:
`SESSION_SECRET is required when NODE_ENV=production` or `must be at least 32 characters`
(`.env` missing, not readable by the owner, or the symlink `app/.env` is broken: `ls -l /var/www/venueatncc.org/app/.env`);
`EADDRINUSE` (port taken: see below); `Database schema version N is newer than this server`
(see [14.2](#142-roll-back-the-code-new-site-only)). Also see `sudo tail /var/log/apache2/venueatncc.org-error.log`.
A 503 lasting about a minute after a restart means `retry=0` is missing from a `ProxyPass` line.

**pm2 shows `errored` or a growing restart count.** `sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 logs venueatncc --lines 50 --nostream'`.
If the restarts line up with sign-ins, raise `max_memory_restart` in the ecosystem file, then
`pm2 delete venueatncc && pm2 start /var/www/venueatncc.org/ecosystem.config.cjs --only venueatncc`
(ecosystem changes need a fresh start of this app; never `restart all`), and `pm2 save` once all
three are online.

**Port in use** (`EADDRINUSE 127.0.0.1:3020`). `sudo ss -tlnp | grep -E ':3020\b'` names the process.
If it is not a stale `venueatncc`, choose 3030 or 4010 and change it in `.env`, the ecosystem file,
and both vhost files (`ProxyPass` and `ProxyPassReverse`), then restart this app, `configtest`, and
reload Apache.

**certbot picks the wrong vhost, shows a menu, or fails validation.**
- It must find exactly one :80 vhost whose `ServerName`/`ServerAlias` are the two names; check
  `sudo apachectl -S | grep -i venue`. If it lists choices, cancel (`c`), never pick another site's
  file.
- `Timeout during connect` or `unauthorized`: DNS (A and AAAA, [section 1](#1-preflight-and-before-snapshots)),
  or the challenge path is proxied to the app. Check
  `echo ok | sudo -u mvandykeanthony tee /var/www/venueatncc.org/public_html/.well-known/acme-challenge/t` (create the folder first with
  `sudo -u mvandykeanthony mkdir -p /var/www/venueatncc.org/public_html/.well-known/acme-challenge`), then
  `curl -s http://venueatncc.org/.well-known/acme-challenge/t` must print `ok`; delete the file after.
- **Webroot fallback** (still within the new site only): get the certificate without the Apache
  plugin, then write `venueatncc.org-le-ssl.conf` by hand with the content in [9.4](#94-set-the-forwarded-proto-header-literally-in-the-443-vhost):

  ```sh
  sudo certbot certonly --webroot -w /var/www/venueatncc.org/public_html --cert-name venueatncc.org -d venueatncc.org -d www.venueatncc.org --server https://acme-v02.api.letsencrypt.org/directory
  sudo nano /etc/apache2/sites-available/venueatncc.org-le-ssl.conf     # paste the 9.4 content
  sudo a2ensite venueatncc.org-le-ssl.conf && sudo apachectl configtest && sudo systemctl reload apache2
  ```

  Then add the redirect lines from 9.4 to `venueatncc.org.conf` (and remove its ProxyPass lines),
  configtest, reload. Renewals then use the webroot method automatically
  (`/etc/letsencrypt/renewal/venueatncc.org.conf`); confirm with `sudo certbot renew --dry-run`.
- `The requested apache plugin does not appear to be installed`: stop; that is a shared certbot
  problem for Joel.

**Wrong client IP** (everyone gets "Too many sign-in attempts" together, or the admin session list
shows 127.0.0.1). `TRUST_PROXY` is not `true`, or the app was not restarted after changing `.env`.
`sudo grep TRUST_PROXY /var/www/venueatncc.org/.env`, then `pm2 restart venueatncc`. Never set
`TRUST_PROXY=true` if the app listens on anything but 127.0.0.1.

**Admin cookie not set, or sign-in "works" but the next page says Sign in to continue.**
- The cookie is `__Host-ncc_session` with `Secure`, so it only works over https. Sign in at
  `https://...`, not `http://`.
- `NODE_ENV` must be `production` or `PUBLIC_ORIGIN` must start with `https://` (`config.ts:130`);
  check both in `.env` and the ecosystem. `X-Forwarded-Proto` has no effect on this.
- Admin sessions are per host name: signing in on `www.venueatncc.org` does not sign you in on
  `venueatncc.org`.

**"This request was blocked because it did not come from this website."** The browser's origin does
not match `PUBLIC_ORIGIN` and the `Host` header did not match either. Check `ProxyPreserveHost On` in
both vhost files and `PUBLIC_ORIGIN=https://venueatncc.org` in `.env`. For curl tests, send
`-H "Origin: https://venueatncc.org"`. Admin writes also need `-H 'X-Requested-With: fetch'`.

**Booking request returns "Wait a few seconds, then send your request again."** The form token is
less than 3 seconds old (`security.ts:132`); wait and retry. "This form has expired" means it is
older than 24 hours, or `FORM_TOKEN_SECRET` changed since it was issued; fetch a new token.

**`http://` does not redirect to `https://`.** See the end of [9.5](#95-test-reload-verify).

**Other sites broke after a reload.** `sudo apachectl configtest`; `sudo a2dissite venueatncc.org.conf venueatncc.org-le-ssl.conf && sudo systemctl reload apache2`;
re-run the baseline loop; tell Joel. Never restart Apache and never edit the other vhosts.
