# 68 - Sales Reports

> Feature-spec file number 68 (spec-file numbers are sequential and never reused — the
> highest prior file was `67-...` if drafted by the sibling batch, otherwise
> `63-payroll.md`; this batch was assigned files 68-73 explicitly and uses them as given).
> This feature is `context/Phases/phase-tracker.md`'s **Phase 10 — Reporting** item **#66
> Sales Reports**. Depends on Sales (Phase 3, feature-specs 35–41, all seven documents
> implemented: Quotation, Sales Order, Delivery Challan, Sales Invoice, Sales Return,
> Credit Note, Debit Note). Documentation only, drafted 2026-09-11 per the same
> batch-drafting-without-implementation precedent as specs 46–63 — nothing in this spec is
> implemented yet.
>
> A sibling batch is concurrently drafting Phase 10's financial-reports half (Trial
> Balance #62 → spec 64, P&L #63 → spec 65, Balance Sheet #64 → spec 66, Cash Flow #65 →
> spec 67, GST Reports #72 → spec 74), which is expected to introduce the shared
> `src/engines/reporting/` module. As of this writing, `context/feature-specs/64-trial-
> balance.md` does not yet exist, so this spec **establishes** `src/engines/reporting/` as
> the Reporting Engine location (per `architecture-context.md`'s Core Engines list and
> `ai-workflow-rules.md`'s Engine Usage Rule "Reports → Reporting Engine") and places its
> own composition functions there, one file per report domain. **If the financial-reports
> batch lands with a different internal layout inside `src/engines/reporting/` (a single
> `reporting-engine.ts`, a different query-primitive split, etc.), the two halves should
> converge on one shared convention as a follow-up — flagged here explicitly, not silently
> duplicated.**

## Goal

Implement **Sales Reports** for **Premgiri Books ERP** — read-only presentation screens
over the data Phase 3's seven Sales documents already produce. Per
`architecture-context.md` Invariant 3 ("Reports are read-only") and the Reports module
boundary ("Reports responsible only for presenting information... Reports never modify
business data"), this spec introduces **no new Prisma model** and **no new business
arithmetic** — every figure it displays is either read directly from an existing posted
document or computed by summing/grouping already-stored, already-validated columns
(`taxableAmount`, `grandTotal`, quantities) that the GST Engine and each document's own
posting logic already computed and stored. No GST/pricing/voucher recalculation happens
anywhere in this spec.

**MVP scope decision, stated up front.** Sales document chain is
Quotation → Sales Order → Delivery Challan → Sales Invoice → Sales Return → Credit Note →
Debit Note (`35-quotations.md` through `41-debit-note.md`). Of these, only **Sales
Invoice** (and its two adjustment documents, Sales Return / Credit Note / Debit Note) has
real financial and stock consequences (Invariant 1, 9) — Quotation, Sales Order, and
Delivery Challan are deliberately non-binding/display-only documents by their own specs'
Goal sections. This spec's MVP is therefore scoped to the financially-consequential half
of the chain:

**In scope (four views, detailed below):**
1. Sales Register (Sales Invoice list/register)
2. Item-wise Sales Report
3. Party-wise Sales Summary
4. Sales Return Summary

**Explicitly deferred (not built in this task):**
- A Quotation-to-Order-to-Invoice conversion-funnel/win-rate report (no document in this
  chain stores a "converted at" timestamp beyond the FK back-references those specs
  already create; a funnel report is a legitimate future ask but is its own scoped
  feature, not an MVP-day-one item)
- A Sales Order fulfillment-percentage report (`SalesOrderItem.deliveredQuantity` already
  exists per `36-sales-orders.md` and could support this cheaply, but no Sales Invoice
  data flows through it — deferred to keep this spec's first cut anchored to posted,
  financially-real documents)
- Credit Note / Debit Note registers as their own dedicated views (both are pure financial
  adjustments per `40-credit-note.md`/`41-debit-note.md`; their volume is typically far
  lower than invoices/returns, and their `grandTotal` already flows into the ledger data
  Trial Balance/P&L will surface — a dedicated register is a natural, cheap follow-up, not
  included here to keep this spec's line count and testing surface proportional to actual
  MVP need)
- Margin/profitability analysis (would require joining Sales Invoice lines against
  `Product.purchasePrice`/Purchase history — a real, larger feature better scoped once
  Purchase Reports (`69-purchase-reports.md`) and this spec both exist to build on)
- Excel/PDF export mechanics (Excel Export #75, PDF Generation #76 are separate,
  not-yet-drafted specs — this spec's screens reserve the `export` permission action and
  a UI affordance placeholder only; see Do Not)
- Barcode-scan-level or POS-style analytics (no such billing mode exists yet, per
  `phase-tracker.md` #77)

---

# Project Context

Before implementation, review

- `architecture-context.md` (Core Engines → Reporting Engine; Module Boundaries → Reports:
  "Reports never modify business data"; Invariant 3, 9)
- `ai-workflow-rules.md` (Engine Usage Rules: "Reports → Reporting Engine"; "Business
  logic must never be duplicated")
- `38-sales-invoice.md` (**read in full** — the posted `SalesInvoice`/`SalesInvoiceItem`
  shape this spec's Sales Register and Item-wise report read from; `customerMode`/
  `CustomerMode` for how a Quick/Walk-in sale is labeled in the register; `status` values)
- `39-sales-return.md` (`SalesReturn`/`SalesReturnItem` — the Sales Return Summary's
  source)
- `40-credit-note.md` / `41-debit-note.md` (read for context on why they are deferred —
  see Goal)
- `35-quotations.md` / `36-sales-orders.md` / `37-delivery-challans.md` (read for context
  on why they are out of MVP scope — see Goal; no data from these three is read here)
- `26-customer-management.md` (`Customer`/`Ledger` shape — Party-wise Sales joins against
  `Customer`, not a duplicated party concept)
- `31-voucher-engine.md` (`voucherEngine.getLedgerBalance`/`getLedgerStatement` — **not**
  called by this spec directly; Customer Reports, `71-customer-reports.md`, is where
  outstanding-balance reporting lives; this spec's Party-wise Sales Summary reports sales
  *value*, never outstanding balance, to avoid overlapping that sibling spec)
- `71-customer-reports.md` (cross-reference — Customer Reports' own "Customer Sales
  Summary" view reuses this spec's Party-wise Sales aggregation rather than re-deriving
  it; read together if implementing both)

---

# Module Responsibilities

The Sales Reports module is responsible for

- Four read-only report views (Sales Register, Item-wise Sales, Party-wise Sales Summary,
  Sales Return Summary), each with its own filter set (see Business Rules)
- Composing already-existing Sales-module service calls and two new aggregate query
  methods (added to the owning `sales-invoice` module, not this one — see Service /
  Repository) into report view-models
- A `/reports/sales` route (or a section of a shared `/reports` hub — see UI) presenting
  the four views

The Sales Reports module is **not** responsible for

- Any write, status transition, or correction to a Sales document (Invariant 3 — a report
  cannot re-post, edit, or cancel anything; every action button a Sales document itself
  exposes stays on that document's own screens)
- GST, pricing, or stock recalculation of any kind — every number shown is a stored value
  from a posted document or a plain sum/group of stored values, never a re-run of
  `gstEngine.calculateLine`/`pricingEngine.resolvePrice`/`inventoryEngine.recordMovements`
- Customer outstanding-balance/statement reporting (`71-customer-reports.md`'s job,
  reusing this spec's party-wise aggregation for the sales-value column only)
- Quotation/Sales Order/Delivery Challan reporting (deferred — see Goal)
- Excel/PDF export mechanics (forward-note only, #75/#76)
- Dashboard widgets (the Dashboard is its own Core Engine consumer per
  `architecture-context.md`; if it later shows a "today's sales" tile, that is the
  Dashboard's own forward-noted integration, not built here)

---

# Data Model

**No new Prisma model, enum, or migration.** Every view is a read-only query over
`SalesInvoice`/`SalesInvoiceItem` (spec 38) and `SalesReturn`/`SalesReturnItem` (spec 39),
already fully populated by those documents' own posting logic. This is a pure
presentation feature (Invariant 3: "Reports are read-only").

If a future need arises for a report-specific denormalized/cached column (e.g. a
materialized monthly sales summary for performance at very large data volumes), that is a
deliberate, separately-justified performance optimization for a later phase — not
introduced speculatively here (YAGNI, `code-standards.md`).

---

# Business Rules

Each view is defined by its filter set and its grouping/columns. All four are scoped to
the requesting user's own company (`companyId` from `getCurrentCompanyUser()`) and, by
default, to **`POSTED`** documents only — a `DRAFT` or `CANCELLED` invoice/return carries
no real financial or stock consequence yet (or had it reversed), so it is excluded from
every aggregate by default; a report is not the place a business reconciles draft data.

## 1. Sales Register

- Filters: date range (`invoiceDate` from/to, required, defaulting to the current
  Financial Year's range), `financialYearId` (optional — Sales Invoice is FY-scoped;
  defaults to the active FY), `customerId` (optional), `status` (optional, defaults to
  `POSTED`; a user with `reports.view` may still choose to include `DRAFT`/`CANCELLED`
  for reconciliation purposes — this is the one view that supports a non-default status
  filter, since "which invoices exist and in what state" is exactly a register's job).
- Columns: Invoice Number, Date, Customer (resolved display name — `customer.ledger.name`
  for `PERMANENT`/converted-`QUICK`, `quickCustomerName` for an unconverted `QUICK` sale,
  literal "Walk-in" for `WALK_IN`), Taxable Amount, Total Tax (Σ cgst+sgst+igst+cess),
  Grand Total, Amount Paid, Status.
- **No branch filter** — `SalesInvoice` carries no `branchId` (per `38-sales-invoice.md`'s
  own explicit deferral, still unresolved as of this spec), so there is nothing to filter
  by; this is recorded here rather than silently omitted, since Branch Management itself
  has since shipped (`12-branch-management.md`) even though Sales documents never adopted
  the column.
- Reuses `salesInvoiceService.listSalesInvoices(filters)` (spec 38, already implemented
  with the required date/status/customer filter support per that spec's own UI section)
  — **no new repository method needed for this view.**

## 2. Item-wise Sales Report

- Filters: date range (required), `financialYearId` (optional), `productId` (optional —
  omitted shows every product), `warehouseId` (optional), `customerId` (optional).
- Columns, grouped by product: Product Name/Code, Total Quantity Sold, Total Taxable
  Value, Total Tax, Total Value, Invoice Count (number of distinct invoices the product
  appeared on within the filter).
- Aggregates only `POSTED` `SalesInvoiceItem` rows (joined to their parent `SalesInvoice`
  for the date/customer/FY filters) — grouped by `productId`, summed.
- **New repository method required** (see Service / Repository) — no existing Sales
  Invoice query groups by product across invoices; this is a genuinely new read query,
  not a duplication of one that already exists.

## 3. Party-wise Sales Summary

- Filters: date range (required), `financialYearId` (optional).
- Columns, grouped by customer: Customer Name, Invoice Count, Total Taxable Value, Total
  Tax, Total Grand Total. **Walk-in and unconverted-Quick sales are grouped into two
  synthetic rows** ("Walk-in Sales" and "Quick Customer Sales (unconverted)") rather than
  silently omitted or incorrectly merged into one "no customer" bucket — a Walk-in sale
  has no `customerId` at all, and an unconverted Quick sale has a name but no `Customer`
  row to group by; treating them as distinct, clearly-labeled synthetic groups is more
  honest than either dropping them from the total or inventing a shared "Other" bucket
  that would hide the difference between the two.
- **Does not include outstanding-balance data** — this view answers "how much did we sell
  to this customer," not "how much do they currently owe us" (that is
  `71-customer-reports.md`'s Customer Outstanding Report, reading the Voucher Engine's
  `getTrialBalance`/`getLedgerBalance` instead). Keeping the two questions in their
  owning specs avoids one view silently duplicating the other's data source.
- **New repository method required** (see Service / Repository).

## 4. Sales Return Summary

- Filters: date range (`returnDate` from/to, required), `financialYearId` (optional),
  `customerId` (optional, resolved via the return's parent invoice's customer — see
  below), `status` (optional, defaults to `POSTED`).
- Columns: Return Number, Source Invoice Number, Date, Customer (resolved from the
  parent invoice, since `SalesReturn` itself has no direct `customerId` column per spec
  39's schema), Grand Total, Refund Mode, Status. A totals footer (Σ Grand Total across
  the filtered rows) is computed in this module's own service — a plain sum for display,
  not a business-rule computation, so it does not violate the "no business logic in
  Reports" boundary.
- Reuses `salesReturnService.listSalesReturns(filters)` (spec 39) joined to each return's
  `salesInvoice.customer` for the customer column and filter — **no new repository
  method needed**, since spec 39's existing list already includes the invoice
  relation needed for this join (confirm at implementation time; if it does not, extend
  `sales-return-repository.ts`'s existing list query to include the relation, which is
  additive to an existing method, not a new duplicated one).

---

# Service / Repository

**Amend** the existing Sales Invoice module (not a new repository — this spec has no
table of its own):

```text
src/modules/sales-invoices/repositories/sales-invoice-repository.ts  // + aggregateItemWiseSales, aggregatePartyWiseSales
src/modules/sales-invoices/services/sales-invoice-service.ts         // + getItemWiseSalesReport, getPartyWiseSalesReport
```

- `salesInvoiceRepository.aggregateItemWiseSales(companyId, filters)` — a Prisma
  `groupBy` on `SalesInvoiceItem.productId` joined through `salesInvoice` for the
  date/FY/customer/status filters, summing `quantity`, `taxableAmount`,
  `cgst+sgst+igst+cess`, `totalAmount`, and counting distinct `salesInvoiceId`.
- `salesInvoiceRepository.aggregatePartyWiseSales(companyId, filters)` — a `groupBy` on
  `SalesInvoice.customerId` (with `null`/`WALK_IN`/unconverted-`QUICK` rows bucketed
  separately per Business Rules) for the date/FY filters, summing `taxableAmount`,
  tax totals, `grandTotal`, counting invoices.
- `salesInvoiceService.getItemWiseSalesReport(filters)` /
  `getPartyWiseSalesReport(filters)` — thin pass-throughs exposing the two new
  repository methods as this module's public API (the same "repository owns Prisma,
  service is the only cross-module entry point" layering every module in this codebase
  already follows). **This is the method Customer Reports (`71-customer-reports.md`)
  calls for its own Customer Sales Summary view** — cross-module reads go through this
  service method, never through `sales-invoice-repository.ts` directly (Invariant 5:
  "modules communicate through shared services").

**Create** (this spec's own module — no repository, since it owns no table, the same
posture `52-payment-voucher.md` took for having no table of its own):

```text
src/engines/reporting/sales-reports.ts       // buildSalesRegister, buildItemWiseSalesReport, buildPartyWiseSalesReport, buildSalesReturnSummary
src/modules/reports/sales/services/sales-report-service.ts
src/modules/reports/sales/actions/sales-report-actions.ts
src/modules/reports/sales/components/…
src/types/sales-report.ts
```

- `src/engines/reporting/sales-reports.ts` — the Reporting Engine composition layer
  (per `ai-workflow-rules.md`'s "Reports → Reporting Engine" rule): pure functions
  `buildSalesRegister(companyId, filters)`, `buildItemWiseSalesReport(companyId,
  filters)`, `buildPartyWiseSalesReport(companyId, filters)`,
  `buildSalesReturnSummary(companyId, filters)` — each calls the owning module's service
  method above (`salesInvoiceService`/`salesReturnService`) and shapes the result into
  this spec's view-model types (adding the synthetic Walk-in/Quick buckets, computing the
  Sales Return Summary's totals footer). No Prisma import anywhere in this file.
- `salesReportService` (`src/modules/reports/sales/services/sales-report-service.ts`) —
  a thin service that validates filters (via `sales-report-schema.ts`) and calls the
  matching `src/engines/reporting/sales-reports.ts` function; this is the layer Server
  Actions call. Kept separate from the engine file so the module structure matches every
  other module's Repository(N/A) → Service → Action → UI shape, with the Reporting
  Engine standing in for the repository the way `voucherEngine` stands in for
  `paymentVoucherService`'s own repository (spec 52).

---

# Validation

Zod (`sales-report-schema.ts`): shared filter shape across all four views — `dateFrom`/
`dateTo` calendar dates (object-level refine `dateFrom <= dateTo`), `financialYearId`
optional uuid (server re-verifies same-company), `customerId`/`productId`/`warehouseId`
optional uuid (server re-verifies same-company where applicable), `status` optional enum
matching the relevant document's own status enum. No client-submitted totals or grouped
figures of any kind — every number in the response is server-computed from the
aggregation query, never accepted as input (there is nothing to write, so nothing to
trust or distrust from the client beyond the filter shape itself).

---

# UI

Pages

- `/reports` — a shared hub page. **Assumption, recorded explicitly**: this spec assumes
  a `/reports` hub exists or will exist (mirroring this codebase's `/masters`, `/sales`,
  `/purchase`, `/inventory`, `/employees` hub convention), shared with the sibling
  financial-reports batch (Trial Balance et al., specs 64–67/74) and the other five specs
  in this same batch (Purchase/Inventory/Customer/Supplier/Employee Reports). Whichever
  spec is implemented first establishes the hub with its own card(s); every other spec
  then adds its own cards to the existing hub rather than re-creating it. This spec does
  not claim exclusive ownership of `/reports` itself.
- `/reports/sales` — Sales Reports section (four cards/tabs, one per view: Sales
  Register, Item-wise Sales, Party-wise Sales Summary, Sales Return Summary)
- `/reports/sales/register` — Sales Register (filter bar + table, as Business Rules
  describes)
- `/reports/sales/item-wise` — Item-wise Sales Report
- `/reports/sales/party-wise` — Party-wise Sales Summary
- `/reports/sales/returns` — Sales Return Summary

Components (`src/modules/reports/sales/components/`): a shared `ReportFilterBar` (date
range + the view-specific optional filters, URL-state pattern per this codebase's
existing `ProductFilterBar` convention), four report table components (one per view,
each with a totals footer row where applicable), no chart/graph in this first cut (a
future visual-summary enhancement, not required by the tracker item).

Wire-up

- Add a "Sales Reports" card to `/reports` (or create the hub if this spec lands first —
  see Assumption above).
- Add `reports: "Reports"`, `sales: "Sales Reports"` (parent/segment disambiguation
  against the existing bare `sales` key already used by `/sales` — use `"reports/sales"`
  as the breadcrumb key exactly as `breadcrumbs.ts`'s own documented convention
  prescribes for a segment reused by more than one section), `register: "Sales
  Register"`, `"item-wise": "Item-wise Sales"`, `"party-wise": "Party-wise Sales"` to
  `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `reports` permission module (`src/constants/permissions.ts`'s
`PERMISSION_MODULES` — already present): `view` for every screen in this spec, `export`
reserved for the future Excel/PDF export buttons (#75/#76 — see Do Not; the button may be
rendered disabled/placeholder, or omitted entirely, implementer's choice, but the
permission action itself is not newly invented — it already exists in
`PERMISSION_ACTIONS` and the seeded Sales/Purchase/Store Manager roles already carry
`reports.view`/`reports.export`/`reports.create` per the existing role-seed data in
`src/constants/permissions.ts`). No new permission module or action. All reads are
company-scoped through `getCurrentCompanyUser()`; no report ever accepts a company id
from the client.

---

# Database

No new model, enum, or migration. See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no GST/pricing/stock arithmetic anywhere in this module (a
report only sums and groups already-computed, already-stored values), Repository(amended)
→ Reporting Engine → Service → Action → UI layering, vitest coverage for:

- `aggregateItemWiseSales`/`aggregatePartyWiseSales` correctness against a seeded
  multi-invoice, multi-product, multi-customer fixture (including a mixed
  `PERMANENT`/`QUICK`/`WALK_IN` fixture for the synthetic-bucket rule)
- default `POSTED`-only filtering, and the Sales Register's own support for a
  non-default status filter
- date-range/FY/customer/product/warehouse filter combinations, including empty-range
  and cross-company id rejection
- the Sales Return Summary's totals-footer sum matches a hand-computed fixture
- no test exercises any GST/pricing/stock engine call from this module (a structural
  grep-style assertion, mirroring the codebase's "no arithmetic outside its owning
  engine" convention applied in reverse — this module owns no arithmetic engine at all)

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration
- Any write, status transition, correction, or cancellation of a Sales document
- GST, pricing, or stock recalculation of any kind
- Quotation, Sales Order, or Delivery Challan reporting (deferred — see Goal)
- Credit Note / Debit Note dedicated registers (deferred — see Goal)
- A Quotation→Order→Invoice conversion-funnel or win-rate report (deferred — see Goal)
- Margin/profitability analysis (deferred — see Goal; Purchase Reports, `69-purchase-
  reports.md`, is a prerequisite for that future feature, not built here)
- Excel/PDF export mechanics (#75/#76 — forward-note only)
- Customer outstanding-balance or statement reporting (`71-customer-reports.md`'s job)
- Dashboard widgets or scheduled/emailed report delivery (no such infra exists)
- Branch-dimension filtering (Sales documents carry no `branchId` — see Business Rules)

---

# Success Criteria

Verify

- The Sales Register lists `POSTED` Sales Invoices by default within a date range,
  correctly labels `PERMANENT`/`QUICK`/`WALK_IN` customers, and supports an explicit
  status override.
- The Item-wise Sales Report's per-product sums (quantity, taxable value, tax, total
  value, invoice count) match a hand-computed fixture spanning multiple invoices and a
  mixed-rate/mixed-cess product set.
- The Party-wise Sales Summary correctly groups `PERMANENT` customers by their own
  identity and buckets Walk-in/unconverted-Quick sales into their own labeled synthetic
  rows, with sums matching a hand-computed fixture.
- The Sales Return Summary correctly resolves each return's customer from its parent
  invoice and its totals footer sums correctly.
- Every view rejects a cross-company filter id (customer/product/warehouse/FY) as
  not-found/empty rather than leaking another company's data.
- No test or code path in this module calls `gstEngine`, `pricingEngine`, or
  `inventoryEngine`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/sales*` appears in the build route table.

Feature-spec 68 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #66.
Feature-spec 69 (Purchase Reports, tracker #67) mirrors this spec's shape from the
purchase side. Feature-spec 71 (Customer Reports, tracker #69) reuses
`salesInvoiceService.getPartyWiseSalesReport` for its own Customer Sales Summary view.
