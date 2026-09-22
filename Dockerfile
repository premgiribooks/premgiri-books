# Production web deployment image — NOT used by the Electron desktop build,
# which packages `.next/standalone` directly via electron-builder (see
# electron/server.ts, docs/release-process.md). This Dockerfile exists only
# for the self-hosted web deployment (docker-compose.prod.yml). The
# repo-root `docker-compose.yml` is a separate, unrelated local-dev setup
# (bind-mounts the source tree, NODE_ENV=development) that referenced this
# same filename before it existed — this file now also satisfies that.
#
# Three stages: `deps` installs pnpm packages (including Puppeteer's bundled
# Chromium, downloaded to .cache/puppeteer per .puppeteerrc.cjs) and
# generates the Prisma Client; `builder` runs `next build` +
# scripts/prepare-standalone.mjs (the same standalone-portability fixes the
# desktop build already depends on — dereferencing pnpm's dev-machine
# symlinks, fixing Prisma's Turbopack-externals `.prisma` sibling, etc. —
# deliberately NOT scripts/build-electron.mjs, which is Electron-only);
# `runner` is the slim final image that actually ships.
#
# Debian slim (not Alpine) is used throughout, not just for glibc/Prisma
# engine compatibility, but because Puppeteer's bundled Chromium needs
# real shared libraries (libnss3, libatk-bridge2.0-0, etc.) that Alpine's
# musl-based package set doesn't cleanly provide — the exact "residual,
# unaddressed risk on Linux" docs/release-process.md's PDF Generation
# section already flags for the Electron build; addressed here directly.
# src/lib/pdf-generation.ts already launches Chromium with
# `--no-sandbox --disable-setuid-sandbox`, so no extra container
# capabilities (SYS_ADMIN) are needed for headless PDF rendering to work.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

# Puppeteer's Chromium runtime dependency list (Debian/Ubuntu), per
# Puppeteer's own troubleshooting docs — installed in both `deps` (so the
# Chromium binary downloaded here is verifiably launchable) and `runner`
# (so it's launchable in the final image too; `deps`'/`builder`'s apt
# layers are discarded, they don't carry forward).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation wget xdg-utils \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 \
    libxkbcommon0 libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10 --activate

# .puppeteerrc.cjs must be present before `pnpm install` runs — its
# postinstall step is what actually downloads Chromium, and reads this
# file's `cacheDirectory` (overridden below to an absolute path anyway, so
# the download location is unambiguous regardless of WORKDIR).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .puppeteerrc.cjs ./
COPY prisma ./prisma

ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

FROM deps AS builder
WORKDIR /app
# .dockerignore excludes node_modules/.next/.git/.env from this context, so
# this does not clobber what `deps` already installed above.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# `next build` only needs DATABASE_URL to satisfy Prisma Client
# construction at import time (matches .github/workflows/release.yml's
# identical placeholder) — it never connects to a real database during a
# production build of this app's routes.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/premgiri_books?schema=public"
RUN pnpm run build:web

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation wget xdg-utils curl gnupg \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 \
    libxkbcommon0 libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

# backup-service.ts's scheduled/manual backups shell out to `pg_dump`
# (confirmed missing at runtime by an actual smoke-test container: every
# scheduled backup logged "spawn pg_dump ENOENT" until this was added).
# Debian bookworm's own repo only carries client 15, but the real
# production database (verified live: `SHOW server_version` = 18.2) needs
# a matching-or-newer pg_dump — an older client against a newer server is
# not reliably supported. Pull it from the official PostgreSQL APT
# repository (PGDG) instead of bookworm's default one.
RUN install -d /usr/share/postgresql-common/pgdg \
  && curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
       https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# /app/public/uploads (company-logo-service.ts) and /app/backups
# (backup-service.ts, BACKUP_DIR) hold real user data written at runtime —
# pre-created here so a fresh container has correct ownership, but they
# must be bind-mounted/volume-mounted in docker-compose.prod.yml or every
# redeploy silently discards uploaded logos and backup files.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/public/uploads/logos /app/backups \
  && chown -R nextjs:nodejs /app

# `.next/standalone` is already fully self-contained (its own server.js +
# vendored node_modules, produced by scripts/prepare-standalone.mjs) — the
# same artifact the Electron build spawns as a child process, proven
# portable off the build machine already.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.cache ./.cache
COPY --from=builder --chown=nextjs:nodejs /app/.puppeteerrc.cjs ./

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
