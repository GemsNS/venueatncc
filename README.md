# The Venue @ NCC

Website and booking system for **The Venue @ NCC** (venueatncc.org), an event venue at
5112 Godwin Blvd, Suffolk, VA 23434.

Deploying to production: see [docs/deploy-gcloud-apache.md](docs/deploy-gcloud-apache.md), the runbook
for the shared Google Cloud server (Apache, pm2, certbot).

- A fast, search-optimized marketing site designed after Apple's Human Interface Guidelines, in a pastel pink palette (Blush and Petal surfaces, Berry accents, Plum text) with full dark mode.
- A live availability calendar, instant price estimates, and a four-step booking request.
- The venue's own backend: an API server with a SQLite database, email notifications, and a staff admin app. No third-party form services.
- A static demo of everything on GitHub Pages, where bookings and the admin run in the browser with sample data.

## Quick start

```sh
npm install
npm run dev          # site at http://localhost:4321 and the API at http://localhost:8787, together
```

Requires Node 22.12 or newer. Without SMTP settings, emails are written to `data/outbox/` so you can read them.

| Command | What it does |
| --- | --- |
| `npm run dev` | Site and API together, with live reload |
| `npm run build` | Production build: static site in `dist/`, API server in `server-dist/` |
| `npm start` | Run the production server (serves the site and the API) |
| `npm run build:demo` | Static GitHub Pages demo in `dist-demo/` |
| `npm run preview:demo` | Preview the demo build locally |
| `npm test` | API server and demo backend tests |
| `npm run check` | Type-check the whole project |
| `npm run admin:create -- --email you@example.com --name "Your Name"` | Create or reset an admin |

## How it fits together

```
Browser                               Production server (Node)                 Storage
Astro pages (static HTML)  ─────────▶  serves dist/ with security headers
Preact islands:                        Hono API  /api/*  ────────────────────▶  SQLite (data/venue.db)
  booking wizard, calendar,  ◀──JSON──   availability, inquiries, admin        Email via SMTP
  estimator, capacity planner,           sessions, rate limits, validation     (or data/outbox/)
  admin app
```

- `src/shared/` is used by both the browser and the server: types, validation (zod), availability,
  pricing and estimates, capacity rules, dates, CSV export. The server always re-validates and
  recomputes estimates.
- `src/lib/api/` is the client. `http.ts` talks to the server. `demo.ts` is an in-browser twin used
  only by the GitHub Pages demo (`PUBLIC_DEMO=true`).
- `server/` is the API: Hono, better-sqlite3, nodemailer, scrypt passwords, hashed session tokens,
  origin checks, per-IP rate limits, a signed minimum-fill-time token and honeypot against spam.

## Where to change things

| What | File |
| --- | --- |
| Every venue fact (phone, email, capacity, policies, what is included) | `src/data/site.ts` |
| Rates, packages, fees, deposits, discounts, founding offer | `src/shared/pricing.ts` |
| Events (one block each on /events/) | `src/data/events.ts` |
| Questions and answers on Rates & FAQ (answer the `a: null` ones to publish them) | `src/data/faq.ts` |
| Photos | `src/assets/venue/` plus `src/data/photos.ts` |
| Design tokens (colors, type, radii, glass) | `src/styles/global.css` |
| Brand: palette, logo, photo rule, voice (binding) | `docs/design/brand.md` |
| Interaction rules we follow | `docs/design/hig-web-spec.md` |
| Production deployment on the shared Google Cloud VM (Apache, pm2, certbot) | `docs/deploy-gcloud-apache.md` |
| Generic deployment (Docker, Caddy), DNS, SMTP, backups | `docs/deploy.md` |

Change a rate in `pricing.ts` and the pricing page, every estimate, the booking wizard, the
confirmation emails, and the structured data all update.

### Facts that are still assumptions

- The email is assumed to be `faith@venueatncc.org`.
- Catering is not included. The site says so only in one FAQ entry.
- "Request a visit", and The Fireside Room and The Pine Garden booked together, are offered as requests that the team confirms.
- Rates are **recommended** from a study of 59 Hampton Roads venues. Confirm them before launch.
- Unanswered in `faq.ts`: tables and chairs, decorating and setup times, accessibility, cancellation,
  insurance.

## Photos

Every image in `src/assets/venue/` is published, so keep reference-only images elsewhere.
Use originals at least 1600px on the long edge, and describe each one in `photoDetails` in
`src/data/photos.ts` (see `src/assets/venue/README.md`).

One rule, enforced in code (`docs/design/brand.md`, Photography): real photographs show the spaces, one
photograph per subject (`SUBJECT_PHOTO` in `src/data/photos.ts`; the other real photos are kept but marked unused),
and staged photographs show events. The event blocks on /events/ use `styled-event-<slug>.jpg`
only when all eight staged files are present (`eventsStaged`); otherwise they show no photo. Photos are cropped to their frames and converted to AVIF and WebP at build time.

## Before launch

1. **Block existing bookings** in the admin calendar. Until you do, every future date shows as open.
2. Confirm the rates, the email address, and the unanswered FAQs.
3. Configure SMTP for the venue mailbox and send a test inquiry.
4. Deploy the server (see `docs/deploy.md`) and point venueatncc.org at it. The domain currently
   points to a GoDaddy Website Builder page.
5. Verify the domain in Google Search Console, submit `sitemap-index.xml`, and create a Google
   Business Profile with exactly the same name, address, and phone.

## The GitHub Pages demo

`npm run build:demo` builds the whole site with `PUBLIC_DEMO=true` and base `/venueatncc/`.
Every page is `noindex` and robots.txt disallows everything, so the demo never competes with the real
site in search. Booking requests and the admin use `localStorage` with sample data, and nothing is
sent anywhere. Demo admin sign-in is shown on the admin login screen. The workflow in
`.github/workflows/pages.yml` deploys it on every push to `main`.
