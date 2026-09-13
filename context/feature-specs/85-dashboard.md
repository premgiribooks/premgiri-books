# 85 - ERP Dashboard

> Feature-spec file number 85 (spec-file numbers are sequential and never reused — the
> highest prior file is `84-navigation-ia-overhaul.md`). This feature is
> `context/Phases/phases.md`'s **Phase 10 — Reports** first-listed module, "Dashboard
> Reports" — but it was **never assigned a tracker number** when
> `context/Phases/phase-tracker.md`'s own Phase 10 breakdown was drafted (that breakdown
> enumerates exactly eleven items, tracker `#62`–`#72`, Trial Balance through GST Reports,
> and Phase 10 was marked fully complete without a twelfth "Dashboard" item ever
> appearing). This is a genuine documentation gap, recorded here rather than silently
> fixed, per `ai-workflow-rules.md`'s "if existing code conflicts with the documentation,
> prefer the documented architecture and record the discrepancy" rule (the same posture
> applied when Phase 8 later grew two extra items). **Resolution**: this feature is
> assigned **tracker `#82`** (continuing the sequence after GSTR-2/ITC Register, `#80`/
> `#81` — the highest tracker number in use), added as a twelfth item to the
> already-"complete" Phase 10, exactly mirroring how Phase 8 grew `#80`/`#81` after its
> own four-item batch closed. Depends on every Phase 10 report module (specs 64–74, all
> implemented), the Reporting Engine (`src/engines/reporting/`), the permission system
> (feature-spec 11), and the navigation overhaul (feature-spec 84, whose `NAVIGATION`
> tree already reserves the `/` route for this exact feature).

## Goal

Implement the **ERP Dashboard** — the landing page at `/` for every authenticated
**COMPANY** user (PLATFORM/Super Admin users never reach it; see Security) — as
Premgiri Books ERP's central command center. Today `/` (`src/app/page.tsx`) is a bare
placeholder: it resolves Company → Financial Year → Branch context and renders the
single line `"Premgiri Books ERP — application shell ready."` inside `AppShell`. This
spec replaces that placeholder with a real, permission-aware, data-driven home screen
that lets a user open the app and immediately see business position, what needs
attention, and where to act — **without opening every module first**.

**This spec adds zero new business logic, zero new calculations, and (with one narrow
exception — see Data Model) zero new Prisma schema.** Every figure the Dashboard shows
is read from the Reporting Engine functions and module services Phase 10 (and earlier
phases) already built and shipped. The Dashboard's own new code is a thin composition/
presentation layer: it decides *which* existing service to call for each widget, calls
it with the right scoping (company/branch/financial year) and the right permission gate,
and lays the results out as tiles, lists, and quick-action links. This mirrors
`74-gst-reports.md`'s own precedent exactly (a "dashboard" that adds no new aggregation,
built entirely on siblings' existing output) — this spec is a larger, cross-module
version of that same pattern.

**What this spec explicitly is not**: it is not `phases.md`'s Phase 11 "Dashboard
Customization" item (drag-and-drop widget layout, per-user widget add/remove/reorder
persistence) — that remains a separate, later spec. This spec's personalization is
*permission-based only*: different roles see different widgets because they lack the
underlying module's `view` permission, not because they configured a layout.

---

# Project Context

Before implementation, review

- `src/app/page.tsx` — the current placeholder this spec replaces in full (Company →
  Financial Year → Branch resolution and redirect logic stays exactly as-is; only the
  body below `AppShell` changes).
- `64-trial-balance.md` — establishes `src/engines/reporting/` as the Reporting Engine's
  home and its convention (pure functions, no I/O, no permission checks — permission
  gating and I/O live one layer down in each module's service).
- `74-gst-reports.md` — **read in full**, it is the closest existing precedent: a
  dashboard-shaped screen built entirely by composing prior specs' outputs, with an
  explicit double-permission-gate pattern (`reports:view` **and** the source module's own
  `view` action) this spec reuses per-widget.
- `65-profit-and-loss.md` / `66-balance-sheet.md` / `67-cash-flow.md` / `68-sales-
  reports.md` / `69-purchase-reports.md` / `70-inventory-reports.md` / `71-customer-
  reports.md` / `72-supplier-reports.md` — each widget below names the exact existing
  service/engine function it reuses; skim each spec's own Engine/Service section to
  confirm current signatures before wiring a call.
- `84-navigation-ia-overhaul.md` — `DASHBOARD_ITEM` (`src/config/navigation.ts`) already
  reserves `leaf("Dashboard", "/", LayoutDashboard)` at the top of `NAVIGATION`, currently
  with **no `permissionModule`** (so it renders for any authenticated COMPANY user
  regardless of role — see Business Rules for why this spec adds one).
- `11-role-permissions.md` — `assertPermission(user, module, action)` /
  `hasPermission(...)`; the `"dashboard"` permission module already exists in
  `src/constants/permissions.ts` and is already seeded with `{module: "dashboard",
  action: "view"}` on every default role (Company Admin, Accountant, Sales, Purchase,
  Store Manager, Employee) — no Permission catalog change needed.
- `src/lib/system-context.ts` (`resolveSystemContext()`) and `src/lib/current-company.ts`
  / `current-financial-year.ts` / `current-branch.ts` — the Dashboard is the first screen
  most users see per session, so it must use the standard, already-`cache()`-deduped
  context resolution rather than re-deriving it.

---

# Module Responsibilities

The Dashboard module (`src/modules/dashboard/`) is responsible for

- One `/` page composing read-only summary widgets, each backed by an existing report/
  engine service, scoped to the current Company + Financial Year (+ Branch, where the
  underlying service already supports branch scoping)
- Deciding, per widget, whether the current user's permissions allow it to render at all
  (permission-based personalization — see Security)
- Alerts/exceptions surfaced from existing data (low stock, overdue receivables, GST
  filing due, documents pending approval)
- Quick Actions: a permission-gated grid of links into existing create-forms (no new
  forms, no duplicate workflows)
- Recent Activity: a read-only feed built from existing documents' `createdAt`, not from
  `AuditLog` (see Business Rules — `AuditLog` cannot serve this role)
- Top Performers: re-slicing existing party-wise/item-wise report output to a "top N,
  sorted" view — no new ranking logic beyond a sort + limit

The Dashboard module is **not** responsible for

- Any new financial, GST, pricing, or inventory calculation (Invariant 4/6/7/8 — those
  remain the Pricing/Inventory/GST/Voucher Engines' exclusive responsibility; this module
  only reads their already-computed output)
- Dashboard Customization (Phase 11) — layout persistence, widget reordering, widget
  add/remove, per-user saved views
- A general-purpose audit trail (`80-audit-logs.md` / `architecture-context.md`'s Known
  Implementation Gaps item 3 own that; this spec neither writes to nor extends
  `AuditLog`)
- Any new report screen under `/reports/**` or `/gst/**` — every widget either summarizes
  or deep-links to an existing report page, never re-implements one

---

# Data Model

**No new Prisma model, enum, or migration for the Dashboard's data itself** — matching
Invariant 3 ("Reports are read-only") and every Phase 10 spec's own "no schema" posture.
Every widget reads already-existing tables (`SalesInvoice`, `PurchaseInvoice`, `Voucher`/
`VoucherEntry`, `Ledger`, `StockTransaction`, `Product`, `Customer`, `Supplier`,
`GstFilingRecord`, `Employee`/`Attendance`) through the services named below.

**One narrow, optional exception, explicitly deferred rather than built now**: a future
"dismiss this alert" or "collapse this widget" preference would need a small per-user
preference row. This spec does **not** introduce one — every widget renders unconditionally
whenever its underlying data and permission allow it (no dismiss/snooze state in this
version). If a later iteration wants dismissible alerts, that is new schema and belongs
in a follow-up spec (likely folded into Phase 11's Dashboard Customization), not smuggled
into this one.

---

# Business Rules

## Scoping

- Every widget is scoped to `getCurrentCompany()` + `getCurrentFinancialYear()`,
  identical to every other module (Invariant: company data must remain isolated). Widgets
  whose underlying service already supports branch scoping (most inventory/sales/purchase
  queries) additionally scope to `getCurrentBranch()` when a branch is selected; a company
  with no branches (a fully valid state per `12-branch-management.md`) simply omits the
  branch filter, never blocks the Dashboard.
- Switching Company, Branch, or Financial Year (existing context switchers) must
  re-resolve every widget against the new context — no widget may cache data across a
  context switch. Since every widget's data-fetching function takes `companyId`/
  `financialYearId`/`branchId` as explicit arguments (the existing services' own
  signatures), this falls out naturally from Next.js re-rendering the Server Component
  tree on navigation/context-cookie change; no bespoke cache-invalidation logic is needed.

## Widget → existing data source mapping

No widget below invents a new aggregation query where an existing one already computes
the figure. Where the existing service returns more than the Dashboard needs (e.g. a full
paginated register), the Dashboard calls it with a tight filter (date range, `limit`) —
it never re-derives the underlying SQL.

| Widget | Reused source | Notes |
| --- | --- | --- |
| Sales Today / This Month (KPI tile) | `68-sales-reports.md`'s sales register service (`SalesInvoice` aggregate scoped to today / month-to-date) | A tight `groupBy`/`_sum` over `SalesInvoice.grandTotal` for `status: POSTED`, `invoiceDate` in range — same aggregation shape as the register, just date-scoped and totals-only, not the full row-level register |
| Purchase Today / This Month (KPI tile) | `69-purchase-reports.md`'s purchase register service, mirrored | Same shape as Sales, over `PurchaseInvoice` |
| Cash & Bank Balance | `64-trial-balance.md`'s / `66-balance-sheet.md`'s existing ledger-balance aggregation (opening balance + posted `VoucherEntry` sums), filtered to the Cash-in-Hand ledger group and `BankAccount`-linked ledgers | Verify at Analysis whether Trial Balance's balance computation is already exposed as a reusable function or is currently private to that service — if private, extract it to a shared helper (DRY) rather than duplicating the Debit/Credit summing logic a second time |
| Receivables (Total Outstanding) | `71-customer-reports.md`'s outstanding-balance service (same data `/reports/customers/outstanding` renders) | Dashboard calls it for a grand total + top-N aging, not the full customer-wise table |
| Payables (Total Outstanding) | `72-supplier-reports.md`'s outstanding-balance service, mirrored | Same shape as Receivables |
| Low Stock Alerts | `70-inventory-reports.md`'s `buildLowStockReport` (`Product.minStockLevel` vs. computed current stock) | Renders the count + top offenders; full list links to `/reports/inventory/low-stock` |
| Monthly Sales / Purchase Trend | `68-sales-reports.md` / `69-purchase-reports.md` services, bucketed by calendar month the same way `gst-dashboard.ts` (spec 74) already buckets GST lines | If no existing month-bucketing helper is generic enough to reuse directly, add one pure function to `src/engines/reporting/` (see Engine) rather than duplicating `74-gst-reports.md`'s bucketing logic inline |
| Monthly Profit | `65-profit-and-loss.md`'s existing P&L engine, current-FY-to-date figure | Reuses `buildProfitAndLossReport` unmodified — no new profit computation |
| GST Summary | `74-gst-reports.md`'s existing `gst-dashboard.ts` (`buildGstDashboardReport`) + `gstReportsService.getGstDashboard` | Embedded as a compact widget (current-period Output/Input/Net + Filed/Open badge), linking out to `/reports/gst` and `/gst/gstr-1`/`/gst/gstr-3b` for action — zero new GST aggregation |
| Recent Activity | New lightweight query only: latest N rows (ordered `createdAt DESC`) across `SalesInvoice`/`PurchaseInvoice`/`Voucher`/`SalesReturn`/`PurchaseReturn`/`CreditNote`/`DebitNote`, permission-filtered per source module | **Not** `AuditLog`-backed (see below) — this is the one place this spec composes a query that doesn't already exist elsewhere, and it is intentionally simple: a `createdAt`-ordered union, no new derived fields |
| Top Customers / Top Products / Top Suppliers | `71-customer-reports.md` / `68-sales-reports.md`'s item-wise builder / `72-supplier-reports.md`, each called with a sort-by-value + `limit` | The existing party-wise/item-wise report builders already group and sum by party/item; the Dashboard's only addition is sorting that same grouped output descending and truncating to top N — no new grouping |
| Pending Approvals | Existing per-document status fields (`DRAFT`/`SAVED` rows awaiting `approve` action, per each document's own status enum) | Counts only, permission-filtered to what this user could actually act on; links to the relevant module's list view filtered to that status |

## Alerts & exceptions

Alerts are derived, never invented data:

- **Low stock**: `Product.minStockLevel` vs. computed current stock (existing
  `aggregateCurrentStock` pattern) — a product with no `minStockLevel` set is never
  flagged (there is no implicit default; `CompanySettings` has no company-wide reorder
  default, confirmed in schema — this is a real absence, not an oversight to silently
  paper over).
- **Overdue receivables**: `Customer.creditDays` + `SalesInvoice.invoiceDate` vs. today,
  intersected with that invoice's outstanding balance (from the same source
  `71-customer-reports.md`'s outstanding service already computes) — **verify at
  Analysis** whether `SalesInvoice` carries an explicit due-date field distinct from
  `invoiceDate + creditDays`; if not, the derived formula above is the one to use, and
  must be documented as derived (not stored) wherever it is displayed.
- **GST filing due**: `GstFilingRecord`/`CompanySettings.gstFilingFrequency`, read-only,
  identical read `74-gst-reports.md` already performs for its Filed/Open overlay — this
  widget never calls `markPeriodFiled`/`reopenPeriod`.
- **Negative stock risk**: only surfaced if `CompanySettings.allowNegativeStock` is
  `true` for this company (otherwise the Inventory Engine already prevents it at the
  source, so there is nothing to warn about) — a factual read of an existing setting, not
  a new rule.
- **Pending approvals**: existing per-document status enums (see table above).

## Recent Activity is not an audit trail

`architecture-context.md`'s Known Implementation Gaps item 3 is explicit: `AuditLog`'s
write path covers only five Administration-side tenant-lifecycle events (Company
Created/Activated/Deactivated, Company Admin Created, Company Admin Password Reset) plus
Bank Account Activated/Deactivated — **no Sales/Purchase/Inventory/Accounting/GST module
writes an AuditLog entry**, and this spec does not change that (extending AuditLog
universally is explicitly called out there as "a general retrofit ... a separate, larger
effort," out of scope here). The Dashboard's Recent Activity widget is therefore built
from existing documents' own `createdAt` timestamps — a legitimate, already-available
substitute, clearly labeled as "recent documents," never mislabeled as an audit trail.

## Permission-based personalization, not layout customization

- A widget whose underlying module the user cannot `view` is **omitted entirely** (not
  rendered greyed-out, not rendered with an error) — e.g. a Sales-only role sees no Cash &
  Bank Balance tile at all if it lacks `accounting:view`.
- No user-configurable layout, ordering, or add/remove in this version — see Do Not.

## Drill-down

Every KPI tile, alert, ranking row, and activity item is a link to the exact existing
page that already shows that data in detail (the report page, the document detail page,
or the module's filtered list view) — using `next/link` to existing routes, never a new
duplicate view. Nothing on the Dashboard is inert text where an existing destination
exists.

---

# Architecture / Implementation

New files, all under a new `src/modules/dashboard/` module (following the project's
standard `modules/<name>/{services,components,types}` shape):

```text
src/modules/dashboard/
  services/dashboard-service.ts        // orchestrates parallel calls to existing services
  services/dashboard-service.test.ts
  components/kpi-tile.tsx
  components/alert-list.tsx
  components/quick-actions-grid.tsx
  components/recent-activity-feed.tsx
  components/top-performers-table.tsx
  components/sales-purchase-trend-chart.tsx
  types/dashboard.ts
```

Plus, only if genuinely missing after the Analysis step confirms no existing reusable
function covers it:

```text
src/engines/reporting/dashboard-summary.ts   // pure month-bucketing/ranking helpers only,
                                              // mirroring gst-dashboard.ts's own convention
```

`dashboard-service.ts` (`dashboardService.getDashboard(systemContext): Promise<DashboardData>`)
is the **only** new I/O — a permission-checked orchestrator that, for each widget:

1. Checks the widget's required permission(s) via `hasPermission` (not `assertPermission`
   — a missing permission means "omit this widget," not "throw," since the page as a
   whole must still render for a low-permission user; see Security).
2. If permitted, calls the existing service function named in the mapping table above
   with the current company/financial-year/branch scope.
3. Fetches independent widgets **in parallel** (`Promise.all`/`Promise.allSettled`),
   mirroring `74-gst-reports.md`'s own `getGstDashboard` pattern of parallel
   `getOutwardSupplyLines`/`getInwardSupplyLines` calls — a slow query for one widget must
   never block another (see Performance).

`src/app/page.tsx` is rewritten to: keep its existing Company → Financial Year → Branch
resolution/redirect logic verbatim, then render the Dashboard's Server Component tree
instead of the placeholder line. Each widget section is its own `<Suspense>` boundary
(or, where the underlying data fetch is cheap enough, awaited inline) so one slow or
failed widget's fallback/error state never blocks the rest of the page from rendering
(see Empty/Error States).

---

# Quick Actions

A permission-gated grid linking to these **already-existing** create routes (confirmed
present in `src/app/**`) — no new forms:

| Action | Route | Gate |
| --- | --- | --- |
| New Sales Invoice | `/sales/invoices/new` | `sales:create` |
| New Purchase Invoice | `/purchase/invoices/new` | `purchase:create` |
| New Customer | `/masters/customers/new` | `masters:create` |
| New Supplier | `/masters/suppliers/new` | `masters:create` |
| New Product | `/masters/products/new` | `masters:create` |
| Stock Adjustment | `/inventory/adjustments/new` | `inventory:create` |
| Stock Transfer | `/inventory/transfers/new` | `inventory:create` |
| Payment Voucher | `/accounting/payment-vouchers/new` | `accounting:create` |
| Receipt Voucher | `/accounting/receipt-vouchers/new` | `accounting:create` |
| Journal Voucher | `/accounting/journal-vouchers/new` | `accounting:approve` (matches `55-journal-voucher.md`'s own stricter gate) |
| Open Reports | `/reports` | `reports:view` |
| Open GST | `/gst` | `gst:view` |

No "New Expense"/"New Journal" duplicate is added beyond the existing Payment/Journal
Voucher screens (Expense Heads, per `16-expense-heads.md`, are just a Ledger Group filter
on the existing Ledger picker inside Payment Voucher — there is no separate Expense
Voucher form to link to).

---

# Validation

No new Zod input schema — the Dashboard accepts no user input beyond the existing global
Company/Branch/Financial Year switchers (already validated by their own modules) and an
optional date-range for the trend widgets, reusing `65-profit-and-loss.md`'s /
`57-gst-registers.md`'s existing `from`/`to` range-validation schema rather than adding a
new one.

---

# UI

Page: `/` (`src/app/page.tsx`), replacing the current placeholder body.

Sections, top to bottom (each independently permission-gated and independently
error-isolated):

1. **KPI row** — Sales Today/MTD, Purchase Today/MTD, Cash & Bank Balance, Receivables,
   Payables — `kpi-tile.tsx`, tabular-numeric per `ui-context.md`'s Typography rule,
   right-aligned monetary values.
2. **Alerts & Exceptions** — `alert-list.tsx`: low stock, overdue receivables, GST filing
   due, pending approvals, negative-stock risk (if applicable) — each row links to its
   source (product, customer, GST period, document list).
3. **Trends** — Monthly Sales/Purchase chart, Monthly Profit — `sales-purchase-trend-
   chart.tsx`, reusing whatever charting approach `74-gst-reports.md`'s GST Trend Chart
   already established for this codebase (same library/pattern, not a second one).
4. **GST Summary** — compact embed of `74-gst-reports.md`'s dashboard output for the
   current period, linking to `/reports/gst`, `/gst/gstr-1`, `/gst/gstr-3b`.
5. **Top Performers** — Top Customers, Top Products, Top Suppliers — `top-performers-
   table.tsx`, each row linking to that customer/product/supplier's detail page.
6. **Quick Actions** — `quick-actions-grid.tsx`, per the table above.
7. **Recent Activity** — `recent-activity-feed.tsx`, latest N documents by `createdAt`,
   each row linking to that document's own detail page.

Empty states (per module, not one generic blanket message): "No sales recorded yet this
month" (zero *transactions*) is visually and textually distinct from "₹0" (zero *value*,
transactions exist) — never conflate the two, per this project's own "no misleading
zeroes" convention already established across the Reports batch. A brand-new company
with no Customers/Suppliers/Products/transactions/GST data at all sees a Dashboard that
plainly says so per section, not a page full of unexplained zeros.

Responsive: KPI row and Top Performers collapse to single-column stacks below the
existing app shell's tablet/mobile breakpoints (`ui-context.md`'s Responsive Behavior —
"Mobile: read-only reports and basic operations" applies directly, since the Dashboard
*is* a read-only reports surface with links out to full workflows).

---

# Security

- **Page-level gate**: `dashboard:view` (already seeded on every default role, per
  `11-role-permissions.md`) — a user without it is redirected the same way any other
  permission-gated route redirects today (consistent with existing module conventions).
- **Per-widget gate**: each widget additionally requires its *source* module's own `view`
  permission (`sales`, `purchase`, `inventory`, `accounting`, `gst`, `employees`,
  `reports`) — mirroring `74-gst-reports.md`'s precedent of a double gate rather than
  letting `dashboard:view` alone unlock every module's figures. A user with
  `dashboard:view` but no `accounting:view` sees no Cash & Bank Balance tile; one with no
  `gst:view` sees no GST Summary widget; and so on per the mapping table above.
- **Quick Actions** are gated per-action by the same `create`/`approve` permission the
  destination screen itself already enforces (table above) — the Dashboard never grants
  an action a user's role doesn't already have; it only hides links to actions they lack.
- **PLATFORM (Super Admin) users never reach `/`** — `src/proxy.ts` already redirects
  them to `/administration` and blocks every ERP route including `/`; this spec does not
  change that routing.
- Company/Branch/Financial-Year isolation is identical to every other module (every
  underlying service call already scopes by `companyId`; the Dashboard adds no new
  cross-tenant surface since it performs no queries of its own beyond the one new
  Recent Activity feed, which must scope by `companyId` exactly like every sibling query).
- No `create`/`edit`/`delete` anywhere in this module — read-only (Invariant 3), same
  posture as every report.

---

# Database

**No new model, enum, or migration.** See Data Model.

---

# Code Standards / Testing

Strict TypeScript, no `any`. `dashboard-service.ts` is the only new orchestration logic
and must be unit-tested for:

- Widget omission when the relevant permission is absent (one test per widget in the
  mapping table, asserting the widget key is simply missing from the response, not
  present-with-null)
- Parallel fetch behavior — one widget's underlying service throwing does not prevent
  the others from resolving (use `Promise.allSettled` semantics; assert the failed
  widget's slot carries an explicit error/unavailable marker, not a crash of the whole
  response)
- Cross-company isolation — every widget's query is scoped to the requesting company;
  a fixture with two companies' data must never leak the other company's figures into
  either's dashboard
- "No data" vs. "zero" distinction — a company with zero Sales Invoices returns an
  explicit `hasSalesData: false` (or equivalent), not a bare `total: 0` indistinguishable
  from a slow business month
- Any new pure function added to `src/engines/reporting/dashboard-summary.ts` (only if
  Analysis determines one is genuinely needed) is tested the same way `gst-dashboard.ts`
  is — pure input/output, no I/O, no permission checks inside the engine layer itself

Performance target (per `code-standards.md`'s existing Performance section — **already
states "Dashboard < 2 seconds," this spec is the first to actually have to meet it**):
verify with a realistic seeded dataset that the composed page renders within budget; if
any single widget's query is the bottleneck, prefer adding a targeted index or a tighter
`groupBy`/`_sum` (matching `stock-transaction-repository.ts`'s existing
`aggregateCurrentStock` pattern) over fetching full row sets and reducing in memory.

---

# Do Not

Do not implement

- Dashboard Customization (drag-and-drop widget layout, per-user widget add/remove/
  reorder, saved layout persistence, dismissible/snoozable alerts) — `phases.md`'s Phase
  11 item, a separate future spec with its own (currently nonexistent) preference-storage
  schema
- Any new GST aggregation query — the GST Summary widget embeds `74-gst-reports.md`'s
  existing output exclusively
- Any new financial (Trial Balance/P&L/Balance Sheet/Cash Flow), pricing, or inventory
  calculation not already produced by an existing engine/service
- Any write to `AuditLog`, or any attempt to make it a general-purpose activity feed —
  that remains `80-audit-logs.md`'s own, separately-scoped future effort
- A universal `createdBy`/`updatedBy` retrofit across business tables — the Recent
  Activity feed uses `createdAt` only, which already exists everywhere it needs to
- Mock, placeholder, or hardcoded sample figures anywhere, including in an "empty state"
  — an empty state must say there is no data, never render invented example numbers
- A new charting/UI library if `74-gst-reports.md`'s GST Trend Chart already established
  one this codebase uses — reuse it
- Real-time push/websocket infrastructure — the Dashboard re-fetches on navigation/
  context-switch like every other page in this offline-first, request/response
  architecture; no new real-time layer is introduced (Invariant 10/11)

---

# Success Criteria

Verify

- `/` renders the real Dashboard (no more placeholder text) for a COMPANY user with
  `dashboard:view`, and PLATFORM users remain excluded exactly as before.
- Each KPI tile, alert, ranking, and activity row's figure matches its source report page
  exactly for the same company/financial-year/branch/date-range (spot-check against
  `/reports/trial-balance` or equivalent, `/reports/sales/register`, `/reports/inventory/
  low-stock`, `/reports/customers/outstanding`, `/reports/gst`).
- A user missing a given module's `view` permission sees that widget omitted entirely,
  never rendered empty or erroring.
- Every drill-down link lands on an existing, already-implemented page — no dead links,
  no newly duplicated view.
- A brand-new company (zero customers/suppliers/products/transactions/GST data) renders
  a Dashboard that clearly states "no data yet" per section, with no misleading zeroes
  and no invented sample data.
- One widget's underlying query failing (simulate via a forced error) does not prevent
  the rest of the Dashboard from rendering.
- Switching Company, Branch, or Financial Year re-scopes every visible widget correctly,
  with no stale cross-context data.
- The page meets `code-standards.md`'s "Dashboard < 2 seconds" performance target against
  a realistic seeded dataset.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/` continues to appear in the build route table rendering real content.

Feature-spec 85 (this spec) is `context/Phases/phase-tracker.md`'s Phase 10 item `#82`
— a twelfth item added to a phase previously (and prematurely, with respect to
`phases.md`'s own module list) marked fully complete, mirroring the `#80`/`#81`
(GSTR-2/ITC Register) precedent set in Phase 8.

---

# Implementation Note (2026-09-13)

Implemented on branch `feature/navigation-ia-overhaul`. Five points where the codebase, as
actually verified at implementation time, diverged from this spec's prose above — recorded
here per `ai-workflow-rules.md`'s discrepancy rule rather than silently reconciled:

1. **No branch scoping anywhere.** This spec's Business Rules section describes widgets
   "additionally scop[ing] to `getCurrentBranch()` when a branch is selected." In fact no
   document in the chain this Dashboard reads from carries a `branchId` at all —
   `SalesInvoice`, `PurchaseInvoice`, and `Voucher` are all still branch-less (recorded
   against Phase 2's Shared ERP Engines section already). The Dashboard scopes to Company +
   Financial Year only; no branch filter is applied anywhere, and none silently no-ops.
2. **"Pending Approvals" → "Pending Documents."** This schema has no approval workflow and
   no `SAVED` status on any document — every relevant enum is `DRAFT`/`POSTED`/`CANCELLED`.
   The shipped widget counts DRAFT rows only, labeled "Pending Documents," scoped to
   Sales/Purchase/Inventory (Voucher itself has no DRAFT state — a manual voucher posts
   immediately — so there is no "pending accounting document" concept to count).
3. **No aging on Receivables/Payables.** `CustomerOutstandingReport`/
   `SupplierOutstandingReport` carry a flat `rows[]` with no aging-bucket data. The shipped
   widgets show a grand total + top-N by amount only; adding aging would be new business
   logic this spec's own Goal forbids.
4. **Trend "table," not "chart."** This codebase has no charting library
   (`sales-purchase-trend-table.tsx` is a proportional-bar `<table>`, mirroring
   `74-gst-reports.md`'s own `gst-trend-table.tsx` — itself the same pattern, not a real
   chart). Adding one would violate this spec's own Do Not section.
5. **Types live in `src/types/dashboard.ts`**, not `src/modules/dashboard/types/` — no
   module in this codebase has its own `types/` folder; shared view-model types always live
   under `src/types/`.

Everything else shipped as specified: `dashboardService.getDashboard()` (no argument, unlike
the sketch above — resolves its own context via the standard `cache()`-deduped helpers
rather than a passed-in `systemContext`), the double permission gate (`reports:view` +
source module `view`) per widget, `Promise.allSettled`-style per-widget failure isolation, no
new Prisma schema, no new financial/GST/inventory calculation, and the exact Quick Actions
table (including Journal Voucher's `accounting:approve` gate). See
`context/Phases/phase-tracker.md`'s Phase 10 section and `context/progress-tracker.md` for
the full implementation record, test counts, and verification status.
