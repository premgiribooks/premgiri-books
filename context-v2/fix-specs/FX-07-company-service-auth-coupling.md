# FX-07 — `company-service.ts` Imports Three Auth Helpers Directly

**Severity:** HIGH  
**Found in:** `src/modules/company/services/company-service.ts`  
**Resolving specs:** v3 spec 105 (Pattern B) / v4 spec 116 (Company Service)

---

## What Was Found

The company service imports all three auth helper variants at the top level:

```typescript
// src/modules/company/services/company-service.ts — line 2 (verified)
import { getCurrentCompanyUser, getCurrentSuperAdmin, getCurrentUser } from "@/lib/current-user";
```

This service is particularly notable because it imports three distinct helper variants
(`getCurrentUser` for general checks, `getCurrentCompanyUser` for company-scoped methods,
and `getCurrentSuperAdmin` for platform-admin operations). This means it handles both
Platform and Company auth flows internally — making it the highest-coupling service
in the codebase with respect to auth context.

---

## Why It Is a Problem

**Microservice extraction blocker:** In v4, company management becomes the `company-service`
microservice (spec 116). Like `sales-invoice-service.ts` (FX-06), this service cannot
carry Next.js-specific context-resolution logic into a standalone process.

**Mixed user-type handling:** The fact that `company-service.ts` must handle both
Platform Admin operations and Company User operations in a single service suggests it
may need to be split in v4. In v3, the retrofit keeps both code paths in one file but
removes internal auth resolution.

---

## What Must Change

Apply **Pattern B** (constructor injection) from spec 105:

```typescript
// ✅ After retrofit:
export class CompanyService {
  constructor(private readonly db: PrismaClient) {}

  // Platform Admin operation — ctx.userType === "PLATFORM" enforced by call site
  async createCompany(ctx: SystemContext, input: CreateCompanyInput) {
    if (ctx.userType !== "PLATFORM") {
      throw new AuthorizationError("Only Super Admin can create companies.");
    }
    // ... no internal getCurrentSuperAdmin() call
  }

  // Company User operation
  async updateCompanyProfile(ctx: SystemContext, input: CompanyProfileInput) {
    const company = ctx.assertCompany();
    assertPermission(ctx.user, "company", "edit");
    // ... no internal getCurrentCompanyUser() call
  }
}
```

The `SystemContext` discriminated type (`userType: "PLATFORM" | "COMPANY"`) replaces
the need to call different helpers for different user types — the callers narrow the
type at the Server Action entry point.

---

## Additional Cross-Service Imports

`company-service.ts` also imports `tenantBootstrapService` from
`src/modules/administration/services/tenant-bootstrap-service.ts`. Verify that
`tenantBootstrapService` methods also accept `ctx: SystemContext` after its own
retrofit in spec 105.

---

## Acceptance Criteria

- [ ] `company-service.ts` does not import `getCurrentCompanyUser`, `getCurrentSuperAdmin`, or `getCurrentUser`
- [ ] The service class accepts `db: PrismaClient` as a constructor parameter
- [ ] Platform Admin methods check `ctx.userType === "PLATFORM"` in the method body (not via a helper call)
- [ ] All existing company service tests pass
- [ ] `tenantBootstrapService` is also retrofitted to accept `ctx: SystemContext` as a parameter
