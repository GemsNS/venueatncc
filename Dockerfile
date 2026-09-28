# The Venue at NCC: the static site and the API server in one image.
#
#   docker compose up -d --build        (see docs/deploy.md)
#
# Stages: deps (production node_modules), build (Astro site + server bundles), runtime (small, non-root).

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------------------------------------------------------------- production dependencies
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
# better-sqlite3 is native; these are only needed if its prebuilt binary cannot be downloaded.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------- build
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Site into dist/, server into server-dist/index.mjs.
RUN npm run build
# The admin and backup tools, so they run in the image without tsx.
RUN npx esbuild server/cli/create-admin.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/create-admin.mjs
RUN npx esbuild server/cli/backup.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=server-dist/backup.mjs

# ---------------------------------------------------------------- runtime
FROM ${NODE_IMAGE} AS runtime
# UV_THREADPOOL_SIZE: password hashing (scrypt) and file reads share libuv's thread pool; more
# threads keep pages fast while someone is signing in (the server also runs at most two hashes at once).
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    SITE_DIR=/app/dist \
    DATABASE_PATH=/app/data/venue.db \
    OUTBOX_DIR=/app/data/outbox \
    UV_THREADPOOL_SIZE=8
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
COPY package.json ./
# The database, outbox, and backups live in /app/data. Only that folder is writable by the app user.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server-dist/index.mjs"]
