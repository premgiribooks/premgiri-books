# 69 - Purchase Reports

> Feature-spec file number 69. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 10 — Reporting** item **#67 Purchase Reports**. Depends on Purchase (Phase 4,
> feature-specs 42–45, all four documents implemented: Purchase Order, Goods Receipt
> Note, Purchase Invoice, Purchase Return). Documentation only, drafted 2026-09-11.
> Read `68-sales-reports.md` first in full — this spec is its purchase-side mirror and
> reuses its Reporting Engine placement (`src/engines/reporting/`), filter conventions,
> and the `POSTED`-only-by-default rule verbatim; only what differs is elaborated here.

## Goal

Implement **Purchase Reports** for **Premgiri Books ERP** — the purchase-side mirror of
`68-sales-reports.md`: read-only presentation over Phase 4's four Purchase documents, no
new Prisma model, no new business arithmetic, every figure either read directly from a
posted document or a plain sum/group of already-stored columns.

**MVP scope decision, mirroring spec 68's reasoning.** Phase 4's chain is Purchase Order
→ Goods Receipt Note → Purchase Invoice → Purchase Return. Purchase Order and Goods
Receipt Note are, by their own specs' explicit Goal sections, non-binding/no-stock-effect
documents (mirroring Sales Order/Delivery Challan) — Purchase Invoice is the first
document with real financial (`VoucherType.PURCHASE`) and stock
(`StockTransactionType.PURCHASE`) consequences, and Purchase Return is its sole
adjustment document (Phase 4 has no Credit/Debit Note pair — `45-purchase-return.md`'s
own Goal note records this structural asymmetry with Phase 3 explicitly).

**In scope (four views):**
1. Purchase Register (Purchase Invoice list/register)
2. Item-wise Purchase Report
3. Party-wise Purchase Summary (by Supplier)
4. Purchase Return Summary

**Explicitly deferred:**
- A Purchase Order fulfillment-percentage report (`PurchaseOrderItem.receivedQuantity`
  exists per `42-purchase-orders.md` but no invoice data flows through it in this MVP —
  same reasoning as spec 68's deferred Sales Order fulfillment report)
- A Goods Receipt Note receiving-analysis report (rejected-quantity trends, receipt lag
  time between GRN and invoice) — `43-goods-receipt-note.md`'s own `rejectedQuantity`
  field is pure record-keeping per that spec and has no consumer yet; a dedicated report
  is a legitimate future ask, not this spec's MVP
- Landed-cost or purchase-price-variance analysis (would require a negotiated-vs-standard
  cost comparison this codebase has no concept of yet — `Product.purchasePrice` is a
  single current value, not a price history)
- Margin/profitability analysis (the same cross-reference as spec 68 — needs both this
  spec and Sales Reports to exist first, and is its own scoped feature)
- Excel/PDF export mechanics (#75/#76 — forward-note only)
- Supplier outstanding/payables reporting (`72-supplier-reports.md`'s job, which reuses
  this spec's party-wise aggregation for the purchase-value column only — the same
  boundary spec 68 draws against `71-customer-reports.md`)

---

# Project Context

Before implementation, review

- `68-sales-reports.md` (**read in full** — the shared Reporting Engine placement,
  filter shape, `POSTED`-only default, and synthetic-bucket reasoning this spec mirrors)
- `architecture-context.md` / `ai-workflow-rules.md` (same Reporting Engine / Invariant 3
  citations as spec 68 — not repeated here)
- `44-purchase-invoice.md` (**read in full** — the posted `PurchaseInvoice`/
  `PurchaseInvoiceItem` shape this spec's Purchase Register and Item-wise report read
  from; unlike Sales Invoice there is **no `customerMode`-equivalent discriminator** —
  every Purchase Invoice has a required `supplierId`, so this spec needs no
  Walk-in/Quick-style synthetic bucketing at all, a genuine simplification over spec 68)
- `45-purchase-return.md` (`PurchaseReturn`/`PurchaseReturnItem` — the Purchase Return
  Summary's source)
- `42-purchase-orders.md` / `43-goods-receipt-note.md` (read for context on why they are
  out of MVP scope — see Goal; no data from either is read here)
- `27-supplier-management.md` (`Supplier`/`Ledger` shape — Party-wise Purchase joins
  against `Supplier`, not a duplicated party concept; note **no `supplierType` tier and
  no `creditLimit`** exist on `Supplier`, unlike `Customer` — this spec's Party-wise
  Purchase Summary has no tier/limit column to show, a simplification over any
  customer-tier breakdown a future Sales-side report might add)
- `31-voucher-engine.md` (`getLedgerBalance`/`getLedgerStatement` — **not** called here;
  `72-supplier-reports.md` owns outstanding/payables reporting)
- `72-supplier-reports.md` (cross-reference — reuses this spec's party-wise aggregation)

---

# Module Responsibilities

The Purchase Reports module is responsible for

- Four read-only report views (Purchase Register, Item-wise Purchase, Party-wise
  Purchase Summary, Purchase Return Summary)
- Composing existing Purchase-module service calls and two new aggregate query methods
  (added to the owning `purchase-invoices` module) into report view-models
- A `/reports/purchase` section of the shared `/reports` hub

The Purchase Reports module is **not** responsible for

- Any write, status transition, or correction to a Purchase document (Invariant 3)
- GST, pricing, or stock recalculation of any kind
- Supplier outstanding-balance/statement reporting (`72-supplier-reports.md`'s job)
- Purchase Order / Goods Receipt Note reporting (deferred — see Goal)
- Excel/PDF export mechanics (forward-note only, #75/#76)

---

# Data Model

**No new Prisma model, enum, or migration.** Every view is a read-only query over
`PurchaseInvoice`/`PurchaseInvoiceItem` (spec 44) and `PurchaseReturn`/
`PurchaseReturnItem` (spec 45), already fully populated by those documents' own posting
logic (Invariant 3).

---

# Business Rules

Scoped to the requesting user's own company, `POSTED`-only by default (same reasoning as
spec 68 — a `DRAFT`/`CANCELLED` invoice/return has no real or reversed consequence to
report).

## 1. Purchase Register

- Filters: date range (`invoiceDate` from/to, required, defaulting to the active FY's
  range), `financialYearId` (optional), `supplierId` (optional), `status` (optional,
  defaults to `POSTED` — same register-specific override allowance as spec 68's Sales
  Register).
- Columns: Invoice Number (this system's own, nullable-until-posted per spec 44),
  Supplier Invoice Number (the supplier's own bill reference — always present, unlike
  the system number, and often what a user searches by first), Supplier, Date, Taxable
  Amount, Total Tax, Grand Total, Amount Paid, Status.
- **No branch filter** — `PurchaseInvoice` carries no `branchId`, same recorded gap as
  spec 68's Sales Register.
- Reuses `purchaseInvoiceService.listPurchaseInvoices(filters)` (spec 44, already
  implemented with the required filter support) — **no new repository method needed.**

## 2. Item-wise Purchase Report

- Filters: date range (required), `financialYearId` (optional), `productId` (optional),
  `warehouseId` (optional), `supplierId` (optional).
- Columns, grouped by product: Product Name/Code, Total Quantity Purchased, Total
  Taxable Value, Total Tax (input-side — cgst+sgst+igst+cess), Total Value, Invoice
  Count.
- Aggregates only `POSTED` `PurchaseInvoiceItem` rows joined to their parent
  `PurchaseInvoice` for the date/FY/supplier/status filters, grouped by `productId`.
- **New repository method required** (see Service / Repository).

## 3. Party-wise Purchase Summary

- Filters: date range (required), `financialYearId` (optional).
- Columns, grouped by supplier: Supplier Name, Invoice Count, Total Taxable Value, Total
  Tax, Total Grand Total. **No synthetic-bucket rule needed** — every Purchase Invoice
  has a required `supplierId` (no Walk-in/Quick-equivalent concept exists on the
  purchase side, per `44-purchase-invoice.md`'s own Decisions), so every row groups
  cleanly by a real `Supplier`. This is a genuine simplification over spec 68's Party-wise
  Sales Summary, recorded explicitly rather than silently assumed symmetric.
- **Does not include outstanding/payable balance data** — same boundary as spec 68
  (`72-supplier-reports.md` owns that, reading the Voucher Engine directly).
- **New repository method required** (see Service / Repository).

## 4. Purchase Return Summary

- Filters: date range (`returnDate` from/to, required), `financialYearId` (optional),
  `supplierId` (optional, resolved via the return's parent invoice — `PurchaseReturn`
  has no direct `supplierId` column per spec 45's schema), `status` (optional, defaults
  to `POSTED`).
- Columns: Return Number, Source Invoice Number, Date, Supplier (resolved from the
  parent invoice), Grand Total, Refund Mode, Status, plus a totals footer (Σ Grand Total)
  computed in this module's own service — a plain sum, not a business-rule computation.
- Reuses `purchaseReturnService.listPurchaseReturns(filters)` (spec 45) joined to each
  return's `purchaseInvoice.supplier` — **no new repository method needed** if the
  existing list query already includes that relation; extend it additively if not
  (confirm at implementation time, mirroring spec 68's identical note for Sales Return
  Summary).

---

# Service / Repository

**Amend** the existing Purchase Invoice module:

```text
src/modules/purchase-invoices/repositories/purchase-invoice-repository.ts  // + aggregateItemWisePurchases, aggregatePartyWisePurchases
src/modules/purchase-invoices/services/purchase-invoice-service.ts         // + getItemWisePurchaseReport, getPartyWisePurchaseReport
```

- `purchaseInvoiceRepository.aggregateItemWisePurchases(companyId, filters)` — a Prisma
  `groupBy` on `PurchaseInvoiceItem.productId` joined through `purchaseInvoice` for the
  date/FY/supplier/status filters, summing `quantity`, `taxableAmount`, tax totals,
  `totalAmount`, counting distinct `purchaseInvoiceId`.
- `purchaseInvoiceRepository.aggregatePartyWisePurchases(companyId, filters)` — a
  `groupBy` on `PurchaseInvoice.supplierId` for the date/FY filters, summing
  `taxableAmount`, tax totals, `grandTotal`, counting invoices. No synthetic-bucket logic
  needed (see Business Rules).
- `purchaseInvoiceService.getItemWisePurchaseReport(filters)` /
  `getPartyWisePurchaseReport(filters)` — thin pass-throughs, the same layering spec 68
  established. **This is the method Supplier Reports (`72-supplier-reports.md`) calls**
  for its own Supplier Purchase Summary view.

**Create**

```text
src/engines/reporting/purchase-reports.ts       // buildPurchaseRegister, buildItemWisePurchaseReport, buildPartyWisePurchaseReport, buildPurchaseReturnSummary
src/modules/reports/purchase/services/purchase-report-service.ts
src/modules/reports/purchase/actions/purchase-report-actions.ts
src/modules/reports/purchase/components/…
src/types/purchase-report.ts
```

Same shape and reasoning as `68-sales-reports.md`'s Service / Repository section — the
Reporting Engine composition file calls the owning Purchase Invoice/Return module
services, never Prisma directly; `purchaseReportService` validates filters and delegates.

---

# Validation

Zod (`purchase-report-schema.ts`) — identical shape to `sales-report-schema.ts` with
`supplierId` in place of `customerId` and no `customerMode`-equivalent status field.

---

# UI

Pages

- `/reports` — shared hub (see `68-sales-reports.md`'s identical Assumption note — this
  spec adds its own card, it does not claim to originate the hub).
- `/reports/purchase` — Purchase Reports section (four cards/tabs)
- `/reports/purchase/register` — Purchase Register
- `/reports/purchase/item-wise` — Item-wise Purchase Report
- `/reports/purchase/party-wise` — Party-wise Purchase Summary
- `/reports/purchase/returns` — Purchase Return Summary

Components (`src/modules/reports/purchase/components/`): the same `ReportFilterBar`
pattern as spec 68 (reuse the shared component if spec 68 lands first, rather than a
second copy — the standard "reuse if it already exists" posture this codebase follows
throughout), four report tables.

Wire-up

- Add a "Purchase Reports" card to `/reports`.
- Add `"reports/purchase": "Purchase Reports"` (parent/segment key, disambiguating
  against the existing bare `purchase` key used by `/purchase`), `register: "Purchase
  Register"` (shared key with Sales Register unless a collision requires the
  parent/segment form — check `breadcrumbs.ts` at implementation time), `"item-wise":
  "Item-wise Purchases"`, `"party-wise": "Party-wise Purchases"` to
  `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `reports` permission module: `view`, `export` (reserved, same
posture as spec 68). No new permission module or action. Company-scoped identically to
spec 68.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Same as `68-sales-reports.md`: strict TypeScript, no `any`, no GST/pricing/stock
arithmetic anywhere in this module, vitest coverage for:

- `aggregateItemWisePurchases`/`aggregatePartyWisePurchases` correctness against a seeded
  multi-invoice, multi-product, multi-supplier fixture
- default `POSTED`-only filtering and the Purchase Register's status override
- date-range/FY/supplier/product/warehouse filter combinations, cross-company rejection
- the Purchase Return Summary's totals-footer sum
- confirms no synthetic-bucket logic exists in the party-wise aggregation (every row is a
  real `Supplier` — a structural difference from spec 68 worth its own explicit test)

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration
- Any write, status transition, correction, or cancellation of a Purchase document
- GST, pricing, or stock recalculation of any kind
- Purchase Order or Goods Receipt Note reporting (deferred — see Goal)
- Landed-cost or purchase-price-variance analysis (deferred — see Goal)
- Margin/profitability analysis (deferred — see Goal)
- Excel/PDF export mechanics (#75/#76 — forward-note only)
- Supplier outstanding-balance or statement reporting (`72-supplier-reports.md`'s job)
- Branch-dimension filtering (Purchase documents carry no `branchId`)

---

# Success Criteria

Verify

- The Purchase Register lists `POSTED` Purchase Invoices by default within a date range,
  shows both the system invoice number and the supplier's own bill number, and supports
  an explicit status override.
- The Item-wise Purchase Report's per-product sums match a hand-computed fixture.
- The Party-wise Purchase Summary correctly groups every invoice by its required
  `supplierId` with no synthetic buckets, sums matching a hand-computed fixture.
- The Purchase Return Summary correctly resolves each return's supplier from its parent
  invoice and its totals footer sums correctly.
- Every view rejects a cross-company filter id as not-found/empty.
- No test or code path in this module calls `gstEngine`, `pricingEngine`, or
  `inventoryEngine`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/purchase*` appears in the build route table.

Feature-spec 69 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #67.
Feature-spec 72 (Supplier Reports, tracker #70) reuses
`purchaseInvoiceService.getPartyWisePurchaseReport` for its own Supplier Purchase
Summary view.
