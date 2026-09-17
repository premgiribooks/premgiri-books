# 110a - Health Endpoints

> Feature-spec file number 110a (v3 bridge sequence).
> This feature is in **Phase 3 — Architecture Hardening** (inserted alongside spec 100
> rate limiting as a prerequisite for v4 migration).
> Tracker item: **#101 Health Endpoints**.
>
> Depends On: Next.js App Router; `src/lib/prisma.ts` (DB reachability check).
>
> This is a v3/v4 bridge spec — see `context-v3/architecture-context.md` Bridge
> Decision C and `context-v3/v4-bridge-analysis.md`.

## Goal

Expose three health-check HTTP routes from the Next.js application:

- `GET /health/live` — liveness: the process is running (always HTTP 200)
- `GET /health/ready` — readiness: the database is reachable and accepting queries
- `GET /health/startup` — startup: all required environment variables are present and
  the database connection pool is initialized

In v3 these routes serve:
- The Electron main process, which pings `/health/ready` before opening the app window.
- Any external monitoring tool (Uptime Robot, Grafana Agent) configured by the
  deployment team.

In v4 these routes become the exact targets for Kubernetes liveness, readiness, and
startup probe configuration in the Helm chart (spec 111 — Kubernetes Cluster Setup).

---

## Project Context

Read before implementation:

1. `context-v3/architecture-context.md` — Bridge Decision C (Health Endpoints).
2. `src/lib/prisma.ts` — the global PrismaClient; used in the readiness check.
3. `context-v4/feature-specs/111-kubernetes-cluster-setup.md` — describes how these
   routes are consumed as K8s probes in v4.

---

## Module Responsibilities

- `src/app/health/live/route.ts` — liveness probe route handler
- `src/app/health/ready/route.ts` — readiness probe route handler
- `src/app/health/startup/route.ts` — startup probe route handler
- No new library dependencies — use Next.js Route Handlers only

---

## Route Specifications

### GET /health/live

Always returns HTTP 200. No database access. No authentication required.

```json
{ "status": "ok", "timestamp": "2025-01-15T10:00:00.000Z" }
```

---

### GET /health/ready

Performs a minimal database query (`SELECT 1`) to verify the connection pool is
reachable. Returns HTTP 200 if the query succeeds, HTTP 503 if it fails.

HTTP 200:
```json
{
  "status": "ok",
  "checks": {
    "database": "ok"
  },
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

HTTP 503:
```json
{
  "status": "unavailable",
  "checks": {
    "database": "error"
  },
  "error": "Database connection failed",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

---

### GET /health/startup

Verifies:
1. All required environment variables are defined (use the list from
   `src/config/env.ts` — spec 101; if that file does not exist yet, enumerate
   `DATABASE_URL`, `NEXTAUTH_SECRET`, `COOKIE_KEYS`).
2. The database connection pool can be acquired (same `SELECT 1` as readiness).

HTTP 200:
```json
{
  "status": "ok",
  "checks": {
    "env": "ok",
    "database": "ok"
  },
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

HTTP 503:
```json
{
  "status": "unavailable",
  "checks": {
    "env": "error",
    "database": "ok"
  },
  "missingEnv": ["NEXTAUTH_SECRET"],
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

---

## Business Rules

1. All three routes are **unauthenticated** — no session cookie or JWT is required.
2. All three routes are **excluded from rate limiting** — they must never return 429.
   Add `/health/**` to the rate-limiter bypass list in `src/config/rate-limits.ts`.
3. The response body must never include stack traces or internal error messages —
   use fixed string codes only (`"ok"` / `"error"`).
4. The `database` check in `/health/ready` must time out after **2 seconds** — if the
   DB does not respond in 2 seconds, return 503 rather than hanging.
5. These routes must not be cached — set `Cache-Control: no-store` on all responses.

---

## Security Considerations

- No sensitive information (connection strings, passwords, internal paths) may appear
  in any health route response body.
- The routes must remain accessible from within the Kubernetes cluster network even
  when the external load balancer blocks unauthenticated traffic — configure the
  Ingress (v4) to allow `/health/**` from internal IPs only.

---

## v4 Kubernetes Probe Mapping

| Route | K8s Probe Type | Failure Action |
|---|---|---|
| `/health/live` | livenessProbe | Restart container |
| `/health/ready` | readinessProbe | Remove from load-balancer pool |
| `/health/startup` | startupProbe | Delay liveness/readiness checks |

See `context-v4/feature-specs/111-kubernetes-cluster-setup.md` for the exact
`initialDelaySeconds`, `periodSeconds`, and `failureThreshold` values.

---

## Testing Requirements

- `/health/live`: always returns 200 with `{ status: "ok" }` body
- `/health/ready`: returns 200 when DB is up; returns 503 when DB is unreachable
  (test by mocking the Prisma `$queryRaw` to throw)
- `/health/startup`: returns 503 when a required env var is unset
- Timeout: a DB call that hangs longer than 2s resolves to 503, not a timeout exception
- No 401/403: routes are accessible without session cookie
- Rate limiter: `/health/live` is not counted against the rate-limit bucket
