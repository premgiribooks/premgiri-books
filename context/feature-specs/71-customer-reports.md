# 71 - Customer Reports

> Feature-spec file number 71. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 10 — Reporting** item **#69 Customer Reports**. Depends on Customers
> (feature-spec 26, implemented) and, for two of its four views, on Sales Invoice
> (feature-spec 38) and the Voucher Engine (feature-spec 31). Documentation only, drafted
> 2026-09-11. Read `68-sales-reports.md` first (for the shared Reporting Engine placement
> and its `getPartyWiseSalesReport` method this spec reuses) and `31-voucher-engine.md`
> (for `getTrialBalance`/`getLedgerStatement`, this spec's outstanding-balance/statement
> primitives) before continuing.

## Goal

Implement **Customer Reports** for **Premgiri Books ERP** — read-only presentation
combining Customer master data (`26-customer-management.md`), the Voucher Engine's
already-existing ledger-balance/statement query APIs (`31-voucher-engine.md`), and Sales
Reports' already-existing party-wise sales aggregation (`68-sales-reports.md`). No new
Prisma model, no new financial arithmetic — every balance figure comes from the Voucher
Engine's own `getTrialBalance`/`getLedgerStatement`, never re-derived from `Voucher`/
`VoucherEntry` rows directly by this module (Invariant 9: "Accounting reports derive data
only from vouchers").

**MVP scope decision, stated up front.**

**In scope (four views):**
1. Customer Outstanding Report (with credit-limit comparison)
2. Customer Statement (ledger statement for one customer)
3. Customer Sales Summary (reused from Sales Reports)
4. Customer Directory

**Explicitly deferred:**
- Ageing analysis (30/60/90-day overdue buckets). This is flagged, not silently built
  around, as a **genuine gap**: ageing requires either a per-invoice due date or a
  reliable "invoice date + `Customer.creditDays`" convention, and no Sales Invoice field
  or business rule in this codebase currently establishes which one a due-date
  calculation should use — `Customer.creditDays` exists (spec 26) but is documented there
  as advisory-only stored data with **no consumer anywhere yet** (not even Sales Invoice
  itself, per `38-sales-invoice.md`'s own deferral of credit-limit *enforcement*, the
  sibling field). Inventing a due-date convention here, inside a reporting spec, would be
  deciding a business rule that belongs in a Sales/Customer spec's own Business Rules
  section, not this one's. This is therefore recorded as an open product decision for a
  future spec to resolve (e.g. "Customer Ageing" as its own tracker item), not built
  around with an invented assumption.
- Customer-specific pricing/margin analysis (Pricing Engine/Margin Profile territory,
  `28-margin-profiles.md`/`30-pricing-engine.md` — out of this spec's scope entirely)
  entirely)
- Excel/PDF export mechanics (#75/#76 — forward-note only)
- Any Customer Ledger write, correction, or manual adjustment (a report never posts —
  Invariant 3)

---

# Project Context

Before implementation, review

- `26-customer-management.md` (**read in full** — `Customer.ledgerId`, `creditLimit`,
  `customerType`; `listCustomers`/`listSelectableCustomers`, the "no outstanding
  tracking, no credit enforcement" deferrals this spec's Outstanding Report finally
  surfaces as a *read*, not an enforcement)
- `31-voucher-engine.md` (**read in full** — `getTrialBalance(companyId,
  financialYearId, asOfDate?)`: "returns per-ledger debit/credit totals + opening
  balances... lists every ledger in the company"; `getLedgerStatement(companyId,
  ledgerId, from, to)`: "dated entries with running balance — the Cash Book / Bank Book
  / Ledger Inquiry primitive." Both are called directly by this spec, unmodified.)
- `68-sales-reports.md` (**read in full** — `salesInvoiceService.getPartyWiseSalesReport`,
  the method this spec's Customer Sales Summary view reuses rather than re-deriving)
- `13-ledger-groups.md` / `14-ledger-master.md` (the "Sundry Debtors" reserved group
  every `Customer.ledgerId` is assigned under or beneath — this spec's Outstanding Report
  filters `getTrialBalance`'s company-wide ledger list down to exactly the rows that
  match a `Customer.ledgerId`, rather than re-deriving "which ledgers are customers" from
  the ledger group tree itself)

---

# Module Responsibilities

The Customer Reports module is responsible for

- Four read-only report views (Customer Outstanding, Customer Statement, Customer Sales
  Summary, Customer Directory)
- Composing `voucherEngine.getTrialBalance`/`getLedgerStatement`, `customerService`'s
  existing methods, and `salesInvoiceService.getPartyWiseSalesReport` (spec 68) into
  report view-models
- A `/reports/customers` section of the shared `/reports` hub

The Customer Reports module is **not** responsible for

- Any write to `Customer`, `Ledger`, `Voucher`, or `VoucherEntry` (Invariant 2, 3)
- Deriving ledger balances from raw voucher entries itself — always through
  `voucherEngine`'s own query functions (Invariant 9)
- Re-deriving sales figures — always through `salesInvoiceService.getPartyWiseSalesReport`
  (spec 68), never a second independent aggregation of `SalesInvoice`/`SalesInvoiceItem`
- Credit-limit **enforcement** of any kind (still, as of this spec, advisory-only stored
  data per spec 26/38 — this spec only **presents** the comparison, it does not block
  anything)
- Ageing analysis (deferred — see Goal, a genuine open gap)
- Excel/PDF export mechanics (forward-note only, #75/#76)

---

# Data Model

**No new Prisma model, enum, or migration.** Every view reads `Customer` (spec 26),
`Voucher`/`VoucherEntry` (spec 31, exclusively through `voucherEngine`'s own query
functions), and `SalesInvoice`/`SalesInvoiceItem` (spec 38, exclusively through
`salesInvoiceService.getPartyWiseSalesReport`, spec 68). Invariant 3 ("Reports are
read-only") and Invariant 9 ("Accounting reports derive data only from vouchers") both
hold structurally: this module owns no repository and imports no Prisma client.

---

# Business Rules

All four views are scoped to the requesting user's own company and read **active
Customers only** by default for list-shaped views (an inactive customer's historical
data remains visible when specifically selected — e.g. viewing a deactivated customer's
Statement — but does not clutter a company-wide Outstanding Report unless explicitly
included via a status filter, mirroring `26-customer-management.md`'s own "deactivated
customers keep all data and simply disappear from future document lookups" posture
applied to reporting visibility rather than transactional lookups).

## 1. Customer Outstanding Report

- Filters: `financialYearId` (optional, defaults to the active FY — `getTrialBalance` is
  FY-scoped), `asOfDate` (optional, defaults to today), `status` (optional, defaults to
  active-only).
- **Query design decision**: rather than looping `voucherEngine.getLedgerBalance` once
  per customer (an N+1 query pattern), this view calls
  `voucherEngine.getTrialBalance(companyId, financialYearId, asOfDate?)` **exactly once**
  — which already "lists every ledger in the company, including ones with zero activity"
  per spec 31's own documentation — and filters/joins its per-ledger rows against
  `customerService.listCustomers()`'s own `ledgerId` values in this module's own
  composition layer. This reuses the engine's existing bulk primitive instead of adding
  a new one, and avoids a query-count blowup as the customer list grows.
- Columns: Customer Name, Customer Type, Outstanding Balance (the matched
  `getTrialBalance` row's signed net, presented debit-positive per that method's own
  documented convention — a customer who owes the business money shows a positive
  balance), Credit Limit, **Over Limit** flag (`outstandingBalance > creditLimit` when
  `creditLimit` is set; blank/not-applicable when it is not — the same "nothing to
  compare against, don't invent a default" posture Inventory Reports' Low Stock view
  takes for a product with no `minStockLevel`).
- A customer whose `ledgerId` does not appear in the `getTrialBalance` result at all
  (no voucher activity ever posted against it, including its own opening balance being
  zero) is still shown, with an outstanding balance of exactly the `Ledger`'s own
  `openingBalance` (which `getTrialBalance` already includes per its own documentation —
  "opening balances" are part of its per-ledger row, not something this spec adds).

## 2. Customer Statement

- Filters: `customerId` (**required**), date range (`from`/`to`, required).
- Columns: Date, Voucher/Document Reference (via the ledger entry's parent `Voucher`'s
  `voucherNumber`/`referenceType`+`referenceId`, resolved to a friendly label the same
  way Inventory Reports' Stock Ledger view resolves its own reference column — reused
  pattern, not re-derived independently), Debit, Credit, Running Balance. Opening/
  closing balance rows bracket the statement, exactly as `getLedgerStatement`'s own
  return shape already provides.
- Calls `voucherEngine.getLedgerStatement(companyId, customer.ledgerId, from, to)`
  directly, after resolving `customer.ledgerId` via `customerService.getCustomer(id)` —
  no new query needed on either side.

## 3. Customer Sales Summary

- Filters: date range (required), `financialYearId` (optional) — identical shape to
  `68-sales-reports.md`'s own Party-wise Sales Summary filters, since this view *is*
  that same aggregation, presented under the Customer Reports section for a user who
  starts from "tell me about this customer" rather than "tell me about my sales."
- Columns: identical to spec 68's Party-wise Sales Summary (Customer Name, Invoice
  Count, Total Taxable Value, Total Tax, Total Grand Total) **excluding the Walk-in/
  Quick-Customer synthetic rows** — those two buckets have no `Customer` master record
  to anchor a "Customer Reports" view to, so this view filters the underlying
  aggregation down to real, `Customer`-linked rows only (Walk-in/Quick sales remain
  visible in Sales Reports' own Party-wise view, which is the correct home for them).
- Calls `salesInvoiceService.getPartyWiseSalesReport(filters)` (spec 68's method,
  unmodified) and filters out the two synthetic buckets in this module's own composition
  layer — **no new aggregation logic, no second independent query of
  `SalesInvoice`/`SalesInvoiceItem`.**

## 4. Customer Directory

- Filters: `customerType` (optional), `status` (optional, defaults to active).
- Columns: Name, Type, Mobile, GSTIN, City/State, Status — a straightforward presentation
  of `customerService.listCustomers(filters)`'s existing output (spec 26), included here
  as the simplest of the four views and the one most likely to be a user's first stop
  ("show me all my customers") before drilling into Outstanding/Statement/Sales Summary
  for one of them.
- Calls `customerService.listCustomers(filters)` directly — no new query needed.

---

# Service / Repository

**No amendment to any existing module.** This spec calls only already-public methods:
`voucherEngine.getTrialBalance`/`getLedgerStatement` (spec 31, unmodified),
`customerService.listCustomers`/`getCustomer` (spec 26, unmodified),
`salesInvoiceService.getPartyWiseSalesReport` (spec 68, unmodified). This is the second
spec in this batch (after Inventory Reports) that needs no repository-level amendment
anywhere — every primitive it needs was already reserved by an earlier spec.

**Create**

```text
src/engines/reporting/customer-reports.ts       // buildCustomerOutstandingReport, buildCustomerStatement, buildCustomerSalesSummary, buildCustomerDirectory
src/modules/reports/customers/services/customer-report-service.ts
src/modules/reports/customers/actions/customer-report-actions.ts
src/modules/reports/customers/components/…
src/types/customer-report.ts
```

- `src/engines/reporting/customer-reports.ts` — pure composition functions:
  `buildCustomerOutstandingReport(companyId, filters)` (calls `getTrialBalance` +
  `listCustomers`, joins on `ledgerId`, computes the Over Limit flag),
  `buildCustomerStatement(companyId, customerId, from, to)` (calls `getCustomer` +
  `getLedgerStatement`, resolves reference labels), `buildCustomerSalesSummary(companyId,
  filters)` (calls `salesInvoiceService.getPartyWiseSalesReport`, filters out synthetic
  buckets), `buildCustomerDirectory(companyId, filters)` (calls `listCustomers`
  directly — effectively a thin re-export, kept in this file for a single, consistent
  import surface across all four views). No Prisma import anywhere in this file.
- `customerReportService` — thin service validating filters and delegating to the
  matching engine function, the same layering every other spec in this batch
  establishes.

---

# Validation

Zod (`customer-report-schema.ts`): `customerId` optional/required uuid depending on view
(required only for Customer Statement; server re-verifies same-company),
`customerType`/`status` optional enums matching `26-customer-management.md`'s own,
`financialYearId` optional uuid, `dateFrom`/`dateTo`/`asOfDate` calendar dates with the
standard `dateFrom <= dateTo` refine where both are present.

---

# UI

Pages

- `/reports` — shared hub (same Assumption note as `68-sales-reports.md`).
- `/reports/customers` — Customer Reports section (four cards/tabs)
- `/reports/customers/outstanding` — Customer Outstanding Report
- `/reports/customers/statement` — Customer Statement (customer picker required before
  the statement table renders)
- `/reports/customers/sales-summary` — Customer Sales Summary
- `/reports/customers/directory` — Customer Directory

Components (`src/modules/reports/customers/components/`): shared `ReportFilterBar`
(reused), a Customer Picker (reused from `26-customer-management.md`'s existing
`listSelectableCustomers()`-backed picker component if one already exists — do not
duplicate), four report tables, an "Over Limit" badge on the Outstanding Report matching
this codebase's existing warning-badge visual convention.

Wire-up

- Add a "Customer Reports" card to `/reports`.
- Add `"reports/customers": "Customer Reports"` (parent/segment key, disambiguating
  against the existing bare `customers` key used by `/masters/customers`),
  `outstanding: "Outstanding"`, `statement: "Statement"`, `"sales-summary": "Sales
  Summary"`, `directory: "Directory"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `reports` permission module: `view`, `export` (reserved). No new
permission module or action. Company-scoped identically to every spec in this project —
every call into `voucherEngine`/`customerService`/`salesInvoiceService` passes the
requesting user's own `companyId`, never a client-supplied value.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Strict TypeScript, no `any`, **zero ledger-balance or sales-total arithmetic outside
`voucherEngine`/`salesInvoiceService`'s own functions** (this module's only arithmetic is
the Over Limit boolean comparison, a plain presentation composition, not a financial
computation), vitest coverage for:

- `buildCustomerOutstandingReport`'s join correctness against a seeded fixture (some
  customers with voucher activity, some with only an opening balance, some with none at
  all — all three must still appear correctly per Business Rules)
- the Over Limit flag appears exactly when `outstandingBalance > creditLimit` and stays
  blank/not-applicable when no `creditLimit` is set
- `buildCustomerStatement` matches `getLedgerStatement`'s own output exactly for a
  fixture spanning multiple vouchers
- `buildCustomerSalesSummary` correctly excludes the Walk-in/Quick synthetic buckets that
  `salesInvoiceService.getPartyWiseSalesReport` itself returns
- cross-company `customerId`/`financialYearId` rejection on every view
- no test or code path in this module calls `voucherRepository`/`prisma` directly, or
  re-implements ledger-balance math independently of `voucherEngine`

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration
- Any write to `Customer`, `Ledger`, `Voucher`, or `VoucherEntry`
- A second, independent ledger-balance or sales-aggregation query bypassing
  `voucherEngine`/`salesInvoiceService`
- Ageing analysis of any kind (a genuine open gap — see Goal; requires a due-date
  convention decision this spec deliberately does not invent)
- Credit-limit enforcement (still advisory-only; this spec only presents the comparison)
- Customer-specific pricing/margin analysis
- Excel/PDF export mechanics (#75/#76 — forward-note only)

---

# Success Criteria

Verify

- The Customer Outstanding Report's balances match `voucherEngine.getTrialBalance`'s own
  output exactly (via the `ledgerId` join), including customers with zero voucher
  activity showing their opening balance correctly, against a hand-computed fixture.
- The Over Limit flag is correct for every combination of set/unset `creditLimit` and
  above/below/at-limit balances.
- The Customer Statement matches `getLedgerStatement`'s own output exactly for a
  hand-computed fixture, with correctly resolved reference labels.
- The Customer Sales Summary matches `salesInvoiceService.getPartyWiseSalesReport`'s own
  per-customer rows exactly, with the Walk-in/Quick synthetic buckets excluded.
- The Customer Directory matches `customerService.listCustomers`'s own output.
- Every view rejects a cross-company `customerId`/`financialYearId`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/customers*` appears in the build route table.

Feature-spec 71 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #69.
Feature-spec 72 (Supplier Reports, tracker #70) mirrors this spec's shape from the
supplier/payables side.
