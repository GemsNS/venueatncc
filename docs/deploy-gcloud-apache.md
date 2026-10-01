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
- **`pm2` anywhere in this document means exactly that wrapper**, for example
  `sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && pm2 ls'`.
  Never run `sudo pm2`, `npx pm2`, or pm2 as grokbot's own account: that starts a **second pm2
  daemon** under root's or grokbot's `~/.pm2`, whose copy of `venueatncc` collides on port 3020 and
  is invisible to the owner's `pm2 ls` and `pm2 save`. Never run `pm2 update`, `pm2 kill`,
  `pm2 restart all`, or `pm2 delete all` on this server, even if pm2 prints a prompt suggesting it.
- grokbot connects as its own SSH account, written `<SSH_USER>` in `scp`/`rsync` targets. The
  server brief lists only the unix users `mvandykeanthony`, `box`, and `joel`, so confirm the
  account name first ([section 1](#1-preflight-and-before-snapshots)). It must **not** be
  `mvandykeanthony`; never upload into another user's home.
- **[SHARED]** marks a command that touches state other sites share (Apache, certbot, pm2's process
  list, the owner's crontab). **[SHARED, JOEL OK]** marks one that must not run until Joel has said
  yes, in writing, for that specific change.
- Snapshots and notes go in `~/venueatncc-deploy/` (mode 700) in the SSH account's home directory.

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
- [11. Email](#11-email)
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
| Git source | `https://github.com/GemsNS/venueatncc.git` (public), checked out at `<APPROVED_COMMIT>` (a commit or tag the lead has reviewed), never the moving tip of `main` |
| npm cache | `/var/www/venueatncc.org/.npm-cache` (every `npm ci` passes `--cache`, so nothing is written to the owner's shared `~/.npm`) |
| Native add-on build | `/var/www/venueatncc.org/better_sqlite3.node.keep` (built off-server, [5.4](#54-the-native-add-on-better-sqlite3)), copied into `node_modules` after every `npm ci` |

### Changes that touch shared state

**Decided on 2026-09-30** (part of this deploy; grokbot runs them as written and reports each one to
Joel when done):

| # | Change | Why it is shared | Section |
| --- | --- | --- | --- |
| J1 | Nightly database backups: two lines added to `mvandykeanthony`'s crontab (nightly backup, weekly log rotation). Backups are kept **on the server**, in `/var/www/venueatncc.org/data/backups/`. | It is the shared owner account's crontab, which may hold other sites' jobs. The change is additive and the existing crontab is saved first. | [12.2](#122-the-crontab-entries-shared-j1) |
| J2 | `pm2 startup systemd` for `mvandykeanthony`, so pm2 starts when the server reboots | Creates a system service that brings back **all** pm2 apps at boot (the two existing sites as well as this one). | [7.5](#75-start-on-reboot-shared-j2) |
| | The TLS certificate for `venueatncc.org` and `www.venueatncc.org` | It does not exist yet; issuing it with certbot is part of grokbot's job. | [9](#9-tls-with-certbot) |

The site is permanent: there is no site-removal procedure, and the new certificate is never deleted.

**Need Joel's explicit OK before running** (ask, quote the reason, wait for a yes):

| # | Change | Why it is shared | When it is needed |
| --- | --- | --- | --- |
| J3 | Any `apt install` (for example `build-essential` and a newer Python to compile better-sqlite3), [section 5.4](#54-the-native-add-on-better-sqlite3) | System packages on an EOL OS that every site depends on. | **Not needed** when the off-server better-sqlite3 build ("Required before the deploy" below) is done. Only if that build cannot be made anywhere. |
| J5 | `/etc/logrotate.d/` file, GCP firewall rules, installing a database server, enabling Apache modules, `ufw` | System-wide. | **Not needed by this runbook.** Listed so grokbot knows not to do them. |

**Pre-authorized by the server brief's procedure** (no separate OK needed, but announce each one to
Joel when done, and follow the steps exactly):

| Change | Section |
| --- | --- |
| New vhost `venueatncc.org.conf`, `a2ensite`, `apachectl configtest`, graceful `systemctl reload apache2` | [8](#8-apache-vhost) |
| `certbot --apache` for a new, separate certificate `venueatncc.org` (adds `venueatncc.org-le-ssl.conf`, a renewal config, and another graceful reload) | [9](#9-tls-with-certbot) |
| `pm2 start` of the new process `venueatncc`, and `pm2 save` once all three apps are online (rewrites the shared dump file) | [7](#7-pm2) |

**Required before the deploy, off the server** (not a shared change, but nothing works without it):

| Item | Why | Section |
| --- | --- | --- |
| Build `better_sqlite3.node` for Node 24 on a glibc 2.28 system (Rocky 8 in Docker) and upload it | The official prebuilt that `npm ci` downloads needs `GLIBC_2.29` (libm `log`, `pow`, `log2`, `exp`), newer than the glibc 2.28 the patched Node runs on, so it cannot load here. Without the rebuilt file the app cannot open its database or start. | [5.4](#54-the-native-add-on-better-sqlite3) |
| Pick the commit to deploy: one the lead has reviewed (`<APPROVED_COMMIT>`) | Project policy: nothing goes live until the lead has reviewed it. The runbook never deploys "whatever is on `main`". | [3](#3-getting-the-code-onto-the-server) |

**Email** is set up as described in [section 11](#11-email).

---

## 1. Preflight and before-snapshots

Nothing in this section changes anything. Save everything so [section 13](#13-post-install-verification-checklist)
can diff against it.

First confirm which account you are (the brief lists no `grokbot` unix user, so the SSH account
name is not known in advance):

```sh
id; echo "$HOME"
# STOP if the user is mvandykeanthony or root, or $HOME is not your own home directory.
# Everywhere this document writes <SSH_USER>, use the name `id` printed.
```

```sh
mkdir -p -m 700 ~/venueatncc-deploy && chmod 700 ~/venueatncc-deploy && cd ~/venueatncc-deploy

# Apache: vhost map, enabled sites, and a checksum of every vhost file
sudo apachectl -S > ~/venueatncc-deploy/apache-S-before.txt 2>&1
cp ~/venueatncc-deploy/apache-S-before.txt ~/apache-S-before.txt     # the name the brief uses
ls -la /etc/apache2/sites-enabled/ > ~/venueatncc-deploy/sites-enabled-before.txt
sudo md5sum /etc/apache2/sites-available/*.conf /etc/letsencrypt/options-ssl-apache.conf > ~/venueatncc-deploy/vhost-md5-before.txt
sudo apachectl configtest 2>&1 | tee ~/venueatncc-deploy/configtest-before.txt   # expect: Syntax OK

# pm2 (as the owner, with the documented PATH)
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls' | tee ~/venueatncc-deploy/pm2-before.txt
# expect: ncc-backend (id 0) and vandyke-home-loan (id 1), both online
ps -eo user:20,args | grep '[P]M2 v' | tee ~/venueatncc-deploy/pm2-daemons-before.txt
# expect exactly one line, user mvandykeanthony (the one pm2 daemon on this server)

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
├── better_sqlite3.node.keep        664   native add-on built off-server (section 5.4)
├── .npm-cache/                           npm's download cache (kept out of the owner's ~/.npm)
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

Deploy a **reviewed** commit, not whatever is on `main` today. Project policy is that nothing goes
live until the lead has reviewed it at phone and desktop sizes. Get the commit hash or tag from the
lead (or Joel, who relays it) and use it as `<APPROVED_COMMIT>`:

```sh
sudo -H -u mvandykeanthony bash -c 'umask 002; git clone https://github.com/GemsNS/venueatncc.git /var/www/venueatncc.org/app && git -C /var/www/venueatncc.org/app checkout <APPROVED_COMMIT>'
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && git log -1 --oneline && ls src/data/site.ts package-lock.json'
git -C /var/www/venueatncc.org/app rev-parse HEAD | tee ~/venueatncc-deploy/deployed-commit.txt
# the hash must be <APPROVED_COMMIT>; include it in the report to Joel
```

(`git checkout <hash>` leaves a detached HEAD; that is intended. If `git -C` as grokbot complains
about "dubious ownership", run the `rev-parse` inside the owner wrapper instead.)

`umask 002` gives the 775/664 modes the brief asks for, while keeping executable bits that
`node_modules` needs (never `chmod -R 664` the app folder: it would break `esbuild` and other binaries).

**Alternative: rsync** (from a machine that has the repository, when cloning is not possible). Check
out `<APPROVED_COMMIT>` there first, with a clean working tree. Upload to a staging folder in the SSH
account's home (not `/tmp`), then copy in as the owner. The excludes are **rooted** (leading `/`):
an unrooted `--exclude data` would also drop `src/data/` (site.ts, events.ts, faq.ts, photos.ts and
more) and break the build. `.git` is deliberately included, so the deployed commit is recorded, the
sitemap dates work, and the git-based update (14.1) and rollback (14.2) work as written.

```sh
# on the source machine, from the repository root, at <APPROVED_COMMIT>
git status --porcelain     # must print nothing
rsync -az --delete --exclude /node_modules --exclude /dist --exclude /dist-demo --exclude /server-dist \
  --exclude /data --exclude /.env --exclude /.tmp --exclude /.astro \
  ./ <SSH_USER>@34.30.208.144:venueatncc-src/
# on the server
sudo install -d -o mvandykeanthony -g www-data -m 2775 /var/www/venueatncc.org/app
sudo cp -R ~/venueatncc-src/. /var/www/venueatncc.org/app/
sudo chown -R mvandykeanthony:www-data /var/www/venueatncc.org/app     # recursive only inside the new site
sudo find /var/www/venueatncc.org/app -type d -exec chmod 2775 {} + -o -type f -exec chmod g+w {} +   # 775/664 like the git path; keeps exec bits
rm -rf ~/venueatncc-src
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && git log -1 --oneline && ls src/data/site.ts package-lock.json'
sudo -H -u mvandykeanthony bash -c 'git -C /var/www/venueatncc.org/app rev-parse HEAD' | tee ~/venueatncc-deploy/deployed-commit.txt
```

If `.git` could not be uploaded, write the hash into `~/venueatncc-deploy/deployed-commit.txt` by
hand, and know that 14.1 and 14.2 then do not work: such a server must also be updated and rolled
back by rsync of the new or previous commit.

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

**Both paths need `/var/www/venueatncc.org/better_sqlite3.node.keep` on the server before the first
`npm ci`.** Do [5.4](#54-the-native-add-on-better-sqlite3) first: the better-sqlite3 binary that
`npm ci` downloads cannot load on this server, and every `npm ci` below copies the rebuilt file over
it in the same command.

Every `npm ci` here passes `--cache /var/www/venueatncc.org/.npm-cache`, and the install and build
wrappers also export `npm_config_cache` with that path (so `npm run` and `npx` logs go there too),
so npm's writes stay inside the new site's folder instead of the owner's shared `/home/mvandykeanthony/.npm`.
(The other native binaries the build uses, from sharp and libvips, rolldown, lightningcss, the
Astro compiler, and resvg, were checked against the lockfile versions: they need glibc 2.28 or
older and `GLIBCXX_3.4.22` or older, which this server has, so Path A is expected to work. Only
better-sqlite3 needs the off-server build.)

### 5.1 Memory check (both paths)

```sh
free -m
```

Continue with Path A only if the `available` column shows **at least 2500 MB**. The site build
converts every venue photo to AVIF and WebP with sharp and can use 1 to 2 GiB and both CPUs for
several minutes. Build one thing at a time; never run two builds at once on this server.

### 5.2 Path A: build on the server

Install everything, including devDependencies (Astro, esbuild, sharp, tsx), which the build needs,
and put the rebuilt better-sqlite3 binary in place in the same command:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH npm_config_cache=/var/www/venueatncc.org/.npm-cache; umask 002; cd /var/www/venueatncc.org/app && npm ci --no-audit --no-fund --cache /var/www/venueatncc.org/.npm-cache && cp /var/www/venueatncc.org/better_sqlite3.node.keep node_modules/better-sqlite3/build/Release/better_sqlite3.node'
```

Check the native add-on now, before spending time on the build ([5.4](#54-the-native-add-on-better-sqlite3)).
`npm ci` exits 0 even with an unusable binary, so this check is the only thing that catches it:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; cd /var/www/venueatncc.org/app && node -e "const D=require(\"better-sqlite3\");console.log(new D(\":memory:\").prepare(\"select sqlite_version() v\").get())"'
# expect: { v: '3.x.y' }
```

Build at low priority so the other sites keep their CPU, with the Node heap capped:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH npm_config_cache=/var/www/venueatncc.org/.npm-cache; umask 002; cd /var/www/venueatncc.org/app && NODE_OPTIONS=--max-old-space-size=1536 nice -n 19 npm run build'
```

`npm run build` runs `astro build` (static site into `dist/`) and then esbuild (the server into
`server-dist/index.mjs`) (`package.json`, scripts `build` and `build:server`).

Then bundle the two command-line tools, exactly as the Dockerfile does (`Dockerfile:27-28`), so
the admin tool and the nightly backup run with plain `node` and never need `tsx` or `npx`:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH npm_config_cache=/var/www/venueatncc.org/.npm-cache; umask 002; cd /var/www/venueatncc.org/app && npx esbuild server/cli/create-admin.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/create-admin.mjs && npx esbuild server/cli/backup.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/backup.mjs'
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
scp venueatncc-build.tgz <SSH_USER>@34.30.208.144:/tmp/
```

On the server, unpack as the owner and install only the runtime dependencies (hono,
@hono/node-server, better-sqlite3, nodemailer, zod), with the rebuilt better-sqlite3 binary copied
in by the same command:

```sh
chmod 644 /tmp/venueatncc-build.tgz
sudo -H -u mvandykeanthony bash -c 'umask 002; cd /var/www/venueatncc.org/app && rm -rf dist server-dist && tar xzf /tmp/venueatncc-build.tgz'
rm -f /tmp/venueatncc-build.tgz
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH npm_config_cache=/var/www/venueatncc.org/.npm-cache; umask 002; cd /var/www/venueatncc.org/app && npm ci --omit=dev --no-audit --no-fund --cache /var/www/venueatncc.org/.npm-cache && cp /var/www/venueatncc.org/better_sqlite3.node.keep node_modules/better-sqlite3/build/Release/better_sqlite3.node'
```

Then run the better-sqlite3 check from [5.4](#54-the-native-add-on-better-sqlite3). With Path B,
`npm run build` and `npx esbuild` are not available on the server; every update is built the same way.

### 5.4 The native add-on: better-sqlite3

**The check** (one line, run from the app folder with v24 on `PATH`):

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; cd /var/www/venueatncc.org/app && node -e "const D=require(\"better-sqlite3\");console.log(new D(\":memory:\").prepare(\"select sqlite_version() v\").get())"'
# expect: { v: '3.x.y' }
```

**The downloaded binary will not work.** `npm ci` runs better-sqlite3's install script, which uses
`prebuild-install` to download the official prebuilt `better_sqlite3.node` for linux-x64 and Node
24 (ABI 137; release asset `better-sqlite3-v12.11.1-node-v137-linux-x64.tar.gz`, version from
`package-lock.json`). That prebuilt links `log`, `pow`, `log2`, and `exp` from libm at
`GLIBC_2.29`, newer than the glibc 2.28 the patched Node runs on (`/opt/glibc-2.28`), so the check
fails with `GLIBC_2.29 not found (required by .../better_sqlite3.node)`. This was confirmed by
inspecting the release asset itself. `npm ci` still exits 0, because `prebuild-install` only checks
that the download finished, so **always run the check**. `npm rebuild better-sqlite3` re-downloads
the same file and reproduces the error. Without a working add-on the server cannot open its database
and does not start.

So build the add-on once, off the server, on a glibc 2.28 system, and upload it. Its C++ runtime
needs (`GLIBCXX_3.4.20`, `CXXABI_1.3.9` in the official build) are met by Ubuntu 18.04's libstdc++.

**Step 1: build on a Rocky Linux 8 container (any machine with Docker).** RHEL/Rocky/Alma 8 has glibc
2.28, and its `gcc-toolset` compilers link newer C++ runtime parts statically, which is how the
official Node 24 binaries are built. This recipe has been read through but not yet run; if it fails,
fix it there, never on the server.

```sh
docker run --rm -v "$PWD/out:/out" rockylinux:8 bash -c '
  dnf -y install gcc-toolset-12 python3.11 make tar xz &&
  source /opt/rh/gcc-toolset-12/enable &&
  curl -fsSL https://nodejs.org/dist/v24.16.0/node-v24.16.0-linux-x64.tar.xz | tar xJ -C /opt &&
  export PATH=/opt/node-v24.16.0-linux-x64/bin:$PATH PYTHON=python3.11 &&
  mkdir /b && cd /b && npm init -y >/dev/null &&
  npm install better-sqlite3@12.11.1 --build-from-source &&
  cp node_modules/better-sqlite3/build/Release/better_sqlite3.node /out/ &&
  grep -ao "GLIBC_2\.[0-9]*" /out/better_sqlite3.node | sort -uV | tail -1'
# the last line printed must be GLIBC_2.28 or lower; GLIBC_2.29 or higher means the build is not usable here
scp out/better_sqlite3.node <SSH_USER>@34.30.208.144:/tmp/
```

Use the better-sqlite3 version that `package-lock.json` of `<APPROVED_COMMIT>` pins (12.11.1 today:
`grep -A1 '"node_modules/better-sqlite3"' package-lock.json`). When a later commit changes that
version, rebuild the file with the new version before updating.

**Step 2: keep it on the server** as the owner, outside `app/` so no `npm ci` or re-clone deletes it:

```sh
chmod 644 /tmp/better_sqlite3.node
sudo -H -u mvandykeanthony bash -c 'umask 002; cp /tmp/better_sqlite3.node /var/www/venueatncc.org/better_sqlite3.node.keep'
rm -f /tmp/better_sqlite3.node
sudo grep -ao 'GLIBC_2\.[0-9]*' /var/www/venueatncc.org/better_sqlite3.node.keep | sort -uV | tail -1   # expect GLIBC_2.28 or lower
ls -l /var/www/venueatncc.org/better_sqlite3.node.keep
```

**Step 3: every `npm ci` copies it in** inside the same command (5.2, 5.3, 14.1):
`... npm ci ... && cp /var/www/venueatncc.org/better_sqlite3.node.keep node_modules/better-sqlite3/build/Release/better_sqlite3.node`,
followed by the check above. If it was not copied (for example `npm ci` was run alone), copy it now:

```sh
sudo -H -u mvandykeanthony bash -c 'cp /var/www/venueatncc.org/better_sqlite3.node.keep /var/www/venueatncc.org/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
```

**If the check still fails with the rebuilt file:**

1. **See what it needs** and compare against what the server has:

   ```sh
   cd /var/www/venueatncc.org/app
   grep -ao 'GLIBC[X]*_[0-9.]*' node_modules/better-sqlite3/build/Release/better_sqlite3.node | sort -uV
   grep -ao 'GLIBCXX_[0-9.]*' /usr/lib/x86_64-linux-gnu/libstdc++.so.6 | sort -uV | tail -3
   ls /opt/glibc-2.28/lib/libc.so.6 && echo "glibc 2.28 is the maximum GLIBC_ version available"
   ```

   Anything above `GLIBC_2.28`, or a `GLIBCXX_` above the highest one listed, is why it fails; fix
   the build in step 1. `was compiled against a different Node.js version` means the build used a
   Node other than 24.x.

2. **Compile on the server** (last resort). This needs `gcc`/`g++`/`make` (not surveyed) and a Python
   that current node-gyp accepts (3.6.9 is too old), and Ubuntu 18.04's GCC 7 is likely too old for
   Node 24's C++20 headers. Installing a toolchain is an **apt install: [SHARED, JOEL OK] (J3)**,
   and may still not succeed. Prefer fixing the off-server build.

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
| `SMTP_HOST` | unset, which means the outbox (`config.ts:104-114`) | unset at launch (11.1); the relay host once 11.3 is done | See [section 11](#11-email). |
| `SMTP_PORT` | `587` (`config.ts:109`) | `587` | Only used when `SMTP_HOST` is set. |
| `SMTP_SECURE` | `false` (`config.ts:110`) | `false` for 587, `true` for 465 | |
| `SMTP_USER` | unset | per provider | |
| `SMTP_PASS` | empty when `SMTP_USER` is set (`config.ts:112`) | per provider | Not trimmed, so no trailing spaces. |
| `MAIL_FROM` | `The Venue @ NCC <faith@venueatncc.org>` (`config.ts:133`) | leave unset (default) | The relay in 11.3 is verified for this address. Never a wearencc.org address. |
| `NOTIFY_TO` | `faith@venueatncc.org` (`config.ts:134`) | `faith@venueatncc.org` | Also the Reply-To on guest confirmations (`routes/public.ts:135`), so it must never be a wearencc.org address. It receives mail once 11.2 is done. |
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

To edit later: `sudo -u mvandykeanthony nano /var/www/venueatncc.org/.env`, then restart this app
only ([section 14](#14-updating-later-and-rollback)):
`sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && pm2 ls'`. Do not put secrets in the
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

The pm2 daemon was started under Node 16, and this is the pm2 7.0.4 CLI from v24. If pm2 prints
`In-memory PM2 is out-of-date, do: $ pm2 update`, **ignore it**. Never run `pm2 update`, `pm2 kill`,
or `pm2 restart all` on this server: `pm2 update` restarts the daemon and every app on it.

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

Only when `pm2 ls` shows **all three** (`ncc-backend`, `vandyke-home-loan`, `venueatncc`) online.
The command checks that itself and refuses to save otherwise:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls; n=$(pm2 ls | grep -E "ncc-backend|vandyke-home-loan|venueatncc" | grep -cw online); if [ "$n" -eq 3 ]; then pm2 save; else echo "STOP: $n of 3 apps online, pm2 save NOT run"; fi'
```

Never `pm2 restart all`, `pm2 delete all`, `pm2 kill`, `pm2 update`, or any command on the other two
processes. Restart this app only by name:
`sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && pm2 ls'`.

### 7.5 Start on reboot [SHARED] (J2)

pm2 boot startup is not configured on this server yet: today, after a reboot, **no** pm2 app
(including the two existing sites) comes back until someone starts pm2 by hand. This step fixes that
for all three apps. It was decided on 2026-09-30; run it as part of the deploy, after 7.4.

First confirm all three apps are online (the same check as 7.4), because the boot service brings back
exactly the list that `pm2 save` stores:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls; n=$(pm2 ls | grep -E "ncc-backend|vandyke-home-loan|venueatncc" | grep -cw online); echo "$n of 3 online"'
# continue only if it prints: 3 of 3 online
```

Record which Node each existing app runs on and how it is started, for the report to Joel. The
running daemon was started under Node 16, but the boot service starts pm2 with the v24 `PATH`, so
after a reboot an app whose saved interpreter is plain `node` may come back on a different Node than
today. This changes nothing; include the file in the report so Joel can judge it:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 describe ncc-backend; pm2 describe vandyke-home-loan' | grep -iE 'name|interpreter|node.js version|script path' | tee ~/venueatncc-deploy/pm2-interp-before.txt
```

Install the boot service (as the brief prescribes, with the v24 pm2 by absolute path), then save the
list again with the gated command:

```sh
sudo env PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/pm2 startup systemd -u mvandykeanthony --hp /home/mvandykeanthony
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 ls; n=$(pm2 ls | grep -E "ncc-backend|vandyke-home-loan|venueatncc" | grep -cw online); if [ "$n" -eq 3 ]; then pm2 save; else echo "STOP: $n of 3 apps online, pm2 save NOT run"; fi'
```

Verify, without rebooting:

```sh
systemctl is-enabled pm2-mvandykeanthony          # enabled
systemctl cat pm2-mvandykeanthony | grep -E '^(User|ExecStart|ExecReload|ExecStop|PIDFile|Environment=PATH)'
# User=mvandykeanthony, ExecStart=.../pm2 resurrect, ExecReload=.../pm2 reload all, ExecStop=.../pm2 kill, PATH includes v24.16.0/bin
sudo -H -u mvandykeanthony ls -l /home/mvandykeanthony/.pm2/dump.pm2  # just written by pm2 save
ps -eo user:20,args | grep '[P]M2 v'                # still exactly one daemon, owned by mvandykeanthony
```

Do **not** reboot the server to test this; reboots of the shared server are Joel's call. Never run
`systemctl stop`, `restart`, or `reload` on `pm2-mvandykeanthony`: its ExecStop is `pm2 kill` and
its ExecReload is `pm2 reload all`, so each one stops or bounces all three apps. The unit is only
for boot. After the
next reboot, check `pm2 ls` shows all three apps online and run the baseline loop from section 1.

If the boot service ever fails to bring the apps back, the manual recovery is [SHARED: brings back
all saved pm2 apps, as the brief prescribes]:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 resurrect; sleep 5; pm2 ls'
curl -s http://127.0.0.1:3020/api/health; echo
```

Whenever the set of apps changes later, run the gated `pm2 save` from 7.4 again so the boot service
restores the current list.

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
  connection (for example while this app restarts) and answers 503 for that whole time.

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
# Reload (graceful; NEVER systemctl restart apache2) only if the config test passes; otherwise undo the enable.
sudo a2ensite venueatncc.org.conf && sudo apachectl configtest && sudo systemctl reload apache2 || { sudo a2dissite venueatncc.org.conf; sudo apachectl configtest; echo 'STOP: config test failed, new site disabled, nothing reloaded'; }
sudo apachectl -S 2>&1 | tee ~/venueatncc-deploy/apache-S-after-80.txt
```

In the `apachectl -S` output, check:

- `*:80` still says `default server pinnaclepublishinggroup.net`, and `*:443` likewise. Apache picks
  the first vhost loaded, in alphabetical order of `sites-enabled`; `pinnaclepublishinggroup.net.conf`
  sorts before `venueatncc.org.conf`, so the default does not change.
- A new line `port 80 namevhost venueatncc.org (/etc/apache2/sites-enabled/venueatncc.org.conf:3)`
  (Apache reports the `sites-enabled` path it included)
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

The certificate for venueatncc.org does not exist yet; issuing it is part of this deploy, after the
:80 vhost from section 8 serves the site over plain HTTP.

Confirm which ACME server the existing setup uses. certbot 0.27 is old; its built-in default may
still be the retired ACME v1 endpoint, so pass the v2 server explicitly:

```sh
sudo sh -c "grep -h '^server' /etc/letsencrypt/renewal/*.conf" | sort | uniq -c
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
```

**Renewal dry run.** A full `certbot renew --dry-run` changes no real certificate, but it is not
free of side effects: it runs every existing renewal config's authenticator and, in certbot 0.27,
its `pre_hook`, `post_hook`, and the scripts in `renewal-hooks/`. If another certificate used the
`standalone` authenticator with a hook that stops Apache, or a hook that restarts services, the dry
run would take every site down. Inspect first and save the output:

```sh
sudo sh -c "grep -HE '^(authenticator|installer|pre_hook|post_hook|renew_hook|deploy_hook)' /etc/letsencrypt/renewal/*.conf" 2>&1 | tee ~/venueatncc-deploy/renewal-hooks-check.txt
sudo sh -c 'ls -la /etc/letsencrypt/renewal-hooks/*/' 2>&1 | tee -a ~/venueatncc-deploy/renewal-hooks-check.txt
# expect for every file: authenticator = apache and installer = apache, no *_hook lines,
# and the pre/, post/, deploy/ folders empty
```

Then dry-run the new certificate alone:

```sh
sudo certbot renew --dry-run --cert-name venueatncc.org     # [SHARED] challenge for venueatncc.org only, graceful Apache reload
```

Only if **no** existing config uses `standalone` (or `webroot` pointing somewhere unexpected) and
there are **no** hooks that stop or restart services, run the full dry run the brief asks for:

```sh
sudo certbot renew --dry-run      # [SHARED] runs the challenge for all four certificates and reloads Apache gracefully; changes no real certificate
```

Otherwise skip the full run, and send Joel the contents of `renewal-hooks-check.txt` and ask before
running it.

If `http://venueatncc.org/` answers 200 instead of 301, the proxy is taking the request before the
redirect. Fix it in the :80 file only: delete its `ProxyPass`, `ProxyPassReverse`, and `RequestHeader`
lines (keep the rewrite lines), then `sudo apachectl configtest && sudo systemctl reload apache2`.

`certbot certificates` must list `venueatncc.org` (both names) and the three existing certificates
with the same names, domains, and expiry dates as in `certbot-before.txt`. Each `renew --dry-run`
that ran must report success for every certificate it covered; it does not change real certificates.

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

**Alternative:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) in `.env` and restart this
app (`sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && pm2 ls'`); the admin is created at startup when none exists (`bootstrap.ts:19-38`).
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
be Monday to Saturday within two years, and the start time 09:00 or later
(`src/shared/schemas.ts:57-96`; two-year limit `server/routes/public.ts:228-233`).

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
sleep 2     # the app answers first and writes the emails in a background task (server/routes/public.ts:290)
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

## 11. Email

Every booking request sends two emails (`sendInquiryEmails`, `server/routes/public.ts:103-138`):

- a **staff notification** to `NOTIFY_TO`, with Reply-To set to the guest;
- a **guest confirmation** to the guest, From `MAIL_FROM`, with **Reply-To set to `NOTIFY_TO`**.
  It is skipped (and the skip noted on the request's timeline) once the hourly cap on guest
  confirmations is reached (`public.ts:119-131`), so space out test requests.

Requests are **always saved to the database first**; an email problem never loses one, and each send
attempt is recorded on the request's timeline in the admin.

**The plan (decided 2026-09-30).** The owner's working mailbox is `faith@wearencc.org` on GoDaddy's
Microsoft 365 (Outlook). The venue is a separate business, so guests must only ever see
`faith@venueatncc.org`. Because `NOTIFY_TO` is also the guests' Reply-To, **never set `NOTIFY_TO`
or `MAIL_FROM` to a wearencc.org address**, and never send through the wearencc.org mailbox's SMTP
login (Microsoft rewrites the From to the mailbox's main address unless sending from aliases is
enabled, and the message headers name that tenant either way). Instead:

| Step | Who | Result |
| --- | --- | --- |
| 11.1 Launch with the outbox | grokbot, at deploy | Site live; staff see every inquiry in the admin; no email is sent yet. |
| 11.2 Receive: `faith@venueatncc.org` as an alias of Faith's existing Outlook mailbox | Owner, in GoDaddy (plus DNS) | Mail to `faith@venueatncc.org` arrives in the Outlook inbox Faith already uses. |
| 11.3 Send: a transactional relay for `venueatncc.org` | Owner signs up and adds DNS; grokbot edits `.env` | Notifications and confirmations go out From `faith@venueatncc.org`. |

Turn on 11.3 only after 11.2 works, so guests' replies and staff notifications have somewhere to
land. Outbound SMTP on port 587 works from Google Cloud (only port 25 is blocked), so nothing here
needs a firewall change or touches the server's shared state.

All DNS for `venueatncc.org` is managed by the owner at GoDaddy (My Products, venueatncc.org, DNS).
Keep exactly **one** SPF (`v=spf1 ...`) TXT record on `@`; merge includes into it.

### 11.1 Launch with the outbox (grokbot, at deploy)

This is what the `.env` from section 6 does: `SMTP_HOST` is empty and `NOTIFY_TO` is
`faith@venueatncc.org`.

- Every email is written to `/var/www/venueatncc.org/data/outbox/` as an `.eml` (the full message)
  and an `.html` (its body), files mode 600 (`server/email/mailer.ts:57-70`). Nothing is sent, so
  guests get **no** confirmation email; the booking page still shows them their reference number.
- **Staff see every new inquiry in the admin:** https://venueatncc.org/admin/, the inquiry list,
  newest first, with status, details, notes, and the email timeline (which says "saved to the
  outbox"). Until 11.3 is done, staff should check it daily and contact guests by phone or email.
- To read the outbox files on the server:

  ```sh
  sudo ls -lt /var/www/venueatncc.org/data/outbox/ | head
  sudo cat /var/www/venueatncc.org/data/outbox/<FILE>.html
  ```

- Leave `OUTBOX_RETENTION_DAYS` unset while on the outbox (the files are the only copy of the
  rendered emails).

### 11.2 Receive: faith@venueatncc.org as an alias in Microsoft 365 from GoDaddy (owner)

1. **Owner, GoDaddy Email & Office Dashboard:** add `venueatncc.org` as a domain on the same
   Microsoft 365 account that holds `faith@wearencc.org` (GoDaddy offers to set up the DNS records
   automatically; accept only the records listed in step 2).
2. **Owner, GoDaddy DNS for venueatncc.org** (if not added automatically):

   | Type | Name | Value |
   | --- | --- | --- |
   | MX | `@` | `0 venueatncc-org.mail.protection.outlook.com` (confirm the exact host the dashboard shows) |
   | CNAME | `autodiscover` | `autodiscover.outlook.com` |
   | TXT | `@` | `v=spf1 include:secureserver.net ~all` (the SPF GoDaddy uses for its Microsoft 365; 11.3 adds the relay to this same record) |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:faith@venueatncc.org` |

   Do not change any wearencc.org DNS record.
3. **Owner, Email & Office Dashboard:** open Faith's mailbox (`faith@wearencc.org`), Email aliases,
   **Add alias** `faith` on the domain `venueatncc.org`.
4. **Check:** `dig +short MX venueatncc.org @8.8.8.8` shows the Outlook host. Send a test message to
   `faith@venueatncc.org` from an outside account; it must arrive in Faith's Outlook inbox.

If the dashboard does not allow an alias on a second domain, use a mail forwarder for
`faith@venueatncc.org` (GoDaddy's forwarding, if offered on this domain, or a service such as
ForwardEmail or ImprovMX that works with MX records at GoDaddy; not Cloudflare Email Routing, which
needs the domain's nameservers moved to Cloudflare) that forwards to `faith@wearencc.org`, with the
MX records that service gives instead of the Outlook MX above. Either way, guests only see `faith@venueatncc.org`.

When Faith replies to a guest from Outlook, she should choose `faith@venueatncc.org` in the From
field (Outlook on the web: From, Other email address). If Outlook replaces it with the wearencc.org
address, the owner asks GoDaddy support to turn on "sending from aliases" for the account.

### 11.3 Send: a transactional relay for venueatncc.org (owner + grokbot)

The app sends through a relay's SMTP service, not through the Outlook mailbox, so outgoing mail is
entirely on `venueatncc.org`. Recommended: **Postmark** (simple, made for transactional mail) or
**Amazon SES** (cheapest; request production access to leave the sandbox). Brevo and Mailgun also work.

1. **Owner:** create the account and add `venueatncc.org` as a sending domain (sender
   `faith@venueatncc.org`).
2. **Owner, GoDaddy DNS:** add the records the provider shows (use its exact values; selectors and
   tokens are generated per account):

   | Type | Name | Value | Purpose |
   | --- | --- | --- | --- |
   | TXT | `<selector>pm._domainkey` | `k=rsa; p=<key from Postmark>` | DKIM for Postmark |
   | CNAME | `pm-bounces` | `pm.mtasv.net` | Postmark Return-Path (SPF alignment; no change to the `@` SPF) |
   | CNAME (x3) | `<token>._domainkey` | `<token>.dkim.amazonses.com` | DKIM for SES |
   | TXT | `@` (edit the existing SPF) | Brevo or Mailgun: `v=spf1 include:secureserver.net include:spf.brevo.com ~all` (or `include:mailgun.org`). SES: no change unless a custom MAIL FROM subdomain is set up (then follow SES's records for that subdomain); by default SES passes DMARC through DKIM. | One SPF record, both senders |

   The `_dmarc` record from 11.2 stays.
3. **Owner:** wait until the provider shows the domain as verified, and give grokbot the SMTP
   username and password (or token) through a private channel, never in chat logs or the repo.
4. **grokbot:** edit only these lines of `.env` (`sudo -u mvandykeanthony nano /var/www/venueatncc.org/.env`):

   ```ini
   SMTP_HOST=<smtp.postmarkapp.com, or email-smtp.<region>.amazonaws.com, smtp-relay.brevo.com, smtp.mailgun.org>
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=<provider SMTP username or token>
   SMTP_PASS=<provider SMTP password or token>
   OUTBOX_RETENTION_DAYS=90
   ```

   Leave `MAIL_FROM` unset (default `The Venue @ NCC <faith@venueatncc.org>`) and keep
   `NOTIFY_TO=faith@venueatncc.org`.
5. Restart this app only (`sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && pm2 ls'`), check the log says
   `[email] Sending through <host>:587 as The Venue @ NCC <faith@venueatncc.org>. Notifications go to faith@venueatncc.org.`,
   and send one test request (10.3) with **your own** email address instead of `example.com`.
6. **Check both emails:** the staff notification reaches Faith's Outlook inbox; the guest
   confirmation arrives From and Reply-To `faith@venueatncc.org`, and its headers
   (`Authentication-Results`) show `spf=pass` or `dkim=pass` with `dmarc=pass`. No
   `wearencc.org` appears anywhere in the guest's copy.

---

## 12. Backups

The database file is everything that matters (inquiries, admins, calendar blocks). The bundled
backup tool takes a consistent online copy with SQLite's backup API while the server runs, WAL
included (`server/cli/backup.ts`). It writes `data/backups/venue-YYYYMMDD-HHMMSS.db` next to the
database and keeps the newest N (default 14, `backup.ts:26`). It fails with "No database" before
the app has first started (`backup.ts:24`). The timestamp in the file name is **UTC**
(`backup.ts:30`), not the server's America/New_York time, so the 03:15 nightly job writes names
ending `-0715xx` (EDT, summer) or `-0815xx` (EST, winter).

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

### 12.2 The crontab entries [SHARED] (J1)

Decided on 2026-09-30: run this as part of the deploy. The owner's crontab is shared and may hold
other sites' jobs, so it is never rebuilt in a pipeline: the new crontab is written to a file, checked with `diff`, and only then
installed. Every copy stays private (mode 600, in the 700 snapshot folder), and only line counts,
checksums, and the diff of the new lines are printed, never the other sites' job lines. Cron runs in
the server's time zone, America/New_York.

**Step 1: read, snapshot, and prepare** (changes nothing; runs in its own `bash`, so a STOP does not
end your SSH session):

```sh
bash <<'SH'
set -u; umask 077; D=$HOME/venueatncc-deploy
sudo crontab -u mvandykeanthony -l > "$D/cron-cur.txt" 2> "$D/cron-cur.err"; rc=$?
if [ $rc -ne 0 ] && ! grep -q 'no crontab for mvandykeanthony' "$D/cron-cur.err"; then
  echo "STOP: could not read mvandykeanthony's crontab (exit $rc); nothing changed"; cat "$D/cron-cur.err"; exit 1
fi
[ -e "$D/crontab-mvandykeanthony-before.txt" ] || cp "$D/cron-cur.txt" "$D/crontab-mvandykeanthony-before.txt"
if grep -q 'venueatncc' "$D/cron-cur.txt"; then echo "STOP: venueatncc lines are already installed"; exit 1; fi
cp "$D/cron-cur.txt" "$D/cron-new.txt"
cat >> "$D/cron-new.txt" <<'CRON'
# venueatncc: nightly SQLite backup, keeps 30 (docs/deploy-gcloud-apache.md section 12)
15 3 * * * cd /var/www/venueatncc.org/app && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node server-dist/backup.mjs --keep 30 >> /var/www/venueatncc.org/logs/backup.log 2>&1
# venueatncc: weekly rotation of /var/www/venueatncc.org/logs
30 3 * * 0 /usr/sbin/logrotate -s /var/www/venueatncc.org/logs/.logrotate-state /var/www/venueatncc.org/logrotate.conf
CRON
chmod 600 "$D/cron-cur.txt" "$D/cron-cur.err" "$D/cron-new.txt" "$D/crontab-mvandykeanthony-before.txt"
echo "current: $(wc -l < "$D/cron-cur.txt") lines, md5 $(md5sum < "$D/cron-cur.txt" | cut -c1-32)"
echo "new:     $(wc -l < "$D/cron-new.txt") lines"
diff "$D/cron-cur.txt" "$D/cron-new.txt"
SH
```

The `diff` must show exactly the 4 lines above being added (`> ...`) and nothing removed; the new
line count is the current one plus 4. If not, stop.

**Step 2: install**, only if the live crontab is still identical to what step 1 read:

```sh
D=~/venueatncc-deploy
sudo crontab -u mvandykeanthony -l 2>/dev/null | cmp -s - "$D/cron-cur.txt" && sudo crontab -u mvandykeanthony "$D/cron-new.txt" && echo "installed" || echo "STOP: the crontab changed since step 1, or the install failed; nothing installed, re-run step 1"
sudo crontab -u mvandykeanthony -l 2>/dev/null | cmp - "$D/cron-new.txt" && echo "OK: the live crontab matches cron-new.txt"
```

Check the next morning: `sudo tail /var/www/venueatncc.org/logs/backup.log` shows
`Backed up /var/www/venueatncc.org/data/venue.db to .../venue-YYYYMMDD-HHMMSS.db` (UTC time in the name).

Backups are kept **on the server only** (decided 2026-09-30): the newest 30 nightly copies in
`/var/www/venueatncc.org/data/backups/` (mode 700, owner `mvandykeanthony`), never under a
DocumentRoot, never copied to `/tmp` or anywhere world-readable.

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
# Then (only now): pm2 save, as in section 7.4 (the gated command), if not done yet.
ps -eo user:20,args | grep '[P]M2 v'                       # exactly ONE line, user mvandykeanthony (no second daemon from sudo/npx pm2)
diff pm2-daemons-before.txt <(ps -eo user:20,args | grep '[P]M2 v')   # no output

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

# 12. Nothing sensitive is reachable over the web
sudo ls -A /var/www/venueatncc.org/public_html            # empty (or only .well-known)
for p in /.env /app/.env /ecosystem.config.cjs /better_sqlite3.node.keep /data/venue.db /logs/out.log /package.json; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "https://venueatncc.org$p")" "$p"
done                                                    # every line 404 (the app's 404 page), never 200 with file content
```

Also confirm: the first admin exists and signed in (10.4), the test inquiry is archived, a backup
file exists, the crontab has the two venueatncc jobs, `systemctl is-enabled pm2-mvandykeanthony`
prints `enabled`, and `pm2 save` ran after all three apps were online. Report the deployed commit (`deployed-commit.txt`, which must be the
lead's `<APPROVED_COMMIT>`) to Joel with the results.

---

## 14. Updating later, and rollback

### 14.1 Update (new site only)

Update only to a commit the lead has reviewed (`<APPROVED_COMMIT>`), never to whatever is on `main`
at the time. If the new commit changes the better-sqlite3 version in `package-lock.json`, rebuild
`better_sqlite3.node.keep` for that version first ([5.4](#54-the-native-add-on-better-sqlite3)).

```sh
# 0. Record what is running now, and check memory
sudo -H -u mvandykeanthony bash -c 'git -C /var/www/venueatncc.org/app rev-parse HEAD' | tee ~/venueatncc-deploy/previous-commit.txt
free -m

# 1. Back up the database (a new version can run a migration that rebuilds tables)
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node server-dist/backup.mjs --keep 30'

# 2. Check out the approved commit
sudo -H -u mvandykeanthony bash -c 'umask 002; cd /var/www/venueatncc.org/app && git fetch origin && git checkout <APPROVED_COMMIT> && git log -1 --oneline'
sudo -H -u mvandykeanthony bash -c 'git -C /var/www/venueatncc.org/app rev-parse HEAD' | tee ~/venueatncc-deploy/deployed-commit.txt

# 3. Install and build (Path A). npm ci, the copy of the rebuilt better-sqlite3 binary, and its check are
#    one chain, so the check never sees the unusable downloaded binary. The site is built into
#    .tmp/dist-next so the live dist/ keeps serving until the swap.
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH npm_config_cache=/var/www/venueatncc.org/.npm-cache; umask 002; cd /var/www/venueatncc.org/app && npm ci --no-audit --no-fund --cache /var/www/venueatncc.org/.npm-cache && cp /var/www/venueatncc.org/better_sqlite3.node.keep node_modules/better-sqlite3/build/Release/better_sqlite3.node && node -e "const D=require(\"better-sqlite3\");console.log(new D(\":memory:\").prepare(\"select sqlite_version() v\").get())" && NODE_OPTIONS=--max-old-space-size=1536 nice -n 19 npx astro build --outDir .tmp/dist-next && npm run build:server && npx esbuild server/cli/create-admin.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/create-admin.mjs && npx esbuild server/cli/backup.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/backup.mjs && echo "STEP 3 OK"'

# 4. Only if step 3 printed "STEP 3 OK": swap the site in and restart this app only (migrations run automatically at start, db.ts:244)
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && test -f .tmp/dist-next/index.html && rm -rf .tmp/dist-prev && mv dist .tmp/dist-prev && mv .tmp/dist-next dist'
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && sleep 5 && pm2 ls'

# 5. Check
curl -s http://127.0.0.1:3020/api/health; echo
curl -s -o /dev/null -w '%{http_code}\n' https://venueatncc.org/
sudo tail -n 20 /var/www/venueatncc.org/logs/error.log
```

**If step 3 fails anywhere, do not restart the app.** `npm ci` has already replaced `node_modules`
while the old process keeps running from memory, so the site stays up until the next restart, but
any restart now (including a crash, `max_memory_restart`, or a reboot) would fail. Fix the cause and
re-run step 3 until it prints `STEP 3 OK`. To return to the running version instead, check out
`previous-commit.txt` (14.2) and re-run step 3 for it before any restart. Never split the chain in
step 3: run without the `cp`, the restart would load the downloaded GLIBC_2.29 binary and crash-loop
up to `max_restarts` (10), taking the site down.

**With Path B**, build `<APPROVED_COMMIT>` on the other machine as in 5.3 and upload the tarball to
`/tmp/` as there. On the server run steps 0 to 2, then instead of steps 3 and 4:

```sh
# 3B. Unpack into .tmp/next (not over the live files), install runtime packages, copy and check the add-on
chmod 644 /tmp/venueatncc-build.tgz
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH npm_config_cache=/var/www/venueatncc.org/.npm-cache; umask 002; cd /var/www/venueatncc.org/app && rm -rf .tmp/next && mkdir -p .tmp/next && tar xzf /tmp/venueatncc-build.tgz -C .tmp/next && npm ci --omit=dev --no-audit --no-fund --cache /var/www/venueatncc.org/.npm-cache && cp /var/www/venueatncc.org/better_sqlite3.node.keep node_modules/better-sqlite3/build/Release/better_sqlite3.node && node -e "const D=require(\"better-sqlite3\");console.log(new D(\":memory:\").prepare(\"select sqlite_version() v\").get())" && echo "STEP 3 OK"'
rm -f /tmp/venueatncc-build.tgz
# 4B. Only after "STEP 3 OK": swap dist/ and server-dist/, then restart this app only
sudo -H -u mvandykeanthony bash -c 'cd /var/www/venueatncc.org/app && test -f .tmp/next/dist/index.html && test -f .tmp/next/server-dist/index.mjs && rm -rf .tmp/dist-prev .tmp/server-dist-prev && mv dist .tmp/dist-prev && mv server-dist .tmp/server-dist-prev && mv .tmp/next/dist dist && mv .tmp/next/server-dist server-dist'
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && sleep 5 && pm2 ls'
```

The same rule applies: if 3B fails, do not restart; fix and re-run it.

Changing only `.env`: edit it, then restart this app with the command in step 4.

### 14.2 Roll back the code (new site only)

```sh
sudo -H -u mvandykeanthony bash -c "umask 002; cd /var/www/venueatncc.org/app && git checkout $(cat ~/venueatncc-deploy/previous-commit.txt)"
# then repeat step 3 (build) and step 4 (swap and restart) of 14.1
```

If the new version ran a migration, the older code refuses the database ("schema version N is newer
than this server"). Then also restore the backup from step 1 ([12.4](#124-restore)).

The quick undo for a bad site build alone, without rebuilding: swap `.tmp/dist-prev` back into
`dist`, then restart this app:
`sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && pm2 ls'`.

---

## 15. Troubleshooting

**`GLIBC_2.28 not found` (naming `node`), or `node: command not found`.** The wrong Node
ran. Every owner command must start with
`export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH`, and pm2's `interpreter`
must be the absolute v24 path. Check with `which node; node -v` inside the same `bash -c`. Do not
"fix" this with `nvm use`, `nvm alias`, or by touching `/opt/glibc-2.28`. If the v24 binary itself
fails, run `patchelf --print-interpreter --print-rpath /home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin/node`
(expect `/opt/glibc-2.28/lib/ld-linux-x86-64.so.2` and the RUNPATH from the brief) and tell Joel;
do not re-patch it yourself.

**better-sqlite3 will not load** (`Error loading shared library`, `GLIBCXX_3.4.xx not found`,
`NODE_MODULE_VERSION` mismatch, `Could not locate the bindings file`).
- `GLIBC_2.29 not found` naming `better_sqlite3.node`: the downloaded prebuilt is in place (an
  `npm ci` ran without the copy). This happens with the correct Node too; it is not a PATH problem.
  Copy the off-server build back in (5.4 step 3) and re-run the check before any restart.
- Otherwise work through [5.4](#54-the-native-add-on-better-sqlite3). A `NODE_MODULE_VERSION`
  mismatch means npm ran under a different Node, or the `.keep` file was built for another Node or
  better-sqlite3 version; re-run `npm ci` with the v24 `PATH`, or rebuild the `.keep` file.

**sharp or the Astro build fails on the server** (`Could not load the "sharp" module`, `GLIBC`
errors from `@img/sharp-linux-x64` or `@resvg/resvg-js`, or the build is killed for memory). Use
Path B ([5.3](#53-path-b-build-elsewhere-upload-the-output)); the runtime does not need sharp.

**Apache answers 502 or 503.** The app is not listening. `pm2 ls` with the owner wrapper (is
`venueatncc` online or looping?), `sudo tail -n 50 /var/www/venueatncc.org/logs/error.log`, `sudo ss -tlnp | grep 3020`,
`curl -s http://127.0.0.1:3020/api/health`. Common causes in the log:
`SESSION_SECRET is required when NODE_ENV=production` or `must be at least 32 characters`
(`.env` missing, not readable by the owner, or the symlink `app/.env` is broken: `ls -l /var/www/venueatncc.org/app/.env`);
`EADDRINUSE` (port taken: see below); `Database schema version N is newer than this server`
(see [14.2](#142-roll-back-the-code-new-site-only)). Also see `sudo tail /var/log/apache2/venueatncc.org-error.log`.
A 503 lasting about a minute after a restart means `retry=0` is missing from a `ProxyPass` line.

**pm2 shows `errored` or a growing restart count.** `sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 logs venueatncc --lines 50 --nostream'`.
If the restarts line up with sign-ins, raise `max_memory_restart` in the ecosystem file, then start
this app fresh (ecosystem changes need it; never `restart all`):

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 delete venueatncc && pm2 start /var/www/venueatncc.org/ecosystem.config.cjs --only venueatncc && sleep 5 && pm2 ls'
```

Then save with the gated command from [7.4](#74-save-the-process-list-shared), which runs `pm2 save`
only when all three apps are online.

**Port in use** (`EADDRINUSE 127.0.0.1:3020`). `sudo ss -tlnp | grep -E ':3020\b'` names the process.
If it is not a stale `venueatncc`, choose 3030 or 4010 and change it in `.env`, the ecosystem file,
and both vhost files (`ProxyPass` and `ProxyPassReverse`), then start this app fresh with the
`pm2 delete venueatncc && pm2 start ...` command above (the port is in the ecosystem file), and
`sudo apachectl configtest && sudo systemctl reload apache2`.

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
  (`/etc/letsencrypt/renewal/venueatncc.org.conf`); confirm with
  `sudo certbot renew --dry-run --cert-name venueatncc.org`.
- `The requested apache plugin does not appear to be installed`: stop; that is a shared certbot
  problem for Joel.

**Wrong client IP** (everyone gets "Too many sign-in attempts" together). The admin pages show no
IP addresses; the client IP is stored only with each admin session (`server/repo.ts:371-374`). After
a sign-in, look at the newest sessions:

```sh
sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; cd /var/www/venueatncc.org/app && node -e "const D=require(\"better-sqlite3\");console.log(new D(\"/var/www/venueatncc.org/data/venue.db\",{readonly:true}).prepare(\"select ip,created_at from sessions order by created_at desc limit 5\").all())"'
```

If it shows `127.0.0.1`, `TRUST_PROXY` is not `true`, or the app was not restarted after changing
`.env`. `sudo grep TRUST_PROXY /var/www/venueatncc.org/.env`, then restart this app
(`sudo -H -u mvandykeanthony bash -c 'export PATH=/home/mvandykeanthony/.nvm/versions/node/v24.16.0/bin:$PATH; pm2 restart venueatncc && pm2 ls'`).
Never set `TRUST_PROXY=true` if the app listens on anything but 127.0.0.1.

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

**`http://` does not redirect to `https://`.** See the end of [9.5](#95-test-reload-verify-shared).

**Other sites broke after a reload.** `sudo apachectl configtest`; `sudo a2dissite venueatncc.org.conf venueatncc.org-le-ssl.conf && sudo systemctl reload apache2`;
re-run the baseline loop; tell Joel. Never restart Apache and never edit the other vhosts.
