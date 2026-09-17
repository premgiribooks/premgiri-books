# 104 - Default Voucher Types Seeder

> Feature-spec file number 104 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 3 — Architecture
> Hardening**, tracker item **#95 Default Voucher Types Seeder**.
>
> Depends On: TenantBootstrapService
> (`src/modules/administration/services/tenant-bootstrap-service.ts`).

## Goal

Seed default Voucher Types when a new company is created, as part of
`TenantBootstrapService.bootstrapTenant()`. This fills the gap documented in
`context/architecture-context.md` (v2): "Default Voucher Types still do not exist
(the Voucher Engine is not implemented)." The Voucher Engine is now fully implemented —
the seeder was simply never added.

Without default Voucher Types, every new company must manually configure them before
posting the first Sales Invoice, which is a friction point during onboarding.

---

## Project Context

Read before implementation:

1. `context/feature-specs/31-voucher-engine.md` — `VoucherType` enum and the
   `Voucher` model's `voucherTypeId` FK; these are what this spec seeds.
2. `src/modules/administration/services/tenant-bootstrap-service.ts` — the single
   owner of company initialization; this spec adds voucher types to the atomic bootstrap
   transaction.
3. `context/architecture-context.md` (v2) — Company Initialization section.
4. `context-v3/architecture-context.md` — Company Initialization section notes this gap.

---

## Module Responsibilities

- Add `seedDefaultVoucherTypes(companyId, tx)` to `TenantBootstrapService`
- Call it inside the atomic `prisma.$transaction` that already seeds roles,
  permissions, the financial year, ledger groups, and the Cash ledger
- `bootstrapVersion` on `Company` is incremented to 2 to signal that this company
  has the v3 seed

---

## Default Voucher Types to Seed

| VoucherType | Name | Code | Auto-Numbered |
|---|---|---|---|
| SALES | Sales Invoice | SI | Yes |
| PURCHASE | Purchase Invoice | PI | Yes |
| RECEIPT | Receipt Voucher | RV | Yes |
| PAYMENT | Payment Voucher | PV | Yes |
| CONTRA | Contra Voucher | CV | Yes |
| JOURNAL | Journal Voucher | JV | Yes |
| SALES_RETURN | Sales Return | SR | Yes |
| PURCHASE_RETURN | Purchase Return | PR | Yes |
| CREDIT_NOTE | Credit Note | CN | Yes |
| DEBIT_NOTE | Debit Note | DN | Yes |
| PAYROLL | Payroll Run | PAY | Yes |

---

## Data Model

The `VoucherType` model (or enum + mapping table — confirm against the current schema)
must have at minimum:
- `code` — short prefix for document numbering
- `name` — display name
- `companyId` — company-scoped
- `isSystemDefined` — cannot be deleted by the user
- `isActive` — can be deactivated but not removed

If the `VoucherType` model does not yet exist as a full Prisma model (only the enum
exists), this spec creates the model and the seeder in one migration.

---

## Business Rules

1. Default voucher types are `isSystemDefined = true` — they cannot be deleted by a
   Company Admin.
2. A Company Admin may deactivate a default type but not delete it.
3. `bootstrapTenant()` remains atomic — if voucher type seeding fails, the entire
   company creation rolls back.
4. Existing companies (bootstrapVersion = 1) must be backfilled. A one-time migration
   script seeds the missing voucher types for companies where they don't already exist.

---

## Validation Rules

- Duplicate voucher type codes within the same company are rejected (unique constraint).

---

## API / Server Actions

No new server actions — voucher types are managed through an existing or new Voucher
Types settings page (out of scope for this spec — this spec only handles seeding).

---

## Testing Requirements

- `bootstrapTenant()` integration test: a newly created company has all 11 default
  voucher types
- Atomic rollback test: if the voucher type insert fails, the company row is rolled back
- Backfill test: existing company with `bootstrapVersion = 1` gains types after the
  migration script runs
