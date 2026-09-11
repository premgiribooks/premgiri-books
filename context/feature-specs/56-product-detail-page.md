# 56 - Product Detail Page

> Feature-spec file number 56 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 6 — Product Detail Page** item
> **#50** — a phase inserted 2026-09-11, ahead of Phase 5's own remaining item (#49
> Serial Number Tracking), by explicit user direction. Depends on Product Management
> (feature-spec 25, implemented) and Batch Tracking (feature-spec 50, implemented).
>
> **Why this phase exists**: Product Management (spec 25) shipped 2026-07-18 with only
> list/new/edit — no detail view. Batch Tracking (spec 50, tracker #48) already deferred
> its Batches tab for exactly this reason (see `context/progress-tracker.md`'s Current
> Phase entry, known deviation #2): the `ProductBatchTable`/`ProductBatchForm` components
> and the full `product-batches` module exist but are wired into no page. Serial Number
> Tracking's own spec (`51-serial-number-tracking.md`, tracker #49, not yet implemented)
> assumes "the existing Product detail view" in its UI section — a second feature about
> to hit the identical missing prerequisite. This spec builds the page once, as its own
> phase, so both land in it instead of each deferring separately.

## Goal

Implement the **Product Detail Page** for **Premgiri Books ERP** — a read-oriented,
tabbed view at `/masters/products/[id]` that becomes the permanent home for every
per-product extension surface this codebase already has or will add: an Overview tab
(the product's own fields, read-only, plus its related master names), a Batches tab
(wiring in the already-built Batch Tracking UI for `isBatchTracked` products), and a tab
slot reserved for Serial Number Tracking's own Serial Numbers tab (spec 51 wires its own
content into that slot when it is implemented — not built here, see Do Not).

This is a **routing and composition feature**, not new domain logic: it reads through
`productService.getProduct` and the already-shipped `productBatchService`, and renders
already-built components (`ProductBatchTable`, `ProductBatchForm`). No new Prisma model,
no new service logic beyond what Product Management and Batch Tracking already expose.

---

# Project Context

Before implementation, review

- `25-product-management.md` (`productService.getProduct`, the existing
  `/masters/products` list/new/edit pages and their permission gate — this spec adds the
  missing fourth page in that set)
- `50-batch-tracking.md` (**read its UI section in full** — the Batches tab this spec
  wires in was fully specified and built there; the `<BatchSelector>`/`ProductBatchTable`/
  `ProductBatchForm` components and `productBatchService.listBatches`/`getBatchStock`
  already exist and are consumed as-is, with **no changes** to that module)
- `51-serial-number-tracking.md` (its UI section names `/masters/products/[id]/
  serial-numbers` as "a tab or sub-page on the existing Product detail view" — this spec
  is what makes that view exist; the Serial Numbers tab's own content is **that** spec's
  job, not this one's)

---

# Module Responsibilities

The Product Detail Page feature is responsible for

- `/masters/products/[id]` — a tabbed detail view: **Overview** (always shown) and
  **Batches** (shown only when `product.isBatchTracked`)
- A generic, extensible tab-navigation shell that a future tab (Serial Numbers, spec 51)
  can register into without restructuring this page
- Linking the existing Product list/table's row actions to this page (a new "View"
  action alongside the existing Edit)
- Read-only display of every `Product` field plus its resolved related master names
  (Category, Brand, Unit, HSN Code, GST Rate, Default Warehouse) — reusing
  `productService.getProduct`'s existing shape, the same one `/masters/products/[id]/edit`
  already consumes

The Product Detail Page feature is **not** responsible for

- Any new product field, business rule, or service method — everything it displays or
  wires in already exists in `productService` and `productBatchService`
- The Serial Numbers tab's content (feature-spec 51 — this spec only reserves the slot;
  see Do Not)
- Stock ledger, pricing history, or document-history tabs (future Reports-phase concerns,
  no spec reserves them yet)
- Any change to Batch Tracking's own module (`src/modules/product-batches/`) — consumed
  exactly as spec 50 shipped it

---

# Business Rules

- No new business rule. The page is read-only for the Overview tab; the Batches tab's
  create/edit/deactivate actions are exactly `50-batch-tracking.md`'s existing rules
  (batch-tracked product required, company-scoped, no delete — enforced by
  `productBatchService`, not re-implemented here).
- **Company-scoped for every user**, identical posture to every spec in this project:
  `getProduct(id)` already rejects a cross-company id as not-found; this page adds no new
  access path.
- A non-existent or cross-company product id renders the existing "not found" empty
  state, matching `/masters/products/[id]/edit`'s current behavior.

---

# Service / Repository

No new repository or service files. This spec is UI-only, composing existing reads:

```text
productService.getProduct(id)                          // spec 25, existing
productBatchService.listBatches(productId)              // spec 50, existing
productBatchService.getBatchStock(productId, batchId)   // spec 50, existing
```

Create

```text
src/app/masters/products/[id]/page.tsx           // detail view route (Overview tab default)
src/app/masters/products/[id]/batches/page.tsx    // Batches tab route
src/modules/products/components/product-detail-tabs.tsx     // shared tab shell
src/modules/products/components/product-overview-panel.tsx  // Overview tab content
```

No Server Actions beyond what `product-actions.ts` (spec 25) and
`product-batch-actions.ts` (spec 50) already export — this page calls those, unchanged.

---

# Validation

None new. The page performs no writes of its own; every write (batch create/edit/
deactivate) goes through `product-batch-schema.ts`'s existing Zod validation (spec 50),
unchanged.

---

# UI

Pages

- `/masters/products/[id]` — Overview tab (default): read-only summary grouped the same
  way the Product Form groups fields (Identity, Classification, Tax, Pricing, Stock),
  plus Product Status Badge / Product Type Badge (both already exist, spec 25). An "Edit"
  button links to the existing `/masters/products/[id]/edit`.
- `/masters/products/[id]/batches` — the Batches tab, shown only when
  `product.isBatchTracked`; renders the existing `ProductBatchTable` with its "New Batch"
  action opening the existing `ProductBatchForm` (both from spec 50, unchanged). Visiting
  this route for a non-batch-tracked product redirects to the Overview tab.
- Tab navigation is a simple, extensible list (`ProductDetailTabs`) keyed by product
  flags — `isBatchTracked` gates Batches today; a future `isSerialTracked` gate for a
  Serial Numbers tab (spec 51's own job to add) is a one-line addition to this same list,
  not a restructure.

Components (`src/modules/products/components/`): `ProductDetailTabs` (tab shell),
`ProductOverviewPanel` (Overview content). No new components under
`src/modules/product-batches/` — the Batches tab renders that module's existing
`ProductBatchTable`/`ProductBatchForm` directly.

Wire-up

- Add a "View" row action to the existing Product Table (`src/modules/products/
  components/…`), alongside the existing Edit action, linking to
  `/masters/products/[id]`.
- `src/constants/breadcrumbs.ts` gains a dynamic product-name breadcrumb segment for
  `/masters/products/[id]` and `/masters/products/[id]/batches`, following the same
  pattern already used elsewhere for detail pages with a dynamic segment.

---

# Security

Gated by the `masters` permission module, `view` action — the same gate
`/masters/products` and `/masters/products/[id]/edit` already use (spec 25's existing
convention). No new permission module, no new permission action. Company-scoped
identically to every spec in this project (see Business Rules).

---

# Database

No schema change. No migration.

---

# Code Standards

Strict TypeScript, no `any`, no business logic in components (this page renders and
composes only — no price/tax/stock math anywhere here, since none of it belongs to this
feature), Repository → Service → Server Action → UI layering preserved by reusing the
existing spec 25/50 stack unchanged. Vitest coverage for:

- `ProductDetailTabs` renders only the Overview tab for a non-batch-tracked product, and
  both Overview + Batches for a batch-tracked one
- The Batches tab route redirects to Overview when visited for a non-batch-tracked
  product
- A cross-company or non-existent product id renders the not-found state on both new
  routes

---

# Do Not

Do not implement

- The Serial Numbers tab's content (feature-spec 51's own job — this spec only leaves
  the tab list extensible; adding `isSerialTracked` as a second gate is spec 51's change,
  not this one's)
- Any change to `productService`, `productBatchService`, or their validation/schema files
  — this spec is a pure UI composition over what specs 25 and 50 already shipped
- A Stock Ledger, Pricing History, or Document History tab (no spec has reserved these
  yet; future Reports-phase concern)
- Product images or file uploads (still out of scope, per spec 25's own Do Not)
- Any write path beyond what the existing Batches tab components already perform

---

# Success Criteria

Verify

- `/masters/products/[id]` renders the Overview tab for any existing product, scoped to
  the requesting user's own company; a cross-company or non-existent id renders the
  existing not-found state.
- The Batches tab appears and is fully functional (list, create, deactivate — via the
  unmodified spec 50 components) only for a product with `isBatchTracked = true`;
  visiting `/masters/products/[id]/batches` for a non-batch-tracked product redirects to
  Overview.
- The Product Table's new "View" action navigates to the detail page; the existing Edit
  action is unaffected.
- Breadcrumbs render the product's name on both new routes.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/masters/products/[id]*` appears in the build route table.

Feature-spec 56 (this spec) is `context/Phases/phase-tracker.md`'s Phase 6 item #50 — the
only item in Phase 6, inserted ahead of Phase 5's own remaining item (#49 Serial Number
Tracking) so that spec has a page to wire its Serial Numbers tab into. Per
`context/Phases/phase-tracker.md`, Phase 5's #49 (Serial Number Tracking, feature-spec
51) resumes immediately after this spec closes Phase 6; Phase 7 (Accounting — the four
manual voucher screens, #51–#54) follows once Phase 5 is fully complete.
