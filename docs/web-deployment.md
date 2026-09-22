# Self-hosted web deployment

A second, independent distribution channel alongside the Electron desktop
app (see `docs/release-process.md`) — same Next.js application, same
`output: "standalone"` build, no application code differences (confirmed:
nothing in `src/` branches on Electron vs. web; only the `electron/`
directory and `scripts/build-electron.mjs` are Electron-specific). Runs via
Docker on a VPS you control, fronted by Caddy for automatic HTTPS.

**Explicit decisions this setup is built around (2026-09-22):**
- Self-hosted on your own VPS, not a managed platform (Vercel etc.).
- Points at the **same live LAN Postgres database** the desktop app already
  uses (`192.168.1.39`), exposed to the internet for this purpose — not a
  separate cloud database. This means the web deployment and every desktop
  install share one, single, real dataset. Treat the network-exposure step
  below with real care; it is the one part of this setup with a genuinely
  different risk profile than anything else in this project.

## Files involved

- `Dockerfile` — production image. Multi-stage: `deps` (pnpm install +
  Puppeteer's Chromium download + `prisma generate`), `builder` (`next
  build` + `scripts/prepare-standalone.mjs` via the new `pnpm build:web`
  script — deliberately skips `scripts/build-electron.mjs`, which is
  Electron-only), `runner` (slim final image, non-root user, Postgres 18
  client tools for backups, Chromium's runtime shared libraries for PDF
  generation).
- `docker-compose.prod.yml` — runs the app container (no published port)
  behind a Caddy reverse proxy (published on 80/443). Named volumes persist
  uploaded company logos and local backup files across redeploys.
- `Caddyfile` — reverse proxy + automatic Let's Encrypt certificate. Edit
  the placeholder domain before first deploy.
- `.env.production.example` — copy to `.env.production` on the VPS (never
  commit the real file) and fill in real values.

**Verified working end-to-end in this session** (build machine had Docker
available): the image builds clean, a container boots against a real
Postgres, `next build`'s route table generates correctly, unauthenticated
requests correctly 307-redirect to `/login`, and — after one fix during
this same verification pass — the scheduled backup job's `pg_dump` call
succeeds against the actual production server version (18.2). **Not yet
verified**: an actual deploy on your VPS, the public domain/TLS path
through Caddy, or a live PDF-generation request end-to-end (Chromium's
presence and `--no-sandbox` launch were confirmed by inspection and the
image's dependency install, not by rendering a real PDF in the test
container).

## 1. Prerequisites

- A VPS (Ubuntu 22.04/24.04 or Debian 12 recommended) with Docker Engine +
  the Docker Compose plugin installed (`docker compose version` should
  work — not the standalone `docker-compose` v1 binary).
- A domain name, with an **A record** pointing at the VPS's public IPv4
  address. Caddy needs this to actually resolve before it can provision a
  certificate.
- Ports 80 and 443 open on the VPS's own firewall (`ufw allow 80,443/tcp`
  or your provider's equivalent) — Caddy needs both (80 for the ACME HTTP
  challenge and redirect-to-HTTPS, 443 for the site itself).

## 2. Exposing the LAN Postgres instance — do this carefully

The database lives on your own network at `192.168.1.39`, not reachable
from the internet today. Making it reachable from the VPS needs both a
network-level change (your router) and a database-level change (Postgres
itself). Do **all** of the following, not just the port-forward — skipping
any one of these turns "reachable from one specific VPS" into "reachable
by anyone on the internet who finds the port":

1. **Get the VPS's IP address** (`curl -4 ifconfig.me` on the VPS, or your
   provider's dashboard). You'll restrict access to exactly this IP.
2. **On your router/firewall**, forward external port 5432 to
   `192.168.1.39:5432` — but scope the rule to source IP = the VPS's IP
   only, not "any." Most business-grade routers and firewalls (pfSense,
   OPNsense, most managed switches/routers with ACLs) support a
   source-restricted forwarding/NAT rule directly. If your router genuinely
   can't restrict by source IP, do **not** open it to everyone — use a
   WireGuard/OpenVPN tunnel between the VPS and your LAN instead, and skip
   the port-forward entirely (ask for help setting this up if your router
   lacks source-IP filtering; it's a materially safer path than an
   unrestricted 5432 exposure).
3. **On the Postgres server itself**, edit `pg_hba.conf` to allow the VPS's
   IP specifically to connect (a `hostssl` line naming that one IP/32, not
   `0.0.0.0/0`), then reload Postgres (`SELECT pg_reload_conf();` or a
   service restart).
4. **Enable TLS on Postgres** if it isn't already (`ssl = on` in
   `postgresql.conf`, with a certificate) — without it, `premgiri_books`'s
   password and every query's data cross the public internet in cleartext
   between the VPS and your LAN. Once enabled, `.env.production`'s
   `DATABASE_URL` should include `sslmode=require`.
5. **Verify from the VPS itself** (not from this dev machine) once DNS/
   firewall changes have propagated:
   ```
   psql "postgresql://premgiri_books:<password>@<your-domain-or-static-ip>:5432/premgiribooks?sslmode=require" -c "select 1;"
   ```
   If this doesn't work from the VPS, nothing above it will either — fix
   this first before deploying the app.
6. If your home/office internet connection doesn't have a **static public
   IP**, set up a dynamic DNS hostname (e.g. via your router's built-in
   DDNS client, or a service like DuckDNS) pointing at your current WAN IP,
   and use that hostname in step 3/`DATABASE_URL` instead of a raw IP that
   can silently change.

## 3. First deploy

On the VPS:

```bash
git clone https://github.com/premgiribooks/premgiri-books.git
cd premgiri-books

cp .env.production.example .env.production
nano .env.production     # fill in DATABASE_URL, SEED_ADMIN_PASSWORD, SEED_SUPER_ADMIN_PASSWORD

nano Caddyfile            # replace your-domain.example.com with your real domain

docker compose -f docker-compose.prod.yml up -d --build
```

First build takes a few minutes (Chromium download, `next build` over the
full route table). Watch it:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Once the `app` container is healthy, visit `https://your-domain.example.com`
— Caddy provisions the certificate automatically on first request. If it
doesn't come up, check `docker compose -f docker-compose.prod.yml logs caddy`
first (almost always a DNS-not-propagated-yet or port-80-blocked issue).

The database schema itself does **not** need a fresh `prisma migrate
deploy` run here — you're pointing at the existing, already-migrated LAN
database, not a new one.

## 4. Redeploying after a code change

```bash
cd premgiri-books
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

Uploaded logos and local backup files survive this (named volumes) — only
the application code and node_modules are rebuilt.

## 5. Known gaps / things to verify yourself

- **PDF generation was verified by dependency inspection, not by actually
  rendering one.** If a PDF download fails only on the VPS (never in dev),
  check `docker compose -f docker-compose.prod.yml logs app` for a
  Puppeteer/Chromium launch error first.
- **A real, pre-existing migration bug was found while verifying this
  setup**, unrelated to this deployment work — `prisma migrate deploy`
  against a genuinely empty database fails partway through
  (`20260918043848_payment_mode_integration_sales`, a `PaymentModeLedgerClass`
  enum cast error in a data-backfill statement). This doesn't block you,
  since you're pointing at the existing already-migrated database, not a
  fresh one — but it means a from-scratch disaster-recovery restore (a new
  empty database replaying the full migration history) would currently
  fail partway through. Worth fixing separately; not part of this task.
- **Unsigned/no rate-limiting/no WAF** — this is a bare Caddy reverse
  proxy, nothing more. Consider Cloudflare (or similar) in front of it if
  this will be a genuinely public-facing login page, for basic DDoS/bot
  protection.
