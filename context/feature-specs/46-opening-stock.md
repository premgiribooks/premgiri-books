# 46 - Opening Stock

> Feature-spec file number 46 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 5 — Inventory** item **#44
> Opening Stock**. Depends on Product Management (feature-spec 25). First of Phase 5's
> six documents. Read `32-inventory-engine.md` first in full — this spec introduces
> **no new engine logic and no new Prisma model**; it is the thinnest possible UI/service
> layer directly over the engine's existing `recordMovements` API.

## Goal

Implement **Opening Stock** for **Premgiri Books ERP** — the one-time entry of a
business's starting stock quantity (and cost) per product/warehouse, before any other
stock movement exists for that pair. `StockTransactionType.OPENING_STOCK` already exists
(spec 32) with no consumer — this feature is what it was reserved for.

**Scope decision, stated up front.** Unlike Stock Adjustment (#45, tracker item, next)
and Stock Transfer (#46, tracker item), `context/feature-specs/34-document-number-engine.md`'s
`DocumentType` enum reserves `STOCK_ADJUSTMENT` and `STOCK_TRANSFER` but has **no**
`OPENING_STOCK` entry. That omission is treated here as a deliberate signal, not a gap to
silently fill: Opening Stock is a one-time setup activity, not a recurring numbered
business document a company reprints or references later, so **this spec does not
introduce a document header, a status lifecycle, or a Document Number Engine
consumer.** Each Opening Stock entry is a direct call into the Inventory Engine,
recorded as a plain `StockTransaction` row exactly like every other movement — nothing
new is added to `prisma/schema.prisma` by this spec at all.

---

# Project Context

Before implementation, review

- `32-inventory-engine.md` (**read this first in full** — `recordMovements`,
  `StockTransactionType.OPENING_STOCK` → `IN`-only, the "no stock-quantity column
  anywhere" invariant, and the `unitId`/`productType` immutability-once-movements-exist
  rule this spec's own uniqueness check depends on)
- `25-product-management.md` (`Product.productType` — only `TRADING` products carry
  stock; `Product.purchasePrice` as the natural default for a line's unit cost;
  `Unit.decimalPlaces` quantity precision)
- `24-warehouse-management.md` (`Warehouse`, `Product.defaultWarehouseId` as the form's
  default warehouse suggestion)

---

# Module Responsibilities

The Opening Stock module is responsible for

- A single-screen bulk entry form: product + warehouse + quantity + optional unit cost,
  one or many lines at once, calling `inventoryEngine.recordMovements` with
  `StockTransactionType.OPENING_STOCK` / `IN`
- Enforcing that a given `(productId, warehouseId)` pair can receive **at most one**
  Opening Stock entry, ever (see Business Rules)
- A read-only list of previously recorded Opening Stock entries (a filtered view over
  `StockTransaction`, not a new table)

The Opening Stock module is **not** responsible for

- Any document numbering, draft/post/cancel lifecycle, or header model — see Goal
- Correcting a mis-entered Opening Stock quantity — that is Stock Adjustment's (#45) job,
  by design (see Business Rules)
- Any GST or Voucher Engine call — Opening Stock is a physical starting position, not a
  purchase; it has zero financial consequence

---

# Data Model

**No Prisma changes.** This spec is a pure UI + thin-service consumer of the existing
`StockTransaction` model and `StockTransactionType.OPENING_STOCK` value (both already
shipped by `32-inventory-engine.md`).

Decisions

- **At most one Opening Stock entry per `(companyId, productId, warehouseId)`, enforced
  in the service layer, not a database constraint** — a database-level partial unique
  index would require a predicate on `transactionType`, and Postgres partial indexes
  already have a documented precedent in this codebase (`09-financial-year.md`'s
  "at most one current FY" index) but that precedent exists because the invariant needed
  concurrency-safe enforcement under a *reusable* row (current-year flips back and
  forth). Opening Stock's invariant is simpler and one-directional (a row, once written,
  is never contested by a concurrent write racing to overwrite the *same* logical fact)
  — a Serializable-transaction check-then-insert (the same `SERIALIZABLE_RETRY` recipe
  every other "must not already exist" rule in this codebase uses) is sufficient and
  avoids a schema change for a rule that belongs to this feature, not the engine.
- **The check is "no `StockTransaction` of any type exists yet for this pair," not
  merely "no prior `OPENING_STOCK` row exists."** Opening Stock exists to record a
  starting position *before* any transacting begins for that product/warehouse — once a
  Purchase Invoice, Sales Invoice, Transfer, or anything else has moved that pair's
  stock, entering an "opening" balance after the fact is a contradiction in terms, not a
  legitimate late entry. A business that genuinely needs to correct or backfill a
  starting position after other movements exist uses Stock Adjustment (#45) instead —
  recorded here as the intentional reason Opening Stock has no edit/re-entry path, not
  an oversight.
- **No update or delete API** — identical posture to every other stock-transaction
  writer in this codebase (spec 32's own invariant). A wrong Opening Stock entry is
  corrected the same way a wrong Purchase or Sale would be: an opposite-direction
  `ADJUSTMENT` movement (#45), never an edit of the original row.
- `unitCost` is optional per line (mirrors the engine's own optional `unitCost` column);
  when provided it becomes that unit's initial Latest-Purchase-Cost input for valuation
  purposes only if `Product.purchasePrice` is otherwise unset — **this spec does not
  write to `Product.purchasePrice`**, it only supplies `StockTransaction.unitCost` for
  that one row, consistent with spec 32's costing-strategy note that `unitCost` is
  "stored data, not a valuation method." Do not conflate the two.

---

# Business Rules

- Only `TRADING` products may receive an Opening Stock entry (the engine's own rejection
  — this spec adds no new type check, it simply surfaces the engine's existing error
  with a friendly, feature-specific message: "Opening Stock cannot be recorded for a
  non-trading product").
- Product and warehouse must belong to the caller's company and be **active**.
- **Uniqueness check runs inside a Serializable transaction with bounded P2034 retry**
  (this codebase's `SERIALIZABLE_RETRY` convention): before inserting, count any existing
  `StockTransaction` row for `(companyId, productId, warehouseId)` (any
  `transactionType`); a non-zero count rejects the whole line with a friendly error
  naming the product/warehouse pair, before any row is written. Two concurrent Opening
  Stock submissions for the same pair must not both succeed.
- **Batch submission is all-or-nothing per line, not per form**: each line in a
  multi-line submission is validated independently (its own product/warehouse
  activeness, its own uniqueness check); a rejected line does not silently skip while
  others post — the whole submission rejects with a line-specific error list, and the
  user corrects and resubmits (mirrors how every other document-line form in this
  codebase surfaces per-line validation, e.g. Purchase Invoice's HSN hard-block).
- `transactionDate` defaults to today, must not be in the future (the engine's own
  rule); a business back-dating its actual go-live date may set an earlier date.
- Quantity must be > 0, honoring the product's unit `decimalPlaces`; `unitCost` (when
  present) ≤ 2 decimals.
- **Company-scoped for every user**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/opening-stock/services/opening-stock-service.ts
src/modules/opening-stock/validation/opening-stock-schema.ts
src/modules/opening-stock/actions/opening-stock-actions.ts
src/modules/opening-stock/components/…
src/types/opening-stock.ts
```

No dedicated repository — this module has no table of its own; it composes
`stockTransactionRepository` (spec 32's existing repository, read-only queries only) and
`inventoryEngine.recordMovements` (the one write path) directly from its service.

- `openingStockService`: `listOpeningStockEntries(filters)` (a filtered
  `stockTransactionRepository` query, `transactionType = OPENING_STOCK`),
  `recordOpeningStock(lines)` (the uniqueness-checked, Serializable-transaction batch
  write described above).

---

# Validation

Zod (`opening-stock-schema.ts`): lines array ≥ 1, each `productId`/`warehouseId` uuid,
`quantity` > 0 honoring dynamic unit precision, `unitCost` optional ≥ 0 ≤ 2 decimals,
`transactionDate` calendar date not in the future, `narration` ≤ 500 optional per line.

---

# UI

Pages (under a new `/inventory` hub — **the first feature to establish it**; Stock
Adjustment, Stock Transfer, and Physical Verification will each add their own card to
this same hub as they land)

- `/inventory` — hub page, one card for now: "Opening Stock"
- `/inventory/opening-stock` — Opening Stock list (Product, Warehouse, Quantity, Unit
  Cost, Date, Actions — no Edit/Delete, view-only rows) with search + product/warehouse
  filters
- `/inventory/opening-stock/new` — Record Opening Stock (multi-line grid entry: product
  picker, warehouse picker defaulting to `Product.defaultWarehouseId`, quantity, unit
  cost, date)

Components (`src/modules/opening-stock/components/`): Opening Stock Table (+ filter
bar), Opening Stock Entry Form (multi-line grid, no status badge — there is no status).

Wire-up

- Add the `/inventory` hub page and its sidebar entry (per `ui-context.md`'s existing
  "Inventory" sidebar section, previously unlinked).
- Add `inventory: "Inventory"` and `opening-stock: "Opening Stock"` to
  `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `inventory` permission module (already in the Permission catalog since
feature-spec 11, currently unused by any shipped module): `view`, `create`. No `edit`,
`delete`, or `approve` action is exercised by this spec (no update/delete API exists;
nothing here requires approval) — those actions remain available in the catalog for
Stock Adjustment/Transfer/Physical Verification to use. Company-scoped identically to
every spec in this project.

---

# Database

No new models, enums, or columns — no migration. This spec is UI + service only, over
infrastructure `32-inventory-engine.md` already shipped.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic outside the Inventory Engine, Serializable +
bounded retry for the uniqueness check, vitest coverage for:

- the "no prior transaction of any type for this pair" rejection (including a case where
  a *non*-`OPENING_STOCK` movement — e.g. a stray `ADJUSTMENT` — already exists for the
  pair, confirming it also blocks a later Opening Stock entry, not just a duplicate
  `OPENING_STOCK` row)
- concurrent submission race guard (two simultaneous Opening Stock entries for the same
  pair — only one succeeds)
- per-line independent validation in a multi-line batch (one bad line does not silently
  drop while good lines post)
- non-`TRADING` product rejection, inactive/cross-company product/warehouse rejection
- unit `decimalPlaces` precision honored

---

# Do Not

Do not implement

- A document header, number, or status lifecycle (see Goal)
- An update or delete API for a recorded Opening Stock entry (correct via Stock
  Adjustment, #45, instead)
- Any GST or Voucher Engine call
- Writing to `Product.purchasePrice` from this form (see Data Model)
- Printing, PDF generation, or WhatsApp sharing

---

# Success Criteria

Verify

- Recording Opening Stock for a fresh `(product, warehouse)` pair succeeds and produces
  exactly one `StockTransactionType.OPENING_STOCK`/`IN` row.
- A second Opening Stock attempt for the same pair — whether or not the first entry was
  itself `OPENING_STOCK` — is rejected with a friendly, pair-specific error.
- A non-`TRADING` product, or an inactive/cross-company product or warehouse, is
  rejected.
- Two concurrent Opening Stock submissions for the same pair: exactly one succeeds.
- The `/inventory` hub page exists and links to Opening Stock; the list correctly shows
  only `OPENING_STOCK` rows.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/inventory` and `/inventory/opening-stock*` appear in the build route table.

Feature-spec 46 (this spec) is `context/Phases/phase-tracker.md`'s Phase 5 item #44 —
the first of Phase 5's six documents and the first feature to establish the `/inventory`
hub. Feature-spec 47 (Stock Adjustment, tracker #45) is next.
