# FX-02 — Legacy Auth Helpers Used in 114 Files

**Severity:** HIGH  
**Found in:** `src/modules/**/*-service.ts` (114 files)  
**Resolving spec:** v3 spec 105 — SystemContext Adoption Retrofit

---

## What Was Found

A grep for `getCurrentUser|getCurrentCompanyUser|getCurrentCompany|getCurrentSuperAdmin`
across `src/modules/` returned **114 files with matches**. The full list is documented
in `context-v2/codebase-map.md`.

Representative example — `src/modules/sales-invoices/services/sales-invoice-service.ts`:
```typescript
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
// ... used internally in service methods
```

Representative example — `src/modules/company/services/company-service.ts`:
```typescript
import { getCurrentCompanyUser, getCurrentSuperAdmin, getCurrentUser } from "@/lib/current-user";
```

---

## Why It Is a Problem

**Microservice extraction blocker:** When services internally resolve their own auth
context, they have an implicit dependency on the Next.js request/response cycle
(`cache()`, `cookies()`). This makes them impossible to move to a standalone microservice
process — microservices have no Next.js request context.

**v3 standard violation:** Bridge Decision A + the Context-as-Parameter rule in
`context-v3/ai-workflow-rules.md` require new services to receive context as a
constructor parameter. Existing services must be retrofitted in spec 105.

---

## Exact Count (Verified by grep)

```
114 files with matches in src/modules/
```

Note: The count includes test files (`.test.ts`) which also call these helpers to set
up test mocks — test files are exempt from the retrofit (they may continue to use
test-setup helpers that simulate auth context, not the same functions as production).

**Production service files to retrofit:** ~50 service files (non-test).

---

## What Must Change

See spec 105 (`context-v3/feature-specs/105-system-context-retrofit.md`) for the full
retrofit plan and both patterns (Pattern A — standalone function, Pattern B — class).

**Summary:**
1. Grep for all production service files importing legacy helpers.
2. For each: apply Pattern A (simple replacement of call) or Pattern B (constructor injection).
3. Mark `getCurrentUser()`, `getCurrentCompanyUser()`, `getCurrentCompany()`, and
   `getCurrentSuperAdmin()` as `@deprecated` in `src/lib/current-user.ts` — do not delete.
4. The deprecated functions are kept as wrappers that delegate to `getSystemContext()` /
   `resolveSystemContext()` internally.

---

## Priority Order for Retrofit

Retrofit the highest-impact services first (those used by the most callers):

1. `sales-invoice-service.ts` — called from multiple actions (see FX-06)
2. `company-service.ts` — called from administration and company setup (see FX-07)
3. `purchase-invoice-service.ts` — high-traffic module
4. `ledger-service.ts` — shared by accounting and GST
5. All remaining 46 services in alphabetical order

---

## Acceptance Criteria

- [ ] Grep for `getCurrentUser(` and `getCurrentCompanyUser(` in `src/modules/` (production files only) returns zero matches
- [ ] Legacy functions remain in `src/lib/current-user.ts` with `@deprecated` JSDoc
- [ ] All existing tests pass without modification
