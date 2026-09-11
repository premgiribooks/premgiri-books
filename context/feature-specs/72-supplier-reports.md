# 72 - Supplier Reports

> Feature-spec file number 72. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 10 — Reporting** item **#70 Supplier Reports**. Depends on Suppliers
> (feature-spec 27, implemented) and, for two of its four views, on Purchase Invoice
> (feature-spec 44) and the Voucher Engine (feature-spec 31). Documentation only, drafted
> 2026-09-11. Read `71-customer-reports.md` first in full — this spec is its
> supplier/payables-side mirror and reuses its Reporting Engine placement, query-design
> decision (`getTrialBalance` once, not `getLedgerBalance` per party), and filter
> conventions verbatim; only what differs is elaborated here.

## Goal

Implement **Supplier Reports** for **Premgiri Books ERP** — the supplier-side mirror of
`71-customer-reports.md`: read-only presentation combining Supplier master data
(`27-supplier-management.md`), the Voucher Engine's ledger-balance/statement query APIs
(`31-voucher-engine.md`), and Purchase Reports' party-wise purchase aggregation
(`69-purchase-reports.md`). No new Prisma model, no new financial arithmetic.

**In scope (four views):**
1. Supplier Outstanding (Payables) Report
2. Supplier Statement
3. Supplier Purchase Summary (reused from Purchase Reports)
4. Supplier Directory

**Explicitly deferred (same reasoning as spec 71):**
- Ageing/payables-due analysis — the identical genuine gap spec 71 records: no due-date
  convention exists anywhere in this codebase for a Purchase Invoice (`Supplier.
  creditDays` is advisory-only stored data with no consumer, per `27-supplier-
  management.md`'s own deferral), so this spec does not invent one. Recorded as an open
  product decision for a future spec, not built around here.
- Supplier-specific costing/negotiated-price analysis (out of scope entirely — no such
  concept exists in this codebase; `Product.purchasePrice` is a single current value)
- Excel/PDF export mechanics (#75/#76 — forward-note only)
- Any Supplier Ledger write, correction, or manual adjustment (Invariant 3)

**One structural simplification over the Customer side, recorded explicitly**: unlike
Customer Reports' Outstanding Report, this spec's Supplier Outstanding Report has **no
"Over Limit" flag** — `Supplier` has no `creditLimit` field at all (`27-supplier-
management.md`'s own deliberate omission: "a credit limit is a cap *we* impose on a
debtor. What a supplier extends to us is their decision, not a control this system
enforces"). This spec does not invent one to achieve symmetry with spec 71; the asymmetry
is real and intentional, inherited from the master data itself.

---

# Project Context

Before implementation, review

- `71-customer-reports.md` (**read in full** — the shared Reporting Engine placement,
  the `getTrialBalance`-once query-design decision, and the overall spec shape this
  spec mirrors)
- `27-supplier-management.md` (**read in full** — `Supplier.ledgerId`, `creditDays`; no
  `creditLimit`, no `supplierType` — the two fields spec 26's `Customer` has that this
  spec's Outstanding Report has nothing equivalent to show)
- `31-voucher-engine.md` (`getTrialBalance`/`getLedgerStatement` — same primitives spec
  71 uses, called here against "Sundry Creditors"-linked ledgers instead of "Sundry
  Debtors"-linked ones)
- `69-purchase-reports.md` (**read in full** — `purchaseInvoiceService.
  getPartyWisePurchaseReport`, the method this spec's Supplier Purchase Summary view
  reuses rather than re-deriving)
- `13-ledger-groups.md` / `14-ledger-master.md` (the "Sundry Creditors" reserved group
  every `Supplier.ledgerId` is assigned under or beneath)

---

# Module Responsibilities

The Supplier Reports module is responsible for

- Four read-only report views (Supplier Outstanding, Supplier Statement, Supplier
  Purchase Summary, Supplier Directory)
- Composing `voucherEngine.getTrialBalance`/`getLedgerStatement`, `supplierService`'s
  existing methods, and `purchaseInvoiceService.getPartyWisePurchaseReport` (spec 69)
  into report view-models
- A `/reports/suppliers` section of the shared `/reports` hub

The Supplier Reports module is **not** responsible for

- Any write to `Supplier`, `Ledger`, `Voucher`, or `VoucherEntry`
- Deriving ledger balances from raw voucher entries itself — always through
  `voucherEngine`'s own query functions
- Re-deriving purchase figures — always through
  `purchaseInvoiceService.getPartyWisePurchaseReport` (spec 69)
- Ageing analysis (deferred — see Goal, a genuine open gap)
- Excel/PDF export mechanics (forward-note only, #75/#76)

---

# Data Model

**No new Prisma model, enum, or migration.** Every view reads `Supplier` (spec 27),
`Voucher`/`VoucherEntry` (spec 31, exclusively through `voucherEngine`), and
`PurchaseInvoice`/`PurchaseInvoiceItem` (spec 44, exclusively through
`purchaseInvoiceService.getPartyWisePurchaseReport`, spec 69).

---

# Business Rules

All four views are scoped to the requesting user's own company; list-shaped views read
**active Suppliers only** by default, same posture as spec 71.

## 1. Supplier Outstanding (Payables) Report

- Filters: `financialYearId` (optional, defaults to active FY), `asOfDate` (optional,
  defaults to today), `status` (optional, defaults to active-only).
- **Same query design decision as spec 71**: one `voucherEngine.getTrialBalance`
  call, filtered/joined against `supplierService.listSuppliers()`'s own `ledgerId`
  values, rather than looping `getLedgerBalance` per supplier.
- Columns: Supplier Name, Outstanding Balance (payable — the matched `getTrialBalance`
  row's signed net; a business owing a supplier money shows as a credit-nature balance
  per that supplier's Ledger's own `accountNature`, presented per `getTrialBalance`'s own
  documented convention, unmodified), Credit Days (informational, not a comparison
  column — see Goal's structural note; there is nothing to flag "over" since no limit
  exists).
- A supplier whose `ledgerId` shows no voucher activity is still shown with its Ledger's
  own opening balance, identical reasoning to spec 71.

## 2. Supplier Statement

- Filters: `supplierId` (**required**), date range (required).
- Columns: identical shape to spec 71's Customer Statement (Date, Voucher/Document
  Reference, Debit, Credit, Running Balance, opening/closing balance rows).
- Calls `voucherEngine.getLedgerStatement(companyId, supplier.ledgerId, from, to)`
  directly, after resolving `supplier.ledgerId` via `supplierService.getSupplier(id)`.

## 3. Supplier Purchase Summary

- Filters: date range (required), `financialYearId` (optional) — identical shape to
  `69-purchase-reports.md`'s own Party-wise Purchase Summary.
- Columns: identical to spec 69's Party-wise Purchase Summary (Supplier Name, Invoice
  Count, Total Taxable Value, Total Tax, Total Grand Total). **No synthetic-bucket
  filtering needed** — unlike spec 71's Customer Sales Summary, `purchaseInvoiceService.
  getPartyWisePurchaseReport`'s own output already contains no Walk-in/Quick-equivalent
  rows to exclude (per spec 69's own recorded simplification), so this view passes the
  aggregation through unmodified.
- Calls `purchaseInvoiceService.getPartyWisePurchaseReport(filters)` (spec 69's method,
  unmodified) — **no new aggregation logic, no second independent query.**

## 4. Supplier Directory

- Filters: `status` (optional, defaults to active).
- Columns: Name, Mobile, GSTIN, Credit Days, City/State, Status — `supplierService.
  listSuppliers(filters)`'s existing output (spec 27), presented directly.
- Calls `supplierService.listSuppliers(filters)` directly — no new query needed.

---

# Service / Repository

**No amendment to any existing module.** This spec calls only already-public methods:
`voucherEngine.getTrialBalance`/`getLedgerStatement` (unmodified),
`supplierService.listSuppliers`/`getSupplier` (unmodified),
`purchaseInvoiceService.getPartyWisePurchaseReport` (spec 69, unmodified).

**Create**

```text
src/engines/reporting/supplier-reports.ts       // buildSupplierOutstandingReport, buildSupplierStatement, buildSupplierPurchaseSummary, buildSupplierDirectory
src/modules/reports/suppliers/services/supplier-report-service.ts
src/modules/reports/suppliers/actions/supplier-report-actions.ts
src/modules/reports/suppliers/components/…
src/types/supplier-report.ts
```

Same shape and reasoning as `71-customer-reports.md`'s Service / Repository section —
the Reporting Engine composition file calls `voucherEngine`/`supplierService`/
`purchaseInvoiceService` directly, never Prisma; `supplierReportService` validates
filters and delegates.

---

# Validation

Zod (`supplier-report-schema.ts`): `supplierId` optional/required uuid depending on view
(required only for Supplier Statement; server re-verifies same-company), `status`
optional enum, `financialYearId` optional uuid, `dateFrom`/`dateTo`/`asOfDate` calendar
dates with the standard refine. No `customerType`-equivalent field (Supplier has none).

---

# UI

Pages

- `/reports` — shared hub (same Assumption note as `68-sales-reports.md`).
- `/reports/suppliers` — Supplier Reports section (four cards/tabs)
- `/reports/suppliers/outstanding` — Supplier Outstanding (Payables) Report
- `/reports/suppliers/statement` — Supplier Statement (supplier picker required)
- `/reports/suppliers/purchase-summary` — Supplier Purchase Summary
- `/reports/suppliers/directory` — Supplier Directory

Components (`src/modules/reports/suppliers/components/`): shared `ReportFilterBar`
(reused), a Supplier Picker (reused from `27-supplier-management.md`'s existing
`listSelectableSuppliers()`-backed picker if one exists), four report tables. **No
"Over Limit" badge component** — there is nothing to flag (see Goal).

Wire-up

- Add a "Supplier Reports" card to `/reports`.
- Add `"reports/suppliers": "Supplier Reports"` (parent/segment key, disambiguating
  against the existing bare `suppliers` key used by `/masters/suppliers`),
  `outstanding: "Outstanding"` (shared key with Customer Reports' identical segment
  unless a collision requires further disambiguation — check `breadcrumbs.ts` at
  implementation time and use `"reports/suppliers/outstanding"`-style deeper nesting only
  if the bare `outstanding` key is already claimed with a conflicting label),
  `statement: "Statement"`, `"purchase-summary": "Purchase Summary"`,
  `directory: "Directory"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `reports` permission module: `view`, `export` (reserved). No new
permission module or action. Company-scoped identically to every spec in this project.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Strict TypeScript, no `any`, zero ledger-balance or purchase-total arithmetic outside
`voucherEngine`/`purchaseInvoiceService`'s own functions, vitest coverage for:

- `buildSupplierOutstandingReport`'s join correctness against a seeded fixture (voucher
  activity, opening-balance-only, and zero-activity suppliers all appearing correctly)
- `buildSupplierStatement` matches `getLedgerStatement`'s own output exactly
- `buildSupplierPurchaseSummary` matches `purchaseInvoiceService.
  getPartyWisePurchaseReport`'s own per-supplier rows exactly, unmodified (no
  synthetic-bucket filtering applied, confirming the pass-through is exact)
- cross-company `supplierId`/`financialYearId` rejection on every view
- no test or code path in this module calls `voucherRepository`/`prisma` directly

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration
- Any write to `Supplier`, `Ledger`, `Voucher`, or `VoucherEntry`
- A second, independent ledger-balance or purchase-aggregation query bypassing
  `voucherEngine`/`purchaseInvoiceService`
- Ageing/payables-due analysis of any kind (a genuine open gap — see Goal)
- A `creditLimit`/"Over Limit" concept of any kind (no such field exists on `Supplier` —
  see Goal's structural note; do not add one here to force symmetry with spec 71)
- Supplier-specific costing/negotiated-price analysis
- Excel/PDF export mechanics (#75/#76 — forward-note only)

---

# Success Criteria

Verify

- The Supplier Outstanding Report's balances match `voucherEngine.getTrialBalance`'s own
  output exactly (via the `ledgerId` join), including suppliers with zero voucher
  activity showing their opening balance correctly.
- The Supplier Statement matches `getLedgerStatement`'s own output exactly.
- The Supplier Purchase Summary matches `purchaseInvoiceService.
  getPartyWisePurchaseReport`'s own rows exactly, unmodified.
- The Supplier Directory matches `supplierService.listSuppliers`'s own output.
- Every view rejects a cross-company `supplierId`/`financialYearId`.
- No "Over Limit" or credit-limit concept appears anywhere in this spec's UI or data
  model (a structural difference from `71-customer-reports.md` worth its own explicit
  check).
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/suppliers*` appears in the build route table.

Feature-spec 72 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #70.
