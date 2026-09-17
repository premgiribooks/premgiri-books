# 100 - Rate Limiting & Brute-Force Protection

> Feature-spec file number 100 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 3 — Architecture
> Hardening**, tracker item **#91 Rate Limiting**.
>
> Depends On: `src/proxy.ts` (the existing Next.js middleware).

## Goal

Add a sliding-window in-memory rate limiter to the Next.js middleware layer to protect:
- The login endpoint from brute-force password attacks
- API routes from runaway loops or local-network automated scripts
- Report generation endpoints from expensive repeated queries

---

## Project Context

Read before implementation:

1. `src/proxy.ts` — the existing Next.js middleware; the rate limiter is added here.
2. `context-v3/architecture-context.md` — Decision 7 (Rate Limiting).
3. `context-v3/code-standards.md` — Rate Limiting Standards section.

---

## Module Responsibilities

- `src/middleware.ts` (rename/replace `src/proxy.ts`) — extended with rate-limit logic
- `src/config/rate-limits.ts` — configurable limits per route group
- `lru-cache` — sliding-window counter storage (in-memory, no DB)
- Pino logging for every rate-limit rejection

---

## Rate Limit Configuration

```typescript
// src/config/rate-limits.ts
export const RATE_LIMITS = {
  login: { windowMs: 60_000, max: 5 },          // 5 attempts / minute / IP
  api: { windowMs: 60_000, max: 100 },           // 100 requests / minute / IP
  reports: { windowMs: 60_000, max: 10 },        // 10 report requests / minute / user
  default: { windowMs: 60_000, max: 200 },       // catch-all
} as const;
```

---

## Business Rules

1. Rate limiting is applied per-IP for unauthenticated routes (login).
2. For authenticated routes, rate limiting is per-user-ID (extracted from session).
3. The report route limit (`/reports/**`) applies per authenticated user — not per IP.
4. A 429 response includes a `Retry-After` header (seconds until the window resets).
5. Rate limit state is lost on server restart — in-memory only, by design.
6. The `/administration/**` routes use the `api` limit (Platform Admin routes).

---

## Validation Rules

- If the client IP cannot be determined (no `x-forwarded-for` or `remoteAddress`),
  fall back to a shared "unknown-ip" bucket rather than skipping rate limiting.
- Rate limit errors must never expose internal implementation details in the response body.

---

## API Response

HTTP 429 Too Many Requests:
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 42
}
```

---

## UI

No UI changes. Users see a toast when a 429 is returned from a Server Action.
The existing error handling in each Server Action already surfaces server errors
as user-facing toasts — no new component is required.

---

## Security Considerations

- `lru-cache` is process-local — rate limits reset on Electron app restart. This is
  acceptable for a desktop app; the attack surface is a local office network.
- Do not use the `X-Forwarded-For` header from untrusted proxies without validation.
  Since this is an Electron app (no reverse proxy), use the direct connection address.
- Log every 429 at Pino `warn` level with: route, IP, current count, limit.

---

## Testing Requirements

- Login endpoint: 5 rapid requests succeed; 6th returns 429
- Login window reset: after window expires, requests succeed again
- Report endpoint: 10 requests succeed; 11th returns 429
- Retry-After header is present and positive
- Falling back to "unknown-ip" bucket does not throw

---

## v4 Supersession Note

In v4, this `lru-cache` in-memory rate limiter is **fully superseded** by the API
Gateway layer (spec 114 — API Gateway). The API Gateway enforces distributed rate
limiting across all microservice replicas using Redis token buckets.

The v3 implementation remains in place and active until the API Gateway is deployed
and verified. At that point, the middleware rate limiter is removed from `src/proxy.ts`
(or `src/middleware.ts`) as part of the v4 migration.

The `src/config/rate-limits.ts` configuration file introduced here is **not** migrated
to v4 — the API Gateway has its own configuration format. Document the v3 limit values
in the v4 API Gateway configuration notes (spec 114) for reference.
