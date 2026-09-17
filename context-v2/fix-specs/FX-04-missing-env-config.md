# FX-04 — Missing Config Files

**Severity:** HIGH  
**Found in:** `src/config/` (directory scan)  
**Resolving specs:**
- `src/config/rate-limits.ts` → v3 spec 100
- `src/config/env.ts` → v3 spec 101 / spec 110a

---

## What Was Found

`src/config/` contains only two files:

```
src/config/
├── app-settings.ts    ← app name, version, window config
└── navigation.ts      ← sidebar navigation structure
```

The following files are referenced in v3 specs but do not yet exist:

| Missing File | Referenced By | Purpose |
|---|---|---|
| `src/config/rate-limits.ts` | spec 100, FX-03 | Per-route rate limit configuration |
| `src/config/env.ts` | spec 101, spec 110a (health startup probe) | Required environment variable registry |

---

## Why It Is a Problem

**`src/config/rate-limits.ts`:** The rate-limiter in `src/proxy.ts` (FX-03) requires
a centralized configuration object. Without it, limits would be hardcoded in `proxy.ts`,
making them harder to review, adjust, or document.

**`src/config/env.ts`:** The startup health probe (`/health/startup`, spec 110a) must
enumerate required environment variables and verify their presence at boot. Without a
canonical registry, the probe has no source of truth — it must either hardcode the list
or duplicate logic from `prisma.ts` (which already throws if `DATABASE_URL` is missing).

---

## What Must Change

### `src/config/rate-limits.ts` (created in spec 100)

```typescript
export const RATE_LIMITS = {
  login:   { windowMs: 60_000, max: 5   },  // 5 attempts / minute / IP
  api:     { windowMs: 60_000, max: 100 },  // 100 requests / minute / IP
  reports: { windowMs: 60_000, max: 10  },  // 10 report requests / minute / user
  default: { windowMs: 60_000, max: 200 },  // catch-all
} as const;

export type RateLimitGroup = keyof typeof RATE_LIMITS;
```

The file is imported by `src/proxy.ts` and by health-check tests.

---

### `src/config/env.ts` (created in spec 101 / spec 110a)

```typescript
/**
 * Required environment variables.
 * The startup health probe reads this list to verify all are present.
 * Any new required env var must be added here alongside its first consumer.
 */
export const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "COOKIE_KEYS",
] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Returns the names of any required env vars that are missing or empty.
 */
export function getMissingEnvVars(): RequiredEnvVar[] {
  return REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ""
  );
}
```

The file is imported by `src/app/health/startup/route.ts` (spec 110a).

---

## Acceptance Criteria

- [ ] `src/config/rate-limits.ts` exists and exports `RATE_LIMITS` and `RateLimitGroup`
- [ ] `src/config/env.ts` exists and exports `REQUIRED_ENV_VARS` and `getMissingEnvVars()`
- [ ] `DATABASE_URL`, `NEXTAUTH_SECRET`, and `COOKIE_KEYS` are in `REQUIRED_ENV_VARS`
- [ ] `getMissingEnvVars()` returns an empty array when all vars are set
- [ ] `getMissingEnvVars()` returns the missing var names when one is unset
