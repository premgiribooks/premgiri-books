# 105 - SystemContext Adoption Retrofit

> Feature-spec file number 105 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 4 — Code Quality**,
> tracker item **#96 SystemContext Retrofit**.
>
> Depends On: `src/lib/system-context.ts` (already implemented in v2).
> Can be worked concurrently with Phase 3 items.

## Goal

Migrate the approximately 15 pre-migration services that still call
`getCurrentUser()`, `getCurrentCompanyUser()`, and `getCurrentCompany()` directly
to use the unified `SystemContext` pattern instead.

This is a pure consistency refactor — no behavior changes, no new features.

---

## Project Context

Read before implementation:

1. `src/lib/system-context.ts` — the `SystemContext` type and `getSystemContext()`
   function. Read the full file — this is the target pattern.
2. `context/architecture-context.md` (v2) — Known Gap #6 (SystemContext adoption incomplete).
3. `context-v3/architecture-context.md` — Decision 8 (SystemContext as universal standard).
4. `context-v3/code-standards.md` — SystemContext Standard section.

---

## Services to Retrofit

The following services are known to use the legacy helpers directly. Verify by grep
before starting — there may be more:

| Service | File |
|---|---|
| bank-account-service | `src/modules/bank-accounts/services/bank-account-service.ts` |
| ledger-service | `src/modules/ledgers/services/ledger-service.ts` |
| ledger-group-service | `src/modules/ledger-groups/services/ledger-group-service.ts` |
| financial-year-service | `src/modules/financial-year/services/financial-year-service.ts` |
| company-settings-service | `src/modules/company/services/company-settings-service.ts` |
| user-service | `src/modules/users/services/user-service.ts` |
| role-service | `src/modules/roles/services/role-service.ts` |
| permission-service | `src/modules/roles/services/permission-service.ts` |
| profile-service | `src/modules/profile/services/profile-service.ts` |

And any others found by:
```
grep -r "getCurrentUser\|getCurrentCompanyUser\|getCurrentCompany" src/modules
```

---

## Retrofit Pattern

This spec applies **two distinct patterns** depending on the location of the call:

### Pattern A — Standalone function (existing code)

The legacy pattern calls `getSystemContext()` or `getCurrentCompanyUser()` inside the
function body. After retrofit, the call remains but is replaced with `getSystemContext()`:

Before:
```typescript
async function getMyData(id: string) {
  const user = await getCurrentCompanyUser();
  assertPermission(user, "ledgers", "view");
  ...
}
```

After (Pattern A):
```typescript
async function getMyData(id: string) {
  const ctx = await getSystemContext();
  assertPermission(ctx.user, "ledgers", "view");
  const company = ctx.assertCompany();
  ...
}
```

### Pattern B — Service class (new code in v3 or retrofit of complex services)

For service classes, the preferred v4-ready form is the **Context-as-Parameter** DI
pattern where `SystemContext` is passed in rather than resolved internally:

```typescript
// ✅ v4-ready service class pattern:
export class LedgerService {
  constructor(private readonly db: PrismaClient) {}

  async getMyData(ctx: SystemContext, id: string) {
    assertPermission(ctx.user, "ledgers", "view");
    const company = ctx.assertCompany();
    return this.db.ledger.findFirst({ where: { id, companyId: company.id } });
  }
}
```

The `SystemContext` is resolved **once** at the Server Action entry point and passed
down. The service never calls `getSystemContext()` internally.

**Which pattern to apply:**
- Standalone server action files (not service classes) → Pattern A is acceptable.
- Any service introduced or significantly refactored in v3 → Pattern B is required.
- Existing service classes being retrofitted for this spec → Pattern B preferred; if
  it would require touching more than 3 unrelated callers, Pattern A is acceptable as
  an interim step and Pattern B is tracked in `context-v3/v4-bridge-analysis.md`.

---

## Business Rules

1. Behavior must be identical before and after retrofit — this is a refactor, not a
   feature change.
2. `getCurrentUser()`, `getCurrentCompanyUser()`, and `getCurrentCompany()` are NOT
   deleted by this spec — they are deprecated (marked with `@deprecated` JSDoc) and
   now delegate to `SystemContext` internally.
3. All existing tests must pass without modification after the retrofit.

---

## Validation Rules

- After this spec is complete, a grep for `getCurrentUser(` and `getCurrentCompanyUser(`
  in `src/modules/` must return zero results (only the deprecated wrapper definitions
  should remain in `src/lib/`).

---

## Testing Requirements

- No new tests are required — all existing tests must continue to pass.
- A grep assertion test (or CI lint rule) confirms no direct legacy calls remain in
  `src/modules/`.
