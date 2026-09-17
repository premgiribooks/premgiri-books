# 110b - Schema Domain Segmentation Audit

> Feature-spec file number 110b (v3 bridge sequence).
> This is a **documentation + enforcement** spec — it does not introduce new runtime
> features but verifies and records the current schema state before v4 microservice
> extraction begins.
> Tracker item: **#102 Schema Domain Segmentation Audit**.
>
> Depends On: All v3 Phase 1–3 schema migrations must be complete before this audit
> runs. Run this after: spec 91 (Serial Numbers), spec 92 (Payroll), spec 93 (Audit
> Trail), spec 94/95 (E-Invoice/EWB), spec 98 (FIFO), spec 99 (CompanyUser).
>
> This is a v3/v4 bridge spec — see `context-v3/architecture-context.md` Bridge
> Decision E and `context-v3/v4-bridge-analysis.md`.

## Goal

Audit the Prisma schema (`prisma/schema.prisma`) to:
1. Classify every model into one of nine domain boundaries.
2. Identify every `@relation` that crosses a domain boundary.
3. Document each cross-domain FK violation and plan its resolution before v4 extraction.
4. Produce a `context-v3/schema-domain-map.md` artifact that becomes the input to the
   v4 microservice database design (spec 123 — Per-Tenant Database).

This is a one-time audit spec. It results in a document, not code changes.
Any cross-domain violations discovered are fixed **before this spec is closed** by
converting the offending `@relation` to a plain `String` ID field (see Bridge Decision E).

---

## Project Context

Read before performing the audit:

1. `prisma/schema.prisma` — full current schema.
2. `context-v3/architecture-context.md` — Bridge Decision E (no cross-domain FKs).
3. `context-v4/feature-specs/123-per-tenant-database.md` — v4 database extraction plan;
   this audit feeds directly into it.
4. `context-v4/architecture-context.md` — microservice boundaries and domain definitions.

---

## Domain Boundaries

The nine domain boundaries for Premgiri Books:

| Domain | Prisma Models (primary ownership) |
|---|---|
| **Auth** | `User`, `Session`, `Platform` |
| **Company** | `Company`, `CompanySettings`, `CompanyUser`, `FinancialYear` |
| **Masters** | `Ledger`, `LedgerGroup`, `Product`, `ProductCategory`, `Unit`, `Tax`, `TaxRate`, `Warehouse`, `Role`, `Permission`, `RolePermission` |
| **Sales** | `SalesInvoice`, `SalesInvoiceItem`, `SalesOrder`, `SalesOrderItem`, `SalesReturn`, `SalesReturnItem`, `DeliveryChallan`, `DeliveryChallanItem`, `EWayBill` |
| **Purchase** | `PurchaseInvoice`, `PurchaseInvoiceItem`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseReturn`, `PurchaseReturnItem` |
| **Inventory** | `StockTransaction`, `StockAdjustment`, `StockTransfer` |
| **Accounting** | `Voucher`, `VoucherEntry`, `VoucherType` |
| **GST** | `GSTReturn`, `GSTEntry` |
| **HR** | `Employee`, `PayrollPeriod`, `PayslipEntry`, `LeaveRequest` |

Models not yet present in the schema are noted in the output document as "pending
implementation" — they will be assigned their domain boundary when introduced.

---

## Cross-Domain FK Identification

A **cross-domain FK** is any `@relation` where the model containing the FK belongs to
Domain A and the referenced model belongs to Domain B.

### Known acceptable cross-domain references (by design)

The following cross-domain references are structurally inevitable and are handled by
`companyId` scoping — they do not need resolution:

- All models → `Company` (via `companyId String`) — `Company` is a root tenant anchor.
  This reference must be a plain `String` field with **no `@relation` to `Company`** in
  the extracted microservice schema. In v3 the `@relation` is kept for referential
  integrity; v4 removes it during extraction.
- All models → `User` (via `createdById`, `updatedById`) — same rule as `Company`.

### Cross-domain references that must be resolved

Any `@relation` other than the above patterns that crosses domain boundaries must be
documented in the output artifact and resolved by converting to a plain `String` ID:

```prisma
// ❌ Cross-domain FK (blocks extraction):
model StockTransaction {   // domain: Inventory
  salesInvoiceId String?
  salesInvoice   SalesInvoice? @relation(...)  // → domain: Sales
}

// ✅ After resolution (bridge-safe):
model StockTransaction {   // domain: Inventory
  salesInvoiceId String?   // no @relation — resolved in service layer
}
```

---

## Audit Procedure

1. Open `prisma/schema.prisma`.
2. For each model, assign its domain from the table above.
3. For each `@relation` in each model, check if the referenced model is in a different domain.
4. Record violations in the output table.
5. For each violation:
   a. Determine if it is an "acceptable" cross-domain reference (companyId / User FK).
   b. If not acceptable: create a Prisma migration that removes the `@relation` and
      replaces it with a plain `String` field. The service layer is updated to resolve
      the foreign entity by ID lookup.
   c. Mark as resolved in the output artifact.
6. Write `context-v3/schema-domain-map.md` with the results.

---

## Output Artifact: `context-v3/schema-domain-map.md`

The artifact must include:

### Section 1 — Domain Model Assignment
A table: `Model | Domain | Notes`

### Section 2 — Cross-Domain FK Violations
A table: `Source Model | Source Domain | FK Field | Target Model | Target Domain | Status`

Status values: `ACCEPTABLE` / `RESOLVED` / `PENDING`

### Section 3 — Resolved Violations
For each resolved violation: the migration name, the original FK, and the replacement
plain `String` field.

### Section 4 — Pending Items
Any cross-domain FKs that cannot be resolved in v3 without breaking functionality —
documented with a rationale and a plan for v4 resolution.

### Section 5 — v4 Extraction Readiness Summary
A per-domain readiness statement: "Domain X is fully self-contained" or "Domain X has
N pending cross-domain references."

---

## Business Rules

1. This audit must be performed on the **post-Phase-3 schema** — after all v3 Phase 1–3
   Prisma migrations are applied.
2. The audit is complete only when the `schema-domain-map.md` artifact exists and every
   violation has status `ACCEPTABLE` or `RESOLVED` — no `PENDING` items are allowed to
   close this spec.
3. If a violation cannot be resolved without a significant refactor, open a new v3 spec
   to track the refactor and mark the violation `PENDING` with a reference to the new
   spec number.

---

## Testing Requirements

- `schema-domain-map.md` exists in `context-v3/` when this spec is closed.
- No `@relation` in the schema crosses a domain boundary (other than `companyId` and
  user-tracking fields) — verified by code review and grep audit.
- All existing tests pass after any `@relation` → plain `String` migrations.
