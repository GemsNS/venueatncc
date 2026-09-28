# Deploying The Venue at NCC

The production site is one small Node server. It serves the built pages from `dist/` and the API under
`/api` (booking requests, the calendar, and the admin), keeps everything in one SQLite file
(`data/venue.db`), and sends email through any SMTP account. [Caddy](https://caddyserver.com) sits in
front of it and handles HTTPS certificates automatically.

```
visitor ──https──> Caddy (ports 80/443) ──http──> Node app (port 8787) ──> data/venue.db
                                                        └──> SMTP server, or data/outbox/ if none
```

The GitHub Pages demo is separate: it is a static build (`npm run build:demo`) with an in-browser demo
backend, and it never talks to this server.

- [1. Before you start: email](#1-before-you-start-email)
- [2. Recommended: a small server with Docker Compose](#2-recommended-a-small-server-with-docker-compose)
- [3. Point venueatncc.org at the server (GoDaddy DNS)](#3-point-venueatnccorg-at-the-server-godaddy-dns)
- [4. Admins](#4-admins)
- [5. Checking the email outbox](#5-checking-the-email-outbox)
- [6. Backups and restores](#6-backups-and-restores)
- [7. Updating](#7-updating)
- [8. Other hosts](#8-other-hosts)
- [9. Local development](#9-local-development)
- [10. Troubleshooting](#10-troubleshooting)

## 1. Before you start: email

Every booking request sends two emails: a notification to the venue (with Reply-To set to the guest,
so you can answer with one click) and a confirmation to the guest with their reference number, estimate,
and next steps.

**The venue address does not receive mail yet.** When checked on 2026-09-28, `venueatncc.org` had no MX
records, so anything sent to `faith@venueatncc.org` bounces. Before launch, do one of these:

- Set up a mailbox for the domain (Microsoft 365 or Google Workspace through GoDaddy, Zoho Mail, and so
  on). The provider gives you MX records to add in GoDaddy DNS.
- Or set `NOTIFY_TO` in `.env` to a mailbox that works today. Guests' replies to their confirmation
  email go to `NOTIFY_TO` as well.

**Sending.** Set the `SMTP_*` variables in `.env`. Until you do, emails are saved to the outbox folder
instead (see [section 5](#5-checking-the-email-outbox)), so nothing is lost while you set this up.
Typical settings, to confirm in your provider's help pages:

| Provider | `SMTP_HOST` | `SMTP_PORT` | `SMTP_SECURE` | Notes |
| --- | --- | --- | --- | --- |
| Microsoft 365 (including "Microsoft 365 from GoDaddy") | `smtp.office365.com` | 587 | `false` | Turn on "Authenticated SMTP" for the mailbox in the Microsoft 365 admin center. |
| Google Workspace | `smtp.gmail.com` | 587 | `false` | Use an app password (needs 2-Step Verification). |
| GoDaddy Professional Email | `smtpout.secureserver.net` | 465 | `true` | |
| Zoho Mail | `smtp.zoho.com` | 465 | `true` | |
| Postmark, Amazon SES, Resend, Brevo, Mailgun | from the provider | 587 | `false` | Best deliverability for automated mail. Verify the domain with them first. |

`SMTP_USER` and `SMTP_PASS` are the account's sign-in. `MAIL_FROM` must be an address that account is
allowed to send as (default `The Venue at NCC <faith@venueatncc.org>`).

**Deliverability.** So confirmations do not land in spam, add the records your provider gives you in
GoDaddy DNS: an SPF `TXT` record on `@` (for example `v=spf1 include:spf.protection.outlook.com -all`
for Microsoft 365), its DKIM records, and a DMARC record such as `_dmarc` `TXT`
`v=DMARC1; p=none; rua=mailto:faith@venueatncc.org`. Keep only one SPF record.

## 2. Recommended: a small server with Docker Compose

A virtual server with 1 vCPU and 2 GB of memory is plenty (DigitalOcean, Hetzner, Vultr, Linode, or
AWS Lightsail; usually $5 to $12 a month). With 1 GB of memory, add swap so the site build has room.

1. **Create the server** with Ubuntu 24.04 LTS and note its public IPv4 address. Open ports 22, 80,
   and 443:

   ```sh
   sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable
   ```

   On 1 GB machines, add 2 GB of swap:

   ```sh
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **Install Docker:**

   ```sh
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # then sign out and back in
   ```

3. **Get the code** into `/opt/venueatncc`:

   ```sh
   sudo mkdir -p /opt/venueatncc && sudo chown $USER /opt/venueatncc
   git clone <your repository URL> /opt/venueatncc
   cd /opt/venueatncc
   ls src/data/site.ts   # the venue facts must be there; the build needs them
   ```

4. **Configure.** Copy the example and edit it (`nano .env`):

   ```sh
   cp .env.example .env
   ```

   - `SESSION_SECRET` and `FORM_TOKEN_SECRET`: two different random values. Generate each with
     `openssl rand -base64 48`.
   - `PUBLIC_ORIGIN=https://venueatncc.org`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12 or more characters), `ADMIN_NAME`: the first admin.
   - The `SMTP_*` settings, `MAIL_FROM`, and `NOTIFY_TO` from [section 1](#1-before-you-start-email).
   - `SITE_DOMAIN`: leave as `venueatncc.org`. To try the server before switching the main domain,
     use a spare name such as `new.venueatncc.org` (add an `A` record for it first) and set
     `PUBLIC_ORIGIN` to match.

   Compose fixes `NODE_ENV=production`, `TRUST_PROXY=true`, the port, and the data paths for you.

5. **Point DNS at the server** ([section 3](#3-point-venueatnccorg-at-the-server-godaddy-dns)). Caddy
   can only get a certificate once `venueatncc.org` and `www.venueatncc.org` resolve to this server.

6. **Start it:**

   ```sh
   docker compose up -d --build
   docker compose ps          # app should become "healthy"
   docker compose logs -f     # Ctrl+C to stop following
   ```

   The first build takes a few minutes. The log shows `Created the first admin` and
   `listening on http://localhost:8787`. Caddy logs `certificate obtained successfully` once DNS is in place.

7. **Check it:** open https://venueatncc.org, send a test request from the booking page, confirm both
   emails arrive (or appear in the outbox), then sign in at https://venueatncc.org/admin/ and mark the test
   request Booked. The date should show as taken on the public calendar.

8. **Remove `ADMIN_PASSWORD` from `.env`** and run `docker compose up -d` so it is no longer in the
   container's environment. Until you do, the log shows a warning at every start.

The app restarts automatically after crashes and reboots (`restart: unless-stopped`). The database,
outbox, and backups live in the `venue-data` Docker volume, and Caddy's certificates in `caddy-data`.

## 3. Point venueatncc.org at the server (GoDaddy DNS)

The domain is registered at GoDaddy and currently shows a GoDaddy Website Builder page.

1. Sign in at [godaddy.com](https://www.godaddy.com), open **My Products**, find **venueatncc.org**, and
   choose **DNS** (or **Manage DNS**).
2. If the domain is connected to Website Builder, disconnect it there first (Website Builder, Settings,
   Domain), or GoDaddy may put its own records back.
3. **`A` record for `@`**: edit it so the value is your server's IPv4 address. Delete any other `A`
   records on `@` (Website Builder usually adds two). A TTL of 600 seconds (or the shortest offered) makes
   changes take effect faster.
4. **`www`**: make it a `CNAME` pointing to `@` (or an `A` record with the same IPv4 address). Caddy
   redirects `www.venueatncc.org` to `venueatncc.org`.
5. **`AAAA` records**: if your server has an IPv6 address, add `AAAA` `@` with it. Otherwise delete any
   `AAAA` records on `@` and `www`, or some visitors will reach the old host.
6. Leave `MX`, `TXT`, and `CNAME` records for email alone (other than the SPF, DKIM, and DMARC records
   from [section 1](#1-before-you-start-email)).
7. Wait for the change to spread (minutes, occasionally a few hours). Check from your computer:

   ```sh
   nslookup venueatncc.org
   nslookup www.venueatncc.org
   ```

   Both should show your server's address. Caddy retries the certificate on its own; watch with
   `docker compose logs -f caddy`.
8. Once the new site works over HTTPS, cancel the Website Builder plan (keep the domain registration
   itself, and keep it on auto-renew).

After launch, submit `https://venueatncc.org/sitemap-index.xml` in Google Search Console.

## 4. Admins

- **First admin:** created at startup from `ADMIN_EMAIL` and `ADMIN_PASSWORD` when no admin exists yet.
  After that those variables are ignored.
- **Add an admin or reset a password** (asks for the password twice, hidden):

  ```sh
  docker compose exec app node server-dist/create-admin.mjs --email someone@example.com --name "Their Name"
  ```

  Without a terminal, pipe the password in:

  ```sh
  printf '%s' 'a long passphrase here' | docker compose exec -T app node server-dist/create-admin.mjs --email someone@example.com --password-stdin
  ```

  On a development machine: `npm run admin:create -- --email someone@example.com --name "Their Name"`.
- If the email already exists, its password (and name, if given) is updated and that admin is signed out
  everywhere. Passwords need at least 12 characters.
- Admins sign in at `/admin/`. Sessions last 14 days, and end sooner after 12 hours without use.
  Changing your password in the admin signs out every session, then signs this browser back in with a
  new one.
- Sign-in limits, per address (an IPv6 network counts as one address): after 10 wrong passwords for one
  account in 15 minutes, or 20 sign-in attempts with any emails, sign-in from that address pauses for
  15 minutes. Passwords are hashed with scrypt at OWASP's recommended strength; older hashes are
  upgraded the next time that admin signs in. If many sign-ins arrive at once, the server answers
  "Sign-in is busy right now" for a moment rather than slow the whole site down.
- **Marking a request Booked** blocks every space it asked for on the public calendar. If another
  calendar block already covers any of those spaces on that date, the admin refuses and names the
  block: remove or change it on the calendar first. A hold linked to the request is turned into the
  booking. Moving a Booked request to another status takes its booked block off the calendar (for
  dates from today on), so the date is open again.

## 5. Checking the email outbox

When `SMTP_HOST` is empty, every email is written to the outbox folder (`/app/data/outbox` in Docker,
`data/outbox` locally) as two files:

- `...-NCC-XXXXX-venue-....eml` and `...-guest-....eml`: the complete message. Open it in Outlook,
  Apple Mail, or Thunderbird.
- The matching `.html` file: just the message body, for a quick look in a browser.

```sh
docker compose exec app ls -l /app/data/outbox
docker compose cp app:/app/data/outbox ./outbox      # copy them to the server's disk, then download
```

Every send attempt is recorded (sent, saved to the outbox, or failed with the error) in the `email_log`
table and on the request's timeline in the admin. An email problem never loses a booking request: the
request is saved first, and emails go out right after.

The files hold guests' names, email addresses, and phone numbers, and only the app's user can read
them. Nothing is deleted automatically. Once SMTP is sending, set `OUTBOX_RETENTION_DAYS` (for
example `90`) in `.env` to delete outbox files older than that. The requests themselves stay in the
database until you remove them; decide how long to keep declined and archived requests, and note it
alongside your backup routine.

**Guest confirmations are capped at 50 an hour** across all visitors, because the form mails whatever
address is typed in. Past that, the venue notification still arrives and the request's timeline says
the confirmation was not sent, so you can contact the guest yourself.

## 6. Backups and restores

Everything that matters is the database file. The backup tool makes a consistent copy while the server
is running (a plain file copy of `venue.db` can miss recent changes that are still in `venue.db-wal`):

```sh
docker compose exec app node server-dist/backup.mjs
```

It writes `/app/data/backups/venue-YYYYMMDD-HHMMSS.db` and keeps the newest 14 (`--keep 30` to keep
more). Also copy backups off the server, for example nightly with cron on the host (`crontab -e`):

```cron
15 3 * * * cd /opt/venueatncc && docker compose exec -T app node server-dist/backup.mjs >> /var/log/venue-backup.log 2>&1 && docker compose cp app:/app/data/backups /opt/venue-backups
```

Then sync `/opt/venue-backups` somewhere else (another machine, Backblaze B2, S3, or your provider's
snapshot feature).

**Restore** a backup:

```sh
docker compose stop app
docker compose run --rm --no-deps -v /opt/venue-backups/backups:/restore app sh -c "cp /restore/venue-20261101-031500.db /app/data/venue.db && rm -f /app/data/venue.db-wal /app/data/venue.db-shm"
docker compose start app
```

## 7. Updating

```sh
cd /opt/venueatncc
docker compose exec app node server-dist/backup.mjs
git pull
docker compose up -d --build
```

Database changes (migrations) run automatically when the new version starts. Rates live in
`src/shared/pricing.ts` and venue facts in `src/data/site.ts`; after editing either, rebuild the same way.

## 8. Other hosts

Any host works if it runs one long-lived Node process (or this Docker image) with a **persistent disk**
for `/app/data`. Run a single instance: SQLite is one file on one disk.

- **Fly.io:** `fly launch` detects the Dockerfile. Create a volume (`fly volumes create venue_data --size 1`),
  mount it at `/app/data` in `fly.toml`, set the secrets with `fly secrets set SESSION_SECRET=... FORM_TOKEN_SECRET=... SMTP_PASS=...`,
  set `TRUST_PROXY=true` and `PUBLIC_ORIGIN`, and keep one machine. Fly handles HTTPS; add the domain with
  `fly certs add venueatncc.org` and use the DNS records it prints.
- **Render:** a Web Service from the Dockerfile with a persistent disk mounted at `/app/data` (a paid
  instance type is needed for disks). Set the environment variables in the dashboard, including
  `TRUST_PROXY=true`. Render handles HTTPS and shows the DNS records for the custom domain.
- **Railway:** deploy the repo (it uses the Dockerfile), attach a volume at `/app/data`, set the
  variables, and add the custom domain.
- **A server without Docker:** install Node 22, then `npm ci && npm run build`, and run
  `node server-dist/index.mjs` under systemd with the `.env` file, behind Caddy or nginx. A minimal unit:

  ```ini
  [Unit]
  Description=The Venue at NCC
  After=network.target

  [Service]
  WorkingDirectory=/opt/venueatncc
  Environment=NODE_ENV=production TRUST_PROXY=true HOST=127.0.0.1 UV_THREADPOOL_SIZE=8
  ExecStart=/usr/bin/node server-dist/index.mjs
  Restart=always
  User=venue

  [Install]
  WantedBy=multi-user.target
  ```

  The CLI tools run with `npx tsx server/cli/create-admin.ts ...` and `npx tsx server/cli/backup.ts`.

**Client addresses and rate limits.** Sign-in and booking-request limits count per client address, so
the app must see the real one. Set `TRUST_PROXY=true` only when exactly one proxy you control sits in
front of the app and the app is not reachable any other way (Compose does this: the app has no
published port). If a CDN such as Cloudflare sits in front of Caddy, add the CDN's address ranges to
the Caddyfile (`reverse_proxy app:8787 { trusted_proxies ... }`), or every visitor shares the CDN's few
addresses and one person's failed sign-ins lock out everyone.

**Slow clients.** The app ends a request whose headers take more than 10 seconds or whose whole request
takes more than 15, and the Caddyfile sets the same limits in front of it, so a client that trickles a
request cannot hold connections open for minutes.

Static-only hosts (GitHub Pages, Netlify, Cloudflare Pages, Vercel's static hosting) can serve the pages
but not the booking API, admin, or database. That is why the public demo uses the in-browser backend.

## 9. Local development

```sh
npm install
npm run dev        # site on http://localhost:4321, API on http://127.0.0.1:8787 (Astro proxies /api)
npm test           # server tests
```

Put `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to get an admin, or run `npm run admin:create`.
Without SMTP settings, emails land in `data/outbox/`. For a production-like run on your machine:
`npm run build && npm start` (reads `.env`; open http://localhost:8787).

## 10. Troubleshooting

- **Caddy cannot get a certificate:** DNS does not point at the server yet, or ports 80 and 443 are
  blocked. Check `nslookup venueatncc.org` and `docker compose logs caddy`.
- **"This request was blocked because it did not come from this website":** the address in the browser
  does not match `PUBLIC_ORIGIN`. Set `PUBLIC_ORIGIN` to exactly `https://venueatncc.org` (or your staging
  name) and run `docker compose up -d`.
- **The app will not start:** `docker compose logs app`. In production it refuses to start without
  `SESSION_SECRET` and `FORM_TOKEN_SECRET` (32 or more characters each).
- **Emails do not arrive:** look at the request's timeline in the admin, which shows each email as sent,
  saved to the outbox, or failed with the reason. Check the spam folder and the SPF, DKIM, and DMARC
  records from [section 1](#1-before-you-start-email).
- **Guests see "You have sent several requests already":** each address may send 5 requests an hour and
  20 a day (an IPv6 network counts as one address). This only affects repeated submissions from the
  same network. A retry of a request that already went through is not counted: it gets the same
  reference back.
- **"Too many sign-in attempts" for everyone at once:** the app is behind a proxy but `TRUST_PROXY` is
  false, so all visitors share one address. See [Client addresses](#8-other-hosts) above.
- **Mark Booked says the date "already has a ... block":** another calendar block covers one of the
  spaces the request asked for. Remove or change it on the calendar, then mark the request booked.
