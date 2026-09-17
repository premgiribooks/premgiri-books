# FX-06 — `sales-invoice-service.ts` Imports Auth Helpers Internally

**Severity:** HIGH  
**Found in:** `src/modules/sales-invoices/services/sales-invoice-service.ts`  
**Resolving specs:** v3 spec 105 (Pattern B) / v4 spec 118 (Sales Service)

---

## What Was Found

The file imports four auth/context helpers at the top level and calls them inside
service methods:

```typescript
// src/modules/sales-invoices/services/sales-invoice-service.ts — lines 1–8 (verified)
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { prisma } from "@/lib/prisma";
// ...
```

This service also imports `companySettingsService`, `customerService`,
`deliveryChallanService`, `ledgerService`, and `salesOrderService` — making it one of
the most coupled services in the codebase.

---

## Why It Is a Problem

**Microservice extraction blocker:** In v4, `sales-invoice-service.ts` becomes the core
of the `sales-service` microservice (spec 118). A microservice runs in its own process
with no Next.js request cycle — it cannot call `getCurrentCompanyUser()` or
`getCurrentFinancialYear()` (which rely on `cache()` from React and `cookies()` from
Next.js headers). The service must receive all needed context as explicit parameters.

**v3 standard violation:** Bridge Decision A and the Context-as-Parameter rule in
`context-v3/ai-workflow-rules.md` require this pattern to be fixed in v3.

---

## What Must Change

Apply **Pattern B** (constructor injection) from spec 105:

```typescript
// ✅ After retrofit:
export class SalesInvoiceService {
  constructor(
    private readonly db: PrismaClient,
    private readonly eventBus: DomainEventBus,
  ) {}

  async createDraft(ctx: SystemContext, input: CreateSalesInvoiceInput) {
    const company = ctx.assertCompany();   // no internal getCurrentCompanyUser() call
    const financialYear = ctx.assertFinancialYear();
    // ... rest of implementation unchanged
  }
}
```

The `companySettingsService`, `customerService`, etc. are also retrofitted to accept
`ctx: SystemContext` as their first method parameter so the auth context threads down
through the full call chain.

**Cross-service imports:** `sales-invoice-service.ts` imports from:
- `src/modules/company/services/company-settings-service.ts`
- `src/modules/customers/services/customer-service.ts`
- `src/modules/delivery-challans/services/delivery-challan-service.ts`
- `src/modules/ledgers/services/ledger-service.ts`
- `src/modules/sales-orders/services/sales-order-service.ts`

Each of these must also be on the Pattern B retrofit list to avoid the auth call
re-appearing one level down.

---

## Acceptance Criteria

- [ ] `sales-invoice-service.ts` does not import `getCurrentCompanyUser`, `getCurrentUser`, `getCurrentFinancialYear`, or `getCurrentCompany`
- [ ] The service class accepts `db: PrismaClient` as a constructor parameter
- [ ] All public methods accept `ctx: SystemContext` as their first parameter
- [ ] All existing sales invoice tests pass
- [ ] The Server Action that calls this service resolves `ctx` via `resolveSystemContext()` once and passes it in
