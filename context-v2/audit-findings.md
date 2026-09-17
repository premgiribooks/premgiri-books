# Audit Findings — Milestone v2 Codebase

This table is the master index of all findings from the real-code audit.
Each finding has a severity, a fix-spec file, and a cross-reference to the v3/v4
spec that owns the resolution.

---

## Findings Table

| ID | Severity | Title | File(s) | v3/v4 Spec | Fix Spec |
|---|---|---|---|---|---|
| FX-01 | BLOCKER | Global Prisma singleton incompatible with v4 per-tenant model | `src/lib/prisma.ts` | v3 Bridge Decision A / v4 spec 126 | FX-01 |
| FX-02 | HIGH | 114 files use legacy auth helpers instead of SystemContext | `src/modules/**/*-service.ts` | v3 spec 105 | FX-02 |
| FX-03 | HIGH | `src/proxy.ts` has no rate limiting | `src/proxy.ts` | v3 spec 100 | FX-03 |
| FX-04 | HIGH | Missing `src/config/rate-limits.ts` and `src/config/env.ts` | `src/config/` | v3 specs 100, 101, 110a | FX-04 |
| FX-05 | HIGH | Missing `src/engines/external-integrations/` engine | `src/engines/` | v3 specs 94, 95 | FX-05 |
| FX-06 | HIGH | `sales-invoice-service.ts` imports auth helpers internally | `src/modules/sales-invoices/services/sales-invoice-service.ts` | v3 spec 105 / v4 spec 118 | FX-06 |
| FX-07 | HIGH | `company-service.ts` imports three auth helpers directly | `src/modules/company/services/company-service.ts` | v3 spec 105 / v4 spec 116 | FX-07 |
| FX-08 | MEDIUM | `resolveSystemContext()` name mismatch — spec 105 references `getSystemContext()` | `src/lib/system-context.ts` | v3 spec 105 | FX-08 |

---

## Severity Definitions

| Severity | Meaning |
|---|---|
| **BLOCKER** | Prevents v4 migration without a breaking change; must be fixed in v3 |
| **HIGH** | Violates a v3 standard or will cause a v4 migration problem |
| **MEDIUM** | Code quality issue; does not block migration but should be fixed in v3 |
| **LOW** | Documentation gap or style issue |

---

## Summary by Milestone

### Must Fix in v3
- FX-01 (BLOCKER) — Prisma singleton: new services in v3 use injected DB
- FX-02 (HIGH) — Legacy auth helpers: retrofitted in spec 105
- FX-03 (HIGH) — No rate limiting: fixed in spec 100
- FX-04 (HIGH) — Missing config files: fixed in specs 100, 101, 110a
- FX-05 (HIGH) — Missing engine: fixed in specs 94/95
- FX-06 (HIGH) — Sales invoice auth coupling: fixed in spec 105 (Pattern B)
- FX-07 (HIGH) — Company service auth coupling: fixed in spec 105 (Pattern B)
- FX-08 (MEDIUM) — `resolveSystemContext()` rename: fixed in spec 105

### Deferred to v4
None of the above findings are deferred — all are addressed in v3. v4 then removes
the singleton at the call site (spec 126 — Prisma Multitenant) and migrates auth
to JWT (spec 133).
