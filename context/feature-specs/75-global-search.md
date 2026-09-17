# 75 - Global Search

> Feature-spec file number 75 (spec-file numbers are sequential and never reused — the
> highest prior file was `74-gst-reports.md`). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 11 — Productivity Features** item **#73
> Global Search**. Depends on Masters (Product Management #23, Customer Management #24,
> Supplier Management #25, Ledger Master #13 — all implemented). Documentation only,
> drafted 2026-09-11 per the same batch-drafting-without-implementation precedent as
> specs 46–74 — nothing in this spec is implemented yet. A sibling agent is concurrently
> drafting this phase's other half (Excel Import #74→76, Excel Export #75→77, PDF
> Generation #76→78, plus Barcode Billing/Audit Logs/Backup & Restore, tracker #77–79) —
> no coordination needed beyond the shared conventions already recorded in
> `architecture-context.md`/`code-standards.md`.

## Goal

Implement **Global Search** for **Premgiri Books ERP** — a single, keyboard-first search
affordance that fans out across the masters a business looks up most often while billing
or entering data (Products, Customers, Suppliers, Ledgers) and jumps straight to the
matching record, instead of navigating to each master's own list page and re-typing the
same query into four separate filter bars. This is a pure **presentation/composition**
feature: it introduces no new query logic of its own beyond calling each target module's
own already-existing, already-tested `search`/`list` method in parallel and shaping the
combined result for display. `03-Application-Shell.md` already reserved the affordance
this spec wires up — the Top Navbar's centered "Global Search Placeholder" (`Search
products, customers, invoices...`) has shipped as inert markup since the shell was built;
this spec is what turns it into a real, working search.

**Scope decision, stated up front.** The shell's own placeholder copy mentions
"invoices," but this spec deliberately does **not** search transactional documents
(Quotations, Sales/Purchase Invoices, vouchers, etc.) in v1 — every one of those already
has its own dedicated, filterable list screen with document-specific filters (date range,
status, customer) that a flat text search cannot usefully replace, and indexing them
would multiply this feature's fan-out cost for comparatively low query volume (a cashier
searching mid-billing is looking for a *master* — a product or a customer — not
re-discovering an old invoice, which is what the Sales Register/#66 already serves).
**Employees are excluded too**, but for a different reason: Employee Management (Phase 9,
tracker #59–#61) has **no implemented `Employee` model at all** as of this writing (see
the research brief's ground-truth facts) — there is nothing to search yet. **In scope for
v1: Products, Customers, Suppliers, Ledgers** — the four masters with an existing,
already-tested `search`-capable list method (`productService.listProducts`,
`customerService.listCustomers`, `supplierService.listSuppliers`,
`ledgerService.listSelectable`) that every billing/data-entry screen in this codebase
already depends on. Adding a fifth entity type (Warehouses, Units, Categories, Brands,
HSN Codes, GST Rates — all valid Masters per `architecture-context.md`) is a cheap,
mechanical extension of the same fan-out pattern once a real business need for searching
them surfaces (YAGNI, `code-standards.md`) — not built speculatively here.

---

# Project Context

Before implementation, review

- `03-Application-Shell.md` (the Top Navbar's existing Global Search Placeholder this
  spec wires up — **do not** invent a new search affordance elsewhere; reuse the
  reserved slot)
- `25-product-management.md` (`productService.listProducts(filters)` — status/search/
  type/category/brand filters, already the Product Search screen's own data source)
- `26-customer-management.md` (`customerService.listCustomers(filters)` — status/search/
  customerType filters)
- `27-supplier-management.md` (`supplierService.listSuppliers(filters)` — status/search
  filters)
- `14-ledger-master.md` (`ledgerService.listSelectable(filters)` — active ledgers,
  optionally filtered by group/nature/excluded subtree; **confirm at implementation time
  whether it already accepts a free-text `search` parameter** — if it does not, add one
  additively (an optional field, default `undefined` = unchanged existing behavior for
  every current caller, e.g. the Ledger Selector combobox), following exactly the
  precedent Product/Customer/Supplier's own `search` filter already set, rather than
  building a second, parallel ledger-lookup query path)
- `56-product-detail-page.md` (the only master in this batch with a dedicated detail
  route, `/masters/products/[id]` — a Global Search result for a Product should deep-link
  there; Customers/Suppliers/Ledgers have no detail route, only `.../[id]/edit` — see UI)
- `code-standards.md` Performance goals: "Product Search < 300ms" / "Customer Search <
  300ms" — this spec's fan-out must not silently blow that budget just because it queries
  four modules instead of one; see Business Rules.

---

# Module Responsibilities

The Global Search module is responsible for

- The Top Navbar search affordance's real implementation: a keyboard-triggerable overlay
  that accepts a free-text query and fans it out, in parallel, to each in-scope master's
  own existing `search`-capable list method
- Grouping and ranking results by entity type for display, and navigating to the correct
  existing detail/edit route per entity type on selection
- Nothing else — it owns no data of its own

The Global Search module is **not** responsible for

- Any new business query, filter, or ranking algorithm inside Products/Customers/
  Suppliers/Ledgers — it calls each module's own existing method exactly as built (the
  same "fan-out over existing services, no parallel query path" posture
  `68-sales-reports.md` takes toward Sales Invoice's own list method)
- Full-text search infrastructure (Postgres `pg_trgm`/`tsvector`, an external search
  index) — every target's existing `search` filter is already a case-insensitive
  `contains` match (confirm per module at implementation time); this spec reuses that
  exactly, it does not introduce fuzzy/ranked full-text matching (YAGNI — a `contains`
  match on name/code/mobile is what every existing list screen already offers, and this
  feature's own value is *breadth* across masters, not smarter matching within one)
  found the day this
- Searching transactional documents or Employees (see Goal's Scope decision)
- Command-palette-style *actions* (e.g. "Create Customer," "Go to Reports") — this spec
  is data search only, not a command launcher; a future extension of the same overlay
  into a broader command palette is a natural follow-up, not built here

---

# Data Model

**No new Prisma model, enum, or migration.** Global Search performs zero writes and
introduces no state of its own — every result comes from an existing master's own
already-populated table, read through that master's own existing service method. This
matches the same "no schema" posture every Reports-phase spec (`64`–`74`) and
`52-payment-voucher.md` already established for a pure composition feature with nothing
of its own to persist.

---

# Business Rules

- **Fan-out, not a merged query.** A single search call issues one call each to
  `productService.listProducts`, `customerService.listCustomers`,
  `supplierService.listSuppliers`, and `ledgerService.listSelectable`, all four in
  parallel (`Promise.all`) — never sequentially, and never through a hand-rolled
  cross-table SQL `UNION` (each module retains sole ownership of its own query; this
  feature composes results, it does not reach into another module's table, per Invariant
  5: "modules communicate through shared services, never by directly modifying —
  or, by extension, directly querying — another module's data").
- **Per-entity result cap.** Each of the four calls requests at most **5** matches
  (an additive, optional `limit`/`take` parameter on each existing list method,
  defaulting to `undefined`/no limit for every other current caller — never a behavior
  change to Product Search, Customer list, etc.) — a global search overlay showing 20
  Products before the user has even seen a Customer match defeats its own purpose; a
  "See all N results in Products" link (see UI) is how a user reaches the full,
  already-existing filtered list screen for more.
- **Grouped, not interleaved, results.** Results render as up to four labeled sections
  (Products, Customers, Suppliers, Ledgers), each in that fixed order, each capped at 5 —
  never a single flat list sorted by some cross-entity relevance score (there is no
  shared relevance dimension across four unrelated tables to sort by honestly; a fixed,
  predictable section order is more useful than a fabricated cross-entity ranking).
- **Active-only by default.** Every fan-out call requests only active records (mirroring
  each target's own default list-screen behavior) — a deactivated Product/Customer/
  Supplier/Ledger is exactly as unhelpful to find mid-billing as it would be on that
  module's own default list view; this is not a new rule, it is the same default each
  target module's own service already applies when no explicit status filter is passed.
- **Per-entity-type permission filtering — the one refinement over a single blanket
  gate.** Products/Customers/Suppliers live under the `masters` permission module;
  **Ledgers live under `accounting`** (confirmed: `14-ledger-master.md`'s screens are
  `/accounting/ledgers*`, and the Accountant reserved role in
  `src/constants/permissions.ts`'s `DEFAULT_ROLE_PERMISSIONS` has `accounting.view` but
  *not* `masters.view`; conversely the Sales/Purchase reserved roles have `masters.view`
  but not `accounting.view`). Gating the whole feature behind a single `masters:view`
  check (as a first-pass reading of the tracker's "Depends On: Masters" column might
  suggest) would leak Ledger names/groups to a user who has no accounting visibility at
  all — a real cross-module boundary violation. This spec therefore filters **each
  result group independently** by whether the requesting user's own permission set grants
  `view` on that group's owning module (`masters` for Products/Customers/Suppliers,
  `accounting` for Ledgers) — computed once per search call from the already-resolved
  `CurrentCompanyUser`'s permission set, never a client-supplied flag. No new permission
  module is invented (per the research brief's explicit instruction) — this is a
  per-group filter using the two modules that already exist, not a fifth "search" module.
- **Company-scoped.** Every one of the four underlying calls already resolves
  `companyId` from the session (each target module's own existing convention); this
  spec's composition layer passes nothing across that boundary and adds no client-
  supplied company id anywhere.
- **Debounced client input**, standard 250–300ms, before the fan-out fires — keeping the
  effective server-side cost aligned with the "< 300ms" targets `code-standards.md` sets
  for the two busiest single-entity searches this feature wraps (Product/Customer), since
  a keystroke-per-request pattern would multiply load for no benefit.

---

# Service / Repository

**No repository of its own** — this module owns no table (the same posture
`52-payment-voucher.md` and `68-sales-reports.md` both took for a module with nothing to
persist).

Create

```text
src/modules/search/services/global-search-service.ts
src/modules/search/validation/global-search-schema.ts
src/modules/search/actions/global-search-actions.ts
src/modules/search/components/…
src/types/global-search.ts
```

- `globalSearchService.search(companyUser, query, options?)` — validates `query` via
  `global-search-schema.ts`, resolves which of the four groups the caller may view (the
  per-group permission filter above), then issues the parallel, capped fan-out only for
  the permitted groups, and shapes each module's own row shape into this spec's common
  `GlobalSearchResult` view-model (`{ groupKey: "products" | "customers" | "suppliers" |
  "ledgers"; groupLabel: string; items: GlobalSearchItem[]; totalMatches: number }[]`,
  where `GlobalSearchItem = { id: string; title: string; subtitle?: string; href: string
  }` — `totalMatches` lets the UI render "See all 42 results in Products" even though
  only 5 items are returned).
- **Amend, additively, only where a target's existing method has no `search`/`limit`
  support today** — confirm at implementation time; `productService.listProducts`,
  `customerService.listCustomers`, and `supplierService.listSuppliers` already accept a
  `search` filter per their own specs, so only an optional `limit`/`take` parameter may
  need adding to each (default `undefined`, behavior-preserving for every existing
  caller). `ledgerService.listSelectable` may need both a `search` and a `limit`
  parameter added, following the identical additive pattern — never a second, parallel
  query method.
- No Server Action or component ever queries `productRepository`/`customerRepository`/
  `supplierRepository`/`ledgerRepository` directly — always through the owning module's
  own service (Invariant 5), with `globalSearchService` standing in as the sole caller on
  this feature's side, mirroring how `salesReportService` calls `salesInvoiceService`
  rather than `sales-invoice-repository.ts` directly (`68-sales-reports.md`).

---

# Validation

Zod (`global-search-schema.ts`): `query` — trimmed string, 1–100 characters (a Zod
`.min(1)` so an empty/whitespace-only query never fans out four no-op calls; the client
debounces and also skips firing on empty input, but the server re-validates, never
trusting the client alone). No group/entity-type filter is client-selectable in v1 — the
fixed four-group fan-out, narrowed only by the server-computed permission filter above,
is the entire contract.

---

# UI

Wire-up (no new page route — this feature lives entirely inside the existing shell)

- Wire the Top Navbar's existing Global Search Placeholder (`03-Application-Shell.md`)
  into a real, keyboard-triggerable overlay: clicking the navbar search field, or a
  global keyboard shortcut (`Ctrl+K` / `Cmd+K` — this codebase's billing screens already
  prioritize "keyboard-first navigation... minimize mouse dependency" per
  `code-standards.md` UI Standards), opens a centered command-palette-style dialog (a
  shadcn `Dialog`/`Command` composition — this project already depends on `@base-ui/react`
  and `shadcn`, no new UI dependency needed) with a single text input and the grouped
  results below it, live-updating as the user types (debounced).
- Each result row shows `title`/`subtitle` (Product: name + code; Customer/Supplier: name
  + mobile/GSTIN; Ledger: name + group) and, on click/Enter, navigates to that entity's
  own existing route — **no new route is introduced by this spec**:
  - Product → `/masters/products/[id]` (the detail page, spec 56)
  - Customer → `/masters/customers/[id]/edit` (no detail route exists yet per spec 26)
  - Supplier → `/masters/suppliers/[id]/edit` (mirrors Customer per spec 27)
  - Ledger → `/accounting/ledgers/[id]/edit` (mirrors the Ledger Master edit route)
- A "See all N results in {group}" row at the bottom of each non-empty, capped section
  deep-links to that master's own existing list screen with the query pre-filled into its
  own filter bar's URL-state `search` param (e.g. `/masters/products?search=…`) — reusing
  each screen's own existing URL-state filter convention (`ProductFilterBar` and its
  siblings), not a new query-string contract.
- Empty state ("No results for '…'"), loading state (skeleton rows per visible group),
  and a keyboard-navigable result list (arrow keys + Enter, `Escape` closes) — this is the
  one screen in this codebase explicitly built mouse-optional from the start.

Components (`src/modules/search/components/`): `GlobalSearchDialog` (the overlay shell +
keyboard wiring), `GlobalSearchResultGroup` (one labeled section), `GlobalSearchResultRow`
(one item).

---

# Security

No new permission module. Gated per result group by that group's own existing module:
`masters:view` for Products/Customers/Suppliers, `accounting:view` for Ledgers (see
Business Rules' per-group filtering decision and reasoning). The overlay itself renders
for any authenticated Company user regardless of their permissions — with zero groups
shown (and a friendly "You don't have access to search any of these yet" state) for a
user who holds neither `masters:view` nor `accounting:view`, rather than hiding the
affordance outright (consistent with how this codebase already renders empty/disabled
states elsewhere rather than removing navigation entirely). No `create`/`edit`/`delete`/
`approve`/`export` action is relevant — this feature never writes and has no export of
its own (Excel Export, `77-excel-export.md`, is a separate concern; a "See all" link's
destination screen carries its own Export button, if any, unaffected by this spec).

---

# Database

No new model, enum, or migration. See Data Model.

---

# Code Standards

Strict TypeScript, no `any`, no business logic or query duplication (this module composes
existing service calls, it never re-implements a `contains` filter itself), vitest
coverage for:

- `globalSearchService.search` fans out only to the groups the caller's permission set
  allows (a user with `masters:view` but not `accounting:view` never receives a Ledgers
  group in the result, and vice versa)
- Each group is capped at 5 items with a correct `totalMatches` count from a seeded
  fixture with more than 5 matches in a group
- An empty/whitespace-only query is rejected before any fan-out call fires
- Cross-company isolation: a second company's Products/Customers/Suppliers/Ledgers never
  appear in the first company's results (delegated to — and verified through — each
  target module's own existing company-scoping, exercised via this service)
- A target module lacking a `search`/`limit` parameter today (confirm `ledgerService`'s
  actual current signature at implementation time) gets that parameter added additively,
  with a regression test confirming every pre-existing caller's behavior is unchanged
  when the new parameter is omitted

---

# Do Not

Do not implement

- Any new Prisma model, enum, or migration
- A cross-table `UNION` query, a search index, or full-text search infrastructure
  (`pg_trgm`/`tsvector`/Elasticsearch) — v1 reuses each target's existing `contains`
  filter exactly
- Searching Employees (no `Employee` model exists — Phase 9 is unimplemented), or any
  transactional document (Quotations, Invoices, Vouchers, etc. — see Goal's Scope
  decision)
- A blanket single-permission gate that would leak Ledger data to a `masters:view`-only
  user (see Business Rules) — the per-group filter is load-bearing, not optional polish
- A command-palette-style action launcher beyond data search (a future, separately
  scoped extension of the same overlay)
- Any change to `productService`/`customerService`/`supplierService`/`ledgerService`'s
  existing business rules — only additive, optional `search`/`limit` parameters where
  genuinely missing

---

# Success Criteria

Verify

- Pressing `Ctrl+K`/`Cmd+K` (or clicking the Top Navbar search field) opens the overlay;
  typing a query returns grouped, capped (5 per group) results from Products, Customers,
  Suppliers, and Ledgers, debounced, within `code-standards.md`'s performance envelope.
- A user without `accounting:view` never sees a Ledgers group; a user without
  `masters:view` never sees Products/Customers/Suppliers groups; a user with neither sees
  a friendly empty state, not a broken or empty-looking dialog.
- Selecting a result navigates to that entity's own existing route (Product detail page;
  Customer/Supplier/Ledger edit pages) — no new route is created by this spec.
- "See all N results in {group}" correctly deep-links to that master's own existing list
  screen with the query pre-filled.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 75 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #73.

---

## v3 Compatibility Note

This spec is fully forward-compatible with v3 and v4. Two implementation notes:

**1. Use `getSystemContext()` (not `getCurrentCompanyUser()` directly):**

By the time this spec is implemented, v3 spec 105 (SystemContext Adoption Retrofit) will
be in progress or complete. The `globalSearchService` must follow the v3 Bridge
Decision's Context-as-Parameter rule (`context-v3/ai-workflow-rules.md`):

```typescript
// ✅ v3-correct pattern:
export class GlobalSearchService {
  constructor(private readonly db: PrismaClient) {}

  async search(ctx: SystemContext, query: string): Promise<GlobalSearchResult> {
    const company = ctx.assertCompany();
    // ... fan-out to sub-services ...
  }
}
```

Do NOT call `getCurrentCompanyUser()` or `getSystemContext()` internally inside the
service class. Resolve `ctx` once at the Server Action layer and pass it in.

Also note: the real function name in `src/lib/system-context.ts` is
`resolveSystemContext()`, not `getSystemContext()`. Use the alias that v3 spec FX-08
adds (`getSystemContext`), or call `resolveSystemContext()` directly until the alias
exists.

**2. v4 compatibility — sub-service fan-out:**

In v4, the four target entities (Products, Customers, Suppliers, Ledgers) live in
separate microservices (Masters Service — spec 117). The `globalSearchService` becomes
an aggregating API Gateway route that fans out four HTTP calls rather than four
in-process service calls. The interface shape (query → grouped results) is unchanged —
only the transport is replaced. Design the service method signature to be portable:
no direct Prisma imports inside `globalSearchService` itself; all DB access delegated
to the owning module's service (which is already the spec's own rule).
