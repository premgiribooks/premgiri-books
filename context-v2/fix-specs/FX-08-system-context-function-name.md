# FX-08 — `resolveSystemContext()` Name Mismatch

**Severity:** MEDIUM  
**Found in:** `src/lib/system-context.ts`  
**Resolving spec:** v3 spec 105 — SystemContext Adoption Retrofit

---

## What Was Found

The function that composes user + company + financial-year context is exported as
`resolveSystemContext()` in the real codebase:

```typescript
// src/lib/system-context.ts — line 42 (verified)
export async function resolveSystemContext(): Promise<SystemContext> {
  // ...
}
```

However, the v3 spec 105 retrofit plan (`context-v3/feature-specs/105-system-context-retrofit.md`)
consistently refers to this function as `getSystemContext()`, and the v3
`architecture-context.md` Decision 8 writes:

> "The legacy `getCurrentUser()`, `getCurrentCompanyUser()`, and `getCurrentCompany()`
> helpers are deprecated. After spec 105 is complete, those functions remain in place
> but call through to `SystemContext` internally."

The code-standards section also consistently uses `getSystemContext()` in all examples.

---

## Why It Is a Problem

**Naming inconsistency:** Developers implementing v3 specs will follow the spec examples
and write `getSystemContext()` calls, but the function does not exist by that name. This
will cause TypeScript compilation errors and confusion.

**Convention:** The existing `getCurrentUser()`, `getCurrentCompany()`, and
`getCurrentFinancialYear()` all use the `get*` prefix. `resolveSystemContext()` uses
`resolve*` — inconsistent with the established naming pattern.

---

## What Must Change

Add `getSystemContext` as an alias export in `src/lib/system-context.ts`. This is a
one-line additive change — no behavior change, no breaking change:

```typescript
// src/lib/system-context.ts — add after the existing resolveSystemContext():

/**
 * Alias for resolveSystemContext() — use this in all new v3+ code.
 * Named getSystemContext() to match the get* convention used by getCurrentUser(),
 * getCurrentCompany(), etc.
 */
export const getSystemContext = resolveSystemContext;
```

Both names are exported so that any existing code calling `resolveSystemContext()`
continues to work. New v3 code uses `getSystemContext()`.

Update all v3 spec examples and spec 105's "Retrofit Pattern" section to use
`getSystemContext()` — this is already done in spec 105's amended form.

---

## Acceptance Criteria

- [ ] `src/lib/system-context.ts` exports `getSystemContext` (as an alias for `resolveSystemContext`)
- [ ] `getSystemContext()` and `resolveSystemContext()` return the same result
- [ ] All existing callers of `resolveSystemContext()` continue to work
- [ ] New v3 service code uses `getSystemContext()`, not `resolveSystemContext()`
- [ ] TypeScript: `typeof getSystemContext === typeof resolveSystemContext` (same function signature)
