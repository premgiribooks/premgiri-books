# FX-03 — `src/proxy.ts` Has No Rate Limiting

**Severity:** HIGH  
**Found in:** `src/proxy.ts`  
**Resolving spec:** v3 spec 100 — Rate Limiting & Brute-Force Protection

---

## What Was Found

`src/proxy.ts` (the Next.js middleware, renamed from `middleware.ts` in Next.js 16)
handles authentication and session management but contains **no rate limiting logic**:

```typescript
// src/proxy.ts — current state (summarized):
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_KEYS.SESSION_TOKEN)?.value;
  const session = token ? await getSessionWithUser(token) : null;
  // ... route guards ...
  // ... session renewal ...
  // NO rate limiting anywhere in this file
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
```

The login endpoint (`/login` → the Server Action it calls) is entirely unprotected
against brute-force password attacks.

---

## Why It Is a Problem

**Security gap:** The absence of rate limiting on the login endpoint allows unlimited
password-guessing attempts. Even in a local office network, a compromised local machine
or an insider threat can automate login attempts with no impediment.

**v3 standard violation:** `context-v3/architecture-context.md` Decision 7 requires
in-memory rate limiting on login, API, and report endpoints.

---

## What Must Change

See spec 100 (`context-v3/feature-specs/100-rate-limiting.md`) for the complete
implementation plan.

**Summary of changes to `src/proxy.ts`:**

1. Import `lru-cache` and create per-route-group sliding-window counters.
2. Read rate-limit configuration from the new `src/config/rate-limits.ts` file (FX-04).
3. At the start of `proxy()`, before session validation:
   - Extract IP from `request.ip` or `request.headers.get("x-forwarded-for")` (fall
     back to `"unknown-ip"` if absent).
   - Look up the route group (`login`, `api`, `reports`, `default`).
   - Increment the counter. If over limit, return HTTP 429 with `Retry-After` header.
4. Add `/health/**` to the rate-limiter bypass list (spec 110a requirement).

**Note on file rename:** The comment in `src/proxy.ts` already documents that this file
is what v2 architecture docs called `middleware.ts`. The rate-limiter addition does not
require renaming the file — it is added to `src/proxy.ts` as-is. The spec 100 mention
of "rename to `src/middleware.ts`" is optional; keep `proxy.ts` to avoid a Next.js 16
breaking change.

---

## Acceptance Criteria

- [ ] Login endpoint: 5 rapid requests succeed; 6th returns HTTP 429
- [ ] HTTP 429 response includes `Retry-After` header (positive integer, seconds)
- [ ] `/health/**` routes return 200, never 429
- [ ] Rate limit state is in-memory only (lost on restart) — no DB dependency
- [ ] Every 429 is logged at Pino `warn` level with route, IP, count, and limit
