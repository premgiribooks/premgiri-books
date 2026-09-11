# 70 - Inventory Reports

> Feature-spec file number 70. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 10 — Reporting** item **#68 Inventory Reports**. Depends on Inventory (the
> Inventory Engine, feature-spec 32, and all six Phase 5 documents, feature-specs
> 46–51: Opening Stock, Stock Adjustment, Stock Transfer, Physical Verification, Batch
> Tracking, Serial Number Tracking — all implemented). Documentation only, drafted
> 2026-09-11. Read `32-inventory-engine.md` first in full — unlike `68-sales-
> reports.md`/`69-purchase-reports.md`, this spec introduces **no new repository
> aggregation methods on any owning module** — the Inventory Engine already exposes
> exactly the query primitives this spec needs (`getCurrentStock`, `getStockLedger`,
> `getStockValuation`), reserved for exactly this consumer since spec 32 shipped.

## Goal

Implement **Inventory Reports** for **Premgiri Books ERP** — read-only presentation over
the Inventory Engine's already-existing stock-query primitives and the six Phase 5
documents' posted data. No new Prisma model, no new stock arithmetic: every figure this
spec shows is computed by `inventoryEngine.getCurrentStock`/`getStockLedger`/
`getStockValuation` (spec 32) or is a plain comparison against an existing master field
(`Product.minStockLevel`).

**MVP scope decision, stated up front.** `32-inventory-engine.md`'s own Module
Responsibilities names exactly the reports this phase is reserved to build: "Stock
queries: current stock (by product/warehouse), stock ledger, and valuation at Latest
Purchase Cost (the data primitives Reports #67 and the Dashboard's low-stock alerts will
render)" and "Reorder alerts (`Product.minStockLevel` comparison is a Dashboard/Reports
read over this engine's `getCurrentStock`)." This spec builds exactly those four views:

**In scope:**
1. Current Stock Report
2. Stock Ledger / Movement History (per product)
3. Stock Valuation Report (Latest Purchase Cost)
4. Low Stock / Reorder Report (vs. `Product.minStockLevel`)

**Explicitly deferred:**
- Batch-wise stock/ledger views (`getBatchStock`/`getBatchLedger` — spec 50's own query
  primitives, reserved and already implemented for exactly this kind of report, but not
  wired into a screen here; a natural, cheap follow-up once this spec's product-level
  views exist to extend, not built now to keep this spec's scope matching the tracker's
  literal ask)
- Serial number status/history listing (`getSerialStatus` — spec 51's own primitive,
  same deferral reasoning as batch-wise views; Serial Number Tracking's own Product
  Detail Page tab, per spec 51's UI section, already shows per-serial status today —
  this spec does not duplicate that view at the report level)
- Stock movement analytics beyond a per-product ledger (e.g. a cross-product "movement
  volume by type" dashboard chart — a Dashboard-engine concern per
  `architecture-context.md`'s Core Engines list, not a Reports-module screen)
- FIFO/Weighted Average valuation (`architecture-context.md`'s Costing Strategy —
  Latest Purchase Cost is the only method this codebase implements; `getStockValuation`
  has no other mode to read)
- Excel/PDF export mechanics (#75/#76 — forward-note only)

---

# Project Context

Before implementation, review

- `32-inventory-engine.md` (**read in full** — `getCurrentStock(companyId, {productId?,
  warehouseId?})`, `getStockLedger(companyId, productId, {warehouseId?, from?, to?})`,
  `getStockValuation(companyId, {warehouseId?})`; the "no stock-quantity column
  anywhere" invariant this spec must never violate by caching a number itself)
- `architecture-context.md` (Costing Strategy — Latest Purchase Cost; Core Engines →
  Reporting Engine)
- `25-product-management.md` (`Product.minStockLevel`, `Product.productType` — only
  `TRADING` products carry stock; `Unit.decimalPlaces` for quantity display precision)
- `24-warehouse-management.md` (`Warehouse` — the location dimension every view can
  optionally filter/group by)
- `46-opening-stock.md` through `51-serial-number-tracking.md` (context for why
  batch/serial views are deferred — see Goal; no new logic from these six is added here,
  their posted `StockTransaction` rows simply flow through the same engine queries this
  spec already reads)

---

# Module Responsibilities

The Inventory Reports module is responsible for

- Four read-only report views (Current Stock, Stock Ledger, Stock Valuation, Low
  Stock/Reorder), each composing the Inventory Engine's existing query primitives with
  Product/Warehouse master data for display names
- A `/reports/inventory` section of the shared `/reports` hub

The Inventory Reports module is **not** responsible for

- Any stock movement, adjustment, or correction (Invariant 3, 7 — a report never calls
  `inventoryEngine.recordMovements`/`transferStock`)
- Any new stock-quantity aggregation logic — every number is read via the engine's own
  `getCurrentStock`/`getStockLedger`/`getStockValuation`, never re-derived from
  `StockTransaction` rows directly by this module
- Batch-wise or serial-level reporting (deferred — see Goal)
- Reorder **alerting** (a push notification/dashboard-badge mechanism) — this spec is a
  report *screen* a user opens and reads, not a background alert system; "Reorder
  alerts" in spec 32's own words describes the Dashboard's future consumption of the same
  `getCurrentStock` vs. `minStockLevel` comparison this spec's Low Stock Report also
  performs — the comparison logic is written once (see Service / Repository) so the
  Dashboard can reuse it later without duplicating it, but the Dashboard integration
  itself is out of scope here
- Excel/PDF export mechanics (forward-note only, #75/#76)

---

# Data Model

**No new Prisma model, enum, or migration.** Every view reads `StockTransaction` (spec
32) exclusively through the engine's existing query functions, plus `Product`/
`Warehouse` master rows for display. This is the cleanest of the six specs in this batch
on this point — the engine already anticipated and reserved every query this spec needs.

---

# Business Rules

Scoped to the requesting user's own company. **No financial-year scoping on any view** —
`StockTransaction` deliberately carries no `financialYearId` (spec 32's own decision:
"stock is continuous across financial years... date filtering covers reporting"), so
every view here filters by plain date range only, never by FY, consistent with that
decision rather than silently reintroducing an FY dimension the underlying data doesn't
have.

## 1. Current Stock Report

- Filters: `warehouseId` (optional — omitted shows every warehouse, grouped),
  `productId` (optional — omitted shows every `TRADING` product with any recorded
  movement or an explicit "show zero-stock products too" toggle, since a product with no
  movement yet has a current stock of exactly zero and is still a legitimate row a
  business wants to see on this report, e.g. to confirm nothing has moved for a new
  product).
- Columns: Product Name/Code, Warehouse, Current Stock (Σ IN − Σ OUT, from
  `getCurrentStock`), Unit.
- Calls `inventoryEngine.getCurrentStock(companyId, {warehouseId?})` (no `productId`
  filter, to get the full grid) and joins the result to `productService`/
  `warehouseService` for display names — **exactly the primitive spec 32 reserved for
  this report**, no new query needed.

## 2. Stock Ledger / Movement History

- Filters: `productId` (**required** — the engine's `getStockLedger` signature is
  per-product; this spec's MVP is a single-product ledger view with a product picker,
  not a cross-product register — see Goal's deferred cross-product analytics),
  `warehouseId` (optional), date range (optional — omitted shows full history).
- Columns: Date, Transaction Type, Direction, Quantity, Running Balance, Reference
  (`referenceType`/`referenceId`, resolved to a friendly label where a matching document
  module is known — e.g. "Sales Invoice #INV-0001" — falling back to the raw
  `referenceType` string when the reference is null or unrecognized, such as a manual
  Opening Stock/Adjustment entry with no separate document header per those specs' own
  Data Model decisions).
- Calls `inventoryEngine.getStockLedger(companyId, productId, {warehouseId?, from?,
  to?})` directly — no new query needed.

## 3. Stock Valuation Report

- Filters: `warehouseId` (optional).
- Columns: Product Name/Code, Current Stock, Unit Cost (Latest Purchase Cost —
  `Product.purchasePrice`), Total Value (stock × cost), a **"cost not set" flag** for
  any product `getStockValuation` reports at zero due to a null `purchasePrice` (spec
  32's own documented behavior: "products with null `purchasePrice` value at 0 and are
  flagged in the result") — this flag is surfaced prominently in the UI (not silently
  shown as a legitimate ₹0 valuation) so a business can find and fix an un-costed
  product's master data.
- Calls `inventoryEngine.getStockValuation(companyId, {warehouseId?})` directly — no new
  query needed.

## 4. Low Stock / Reorder Report

- Filters: `warehouseId` (optional).
- Columns: Product Name/Code, Warehouse, Current Stock, Minimum Stock Level
  (`Product.minStockLevel`), Shortfall (`minStockLevel − currentStock`, shown only when
  positive).
- **New composition logic, not a new engine query**: this module's own Reporting Engine
  file calls `inventoryEngine.getCurrentStock(companyId, {warehouseId?})` and
  `productService.listSelectableProducts()` (spec 25, already exposes
  `minStockLevel`), joins the two on `productId`, and filters to rows where
  `currentStock < minStockLevel` **and** `minStockLevel` is set (a product with no
  `minStockLevel` configured has nothing to compare against and is excluded, not treated
  as "always low" or "never low"). This comparison is simple enough to live in the
  Reporting Engine composition layer without duplicating any business rule — spec 32
  itself describes this exact composition as the intended shape ("Reorder alerts...is a
  Dashboard/Reports read over this engine's `getCurrentStock`"), so writing it here is
  fulfilling that spec's own forward-note, not inventing new logic.

---

# Service / Repository

**No amendment to any existing module** — the Inventory Engine's query surface already
covers everything this spec needs; `productService.listSelectableProducts()` (spec 25)
already exposes `minStockLevel`. This is the one spec in this batch that needs no new
repository method anywhere.

**Create**

```text
src/engines/reporting/inventory-reports.ts       // buildCurrentStockReport, buildStockLedgerReport, buildStockValuationReport, buildLowStockReport
src/modules/reports/inventory/services/inventory-report-service.ts
src/modules/reports/inventory/actions/inventory-report-actions.ts
src/modules/reports/inventory/components/…
src/types/inventory-report.ts
```

- `src/engines/reporting/inventory-reports.ts` — pure composition functions:
  `buildCurrentStockReport(companyId, filters)` (calls `getCurrentStock` +
  product/warehouse name resolution), `buildStockLedgerReport(companyId, productId,
  filters)` (calls `getStockLedger` + reference-label resolution),
  `buildStockValuationReport(companyId, filters)` (calls `getStockValuation` + the
  "cost not set" flag surfacing), `buildLowStockReport(companyId, filters)` (calls
  `getCurrentStock` + `listSelectableProducts` + the join/filter described in Business
  Rules #4). No Prisma import anywhere in this file — every data access goes through
  `inventoryEngine`/`productService`/`warehouseService`'s own public functions.
- `inventoryReportService` — thin service validating filters and delegating to the
  matching engine function, the same layering `68-sales-reports.md`/`69-purchase-
  reports.md` established.

---

# Validation

Zod (`inventory-report-schema.ts`): `warehouseId`/`productId` optional uuid (server
re-verifies same-company where applicable; `productId` required specifically for the
Stock Ledger view, enforced by that view's own schema variant), `dateFrom`/`dateTo`
optional calendar dates with an object-level refine `dateFrom <= dateTo` when both are
present.

---

# UI

Pages

- `/reports` — shared hub (same Assumption note as `68-sales-reports.md`).
- `/reports/inventory` — Inventory Reports section (four cards/tabs)
- `/reports/inventory/current-stock` — Current Stock Report
- `/reports/inventory/ledger` — Stock Ledger (product picker required to load data;
  empty state prompts for a product before any table renders)
- `/reports/inventory/valuation` — Stock Valuation Report
- `/reports/inventory/low-stock` — Low Stock / Reorder Report

Components (`src/modules/reports/inventory/components/`): the shared `ReportFilterBar`
(reused if already introduced by spec 68/69), four report tables, a distinct visual
treatment (e.g. a warning badge) on the Low Stock Report's shortfall column and the
Valuation Report's "cost not set" flag — both are the two places in this spec where a
row deserves the user's attention, not just data density.

Wire-up

- Add an "Inventory Reports" card to `/reports`.
- Add `"reports/inventory": "Inventory Reports"` (parent/segment key, disambiguating
  against the existing bare `inventory` key used by `/inventory`), `"current-stock":
  "Current Stock"`, `ledger: "Stock Ledger"`, `valuation: "Stock Valuation"`,
  `"low-stock": "Low Stock"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `reports` permission module: `view`, `export` (reserved). No new
permission module or action. Company-scoped identically to every spec in this project.

---

# Database

No new model, enum, or migration.

---

# Code Standards

Strict TypeScript, no `any`, **zero stock-quantity arithmetic outside
`inventoryEngine`'s own query functions** (this module's only arithmetic is the Low
Stock Report's plain `currentStock < minStockLevel` comparison and the Valuation
Report's stock × cost, both already computed/exposed by the engine — the comparison and
multiplication themselves are display composition, not a re-derivation of stock
quantity), vitest coverage for:

- Current Stock Report's product/warehouse join correctness, including a zero-stock
  product appearing when the "show zero-stock" toggle is on
- Stock Ledger's reference-label resolution (known `referenceType` → friendly label;
  unrecognized/null → raw fallback), running balance matches `getStockLedger`'s own
  output unmodified
- Stock Valuation's "cost not set" flag appears exactly for null-`purchasePrice`
  products, correctly excluded from a naive "total value" sum unless explicitly
  included (decide and record the exact footer behavior at implementation time)
- Low Stock Report's join/filter correctness against a fixture mixing products with and
  without `minStockLevel` set, and above/below/at-threshold stock levels
- cross-company `productId`/`warehouseId` rejection on every view
- no test or code path in this module calls Prisma directly (grep-style structural
  assertion — every read goes through `inventoryEngine`/`productService`/
  `warehouseService`)

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration
- Any stock movement, adjustment, or correction call
- Any new stock-quantity aggregation logic outside the engine's existing
  `getCurrentStock`/`getStockLedger`/`getStockValuation`
- Batch-wise or serial-level report views (deferred — see Goal; the underlying
  `getBatchStock`/`getBatchLedger`/`getSerialStatus` primitives already exist and are
  reused as-is by a future follow-up, not re-derived)
- FIFO/Weighted Average valuation
- A background reorder-alert/notification mechanism (Dashboard's own future integration,
  not this spec's screen)
- Excel/PDF export mechanics (#75/#76 — forward-note only)
- Financial-year scoping on any view (`StockTransaction` has none — see Business Rules)

---

# Success Criteria

Verify

- The Current Stock Report's figures match `inventoryEngine.getCurrentStock`'s own
  output exactly for a seeded multi-product, multi-warehouse fixture, correctly showing
  zero-stock products when toggled on.
- The Stock Ledger view's running balance and ordering match
  `inventoryEngine.getStockLedger`'s own output exactly; reference labels resolve
  correctly for known types and fall back gracefully for unknown/null references.
- The Stock Valuation Report's per-product value matches `getStockValuation`'s output;
  every null-`purchasePrice` product is visibly flagged, never shown as a silent ₹0.
- The Low Stock Report correctly lists only products below their own configured
  `minStockLevel`, excluding products with no threshold set, against a hand-computed
  fixture.
- Every view rejects a cross-company `productId`/`warehouseId` filter.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/reports/inventory*` appears in the build route table.

Feature-spec 70 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item #68.
