# 50 - Batch Tracking

> Feature-spec file number 50. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 5 — Inventory** item **#48 Batch Tracking**. Depends on Product Management
> (feature-spec 25). Fifth of Phase 5's six documents. Unlike 46–49, this spec **does**
> extend the Inventory Engine's own schema — `32-inventory-engine.md`'s Do Not section
> explicitly excludes batch tracking from its original scope and reserves this spec to
> add it. Read that spec's Data Model and Business Rules sections in full before
> continuing; this spec amends them, it does not replace them.

## Goal

Implement **Batch Tracking** for **Premgiri Books ERP** — an opt-in, per-product
capability to track stock in named batches (lot number, manufacture/expiry dates), so a
business selling perishable, regulated, or lot-controlled goods can see and select stock
by batch rather than by product alone.

**This is new engine-adjacent schema work, not a document like 46–49.** There is no
"Batch Tracking document" a user posts — this spec's deliverable is (a) a per-product
opt-in flag, (b) a `ProductBatch` catalog, (c) a minimal, explicitly-scoped extension of
the Inventory Engine's `StockTransaction` model and movement-line input so batch-tracked
movements carry a batch reference, and (d) the UI surface to manage batches and select
one when moving batch-tracked stock.

---

# Project Context

Before implementation, review

- `32-inventory-engine.md` (**read this first in full** — the exact `StockTransaction`
  shape and `recordMovements`/`transferStock` signatures this spec extends; its own
  "no stock-quantity column anywhere" invariant, which this spec's batch-quantity design
  must preserve; its Do Not section's explicit deferral of batch tracking to this spec)
- `25-product-management.md` (`Product.productType`, `Product.isActive` — where the new
  `isBatchTracked` flag attaches; the existing "`unitId`/`productType` become immutable
  once movements exist" precedent this spec's own immutability rule is modeled on)
- Every document that moves stock for a `TRADING` product and will need to thread a
  batch selection through its line editor once a product is batch-tracked: Purchase
  Invoice (`44-purchase-invoice.md`), Sales Invoice (`38-sales-invoice.md`), Purchase
  Return (`45-purchase-return.md`), Sales Return (`39-sales-return.md`), Opening Stock
  (`46-opening-stock.md`), Stock Adjustment (`47-stock-adjustment.md`), Stock Transfer
  (`48-stock-transfer.md`), Physical Verification (`49-physical-verification.md`) — read
  the Retrofit Decision below before assuming any of these need a schema change; most do
  not.

---

# Module Responsibilities

The Batch Tracking module is responsible for

- A per-product opt-in flag, `Product.isBatchTracked`
- The `ProductBatch` catalog (batch number, optional manufacture/expiry dates, per
  batch-tracked product)
- Extending `StockTransaction` with an optional `batchId` and the Inventory Engine's
  movement-line input types with an optional `batchId` field, enforced as **required**
  whenever the line's product is batch-tracked and **forbidden** otherwise
- `getBatchStock` / `getBatchLedger` query primitives (the batch-scoped analogs of the
  engine's existing `getCurrentStock`/`getStockLedger`) — batch quantity is **always**
  Σ IN − Σ OUT of `StockTransaction` rows scoped to that `batchId`, never a stored
  quantity column, preserving spec 32's core invariant at the batch grain
- A batch picker UI surface (`src/modules/product-batches/components/…`) that every
  stock-moving document's line editor can compose when the selected product is
  batch-tracked

The Batch Tracking module is **not** responsible for

- FIFO/FEFO automatic batch selection at billing time (see Do Not — every batch
  selection in this phase is a manual, user-driven picker; the Pricing Engine and every
  existing document's line editor have no batch-selection concept today and this spec
  does not add automatic selection logic to them)
- Retrofitting a `batchId` column onto any existing document's own item table (e.g.
  `PurchaseInvoiceItem`, `SalesInvoiceItem`) — see the Retrofit Decision below
- Serial number tracking (feature-spec 51 — a distinct, mutually exclusive concept, see
  that spec)
- Batch-level costing (FIFO/Weighted Average) — Latest Purchase Cost remains the
  company-wide costing strategy (`architecture-context.md`); a batch's own
  `manufactureDate`/`expiryDate` are informational, not a costing input

---

# Data Model

Add to `prisma/schema.prisma`:

```text
// Added to model Product:
//   isBatchTracked Boolean @default(false)
//   batches        ProductBatch[]

model ProductBatch {
  id              String   @id @default(uuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  productId       String
  product         Product  @relation(fields: [productId], references: [id])
  batchNumber     String
  manufactureDate DateTime? @db.Date
  expiryDate      DateTime? @db.Date
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  stockTransactions StockTransaction[]

  @@unique([companyId, productId, batchNumber])
  @@index([companyId, productId])
}

// Amend model StockTransaction (32-inventory-engine.md) — additive, optional column:
//   batchId String?
//   batch   ProductBatch? @relation(fields: [batchId], references: [id])
//   @@index([batchId])
```

Decisions

- **Retrofit Decision — the load-bearing call of this spec.** Threading batch
  information through every stock-moving document could mean either (a) adding a
  `batchId` column to each document's own item table (`PurchaseInvoiceItem`,
  `SalesInvoiceItem`, `PurchaseReturnItem`, `SalesReturnItem`, plus 46–49's item tables),
  a migration touching seven-plus already-shipped tables, or (b) adding the column to
  **only `StockTransaction` itself** (the one place stock movement already
  concentrates, per spec 32's own "single place stock movement exists" invariant) and
  threading an optional `batchId` through the Inventory Engine's existing movement-line
  input type (`recordMovements`'s line shape, `transferStock`'s input), so every
  document keeps calling the engine exactly as before but can now optionally pass a
  `batchId` per line. **This spec chooses (b).** It satisfies
  `ai-workflow-rules.md`'s "avoid duplicate tables, prefer extending existing entities"
  directly — `StockTransaction` already *is* the entity that should carry this
  information, and duplicating a `batchId` column onto seven document-item tables (most
  of which already carry `productId`/`warehouseId` and would need the identical
  conditional-required-when-batch-tracked validation independently reimplemented seven
  times) would be exactly the kind of speculative, repetitive schema this project's
  conventions warn against. The real cost this decision accepts: **each of those seven
  (and future) documents' own service/validation/UI layers must add a batch-picker field
  and pass it through to whichever engine call it already makes** — a UI and
  service-layer retrofit, not a schema retrofit. This is smaller, and the honest
  trade-off is named explicitly here rather than assumed silently: those documents' own
  spec files are not being amended by this spec (each already-shipped document is
  out of scope for this feature's own implementation task — see Do Not); wiring the
  batch picker into each one is a follow-up task per document, tracked as a known
  retrofit list, not done automatically as a side effect of this spec landing.
- **Batch quantity is never stored** — `getBatchStock(companyId, productId, batchId)`
  aggregates Σ IN − Σ OUT over `StockTransaction` rows filtered by `batchId`, exactly
  mirroring `getCurrentStock`'s product/warehouse aggregation. This is not a new
  invariant; it is spec 32's existing one, applied one dimension further.
- **`batchId` is required on a movement line when `product.isBatchTracked` is true,
  and forbidden (must be null) when it is false** — validated in the engine's line
  input validation, not left to each consuming document to remember. A batch-tracked
  product's stock must always be traceable to a batch; a non-batch-tracked product has
  no batch dimension to attach one to.
- **`isBatchTracked` becomes immutable once the product has any `StockTransaction`
  row** — the same rule spec 32 already established for `unitId`/`productType`, extended
  here for the identical reason: flipping the flag after movements exist would leave
  historical rows in an ambiguous state (batch-tracked movements with no batch, or a
  sudden batch requirement retroactively unsatisfiable).
- **Mutually exclusive with Serial Number Tracking** (feature-spec 51): a product may be
  `isBatchTracked` or `isSerialTracked`, never both — a lot-controlled, quantity-many
  batch and a one-of-a-kind serialized unit are different inventory models for
  different kinds of goods (Batch Tracking suits pharmaceuticals/FMCG with expiry lots;
  Serial Tracking suits electronics/equipment with unique identity). Enforced as a
  database-and-service check (`CHECK` constraint via a Prisma-unsupported raw SQL
  addition in the migration, plus an application-level assertion, mirroring how this
  codebase already pairs a Postgres-level guarantee with a service-level check wherever
  Prisma's schema DSL cannot express the invariant directly — see
  `09-financial-year.md`'s partial-unique-index precedent for the same reasoning
  pattern).
- **`batchNumber` uniqueness is scoped `(companyId, productId, batchNumber)`** — two
  different products may legitimately share a batch/lot number from their respective
  suppliers; uniqueness only needs to hold within one product's own batch catalog.
- **No update/delete API for `ProductBatch` beyond `isActive` toggle** — a batch, once
  it has any stock transaction, is never renamed or removed (mirrors every other
  master's "deactivate, don't delete" convention plus stock-transaction immutability);
  before any movement exists against it, ordinary edit is fine (batch number typo
  correction) via a standard update.

---

# Business Rules

- A product's `isBatchTracked` may only be set to `true` for a `TRADING` product (the
  same product-type gate every stock concept in this codebase respects).
- Setting `isBatchTracked = true` on a product that currently has `isSerialTracked =
  true` is rejected, and vice versa (mutual exclusion, enforced on every product update,
  not just at creation).
- Creating a `ProductBatch` requires the product to be `isBatchTracked`; creating one for
  a non-batch-tracked product is rejected.
- Every engine movement-line input (`recordMovements`, `transferStock`) for a
  batch-tracked product **requires** `batchId`, resolved and validated (active,
  belongs to the same product and company) before the movement is accepted; for a
  non-batch-tracked product, a supplied `batchId` is rejected outright (never silently
  ignored — a client attempting to attach a batch to an untracked product's movement is
  a contract violation, not a no-op).
- `getBatchStock` availability check (an OUT movement against a specific batch) is
  scoped to that batch's own Σ IN − Σ OUT, **not** the product's company-wide total —
  a business cannot oversell a specific batch even if the product overall has stock in
  other batches. This runs inside the same Serializable-transaction contract every
  OUT-movement availability check in this codebase already uses.
- **Company-scoped for every user**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/product-batches/repositories/product-batch-repository.ts
src/modules/product-batches/services/product-batch-service.ts
src/modules/product-batches/validation/product-batch-schema.ts
src/modules/product-batches/actions/product-batch-actions.ts
src/modules/product-batches/components/…
src/types/product-batch.ts
```

Amend (not replace)

```text
src/engines/inventory/inventory-engine.ts     // movement-line input gains optional batchId
src/engines/inventory/inventory-queries.ts    // add getBatchStock, getBatchLedger
src/engines/inventory/inventory-validation.ts // add the batch-required/forbidden check
src/modules/products/services/product-service.ts // isBatchTracked toggle + mutual-exclusion + immutability-once-moved checks
```

- `productBatchService`: `listBatches(productId)`, `getBatch(id)`, `createBatch(input)`,
  `updateBatch(id, input)` (batch-number/dates only, before any movement exists),
  `deactivateBatch(id)`, `getBatchStock(productId, batchId, warehouseId?)`.
- Repository → Service layering, identical to every module in this codebase; Decimal →
  number normalization at the repository boundary.

---

# Validation

Zod (`product-batch-schema.ts`): `productId` uuid, `batchNumber` required non-empty ≤ 50,
`manufactureDate`/`expiryDate` optional calendar dates with an object-level refine
rejecting `expiryDate` before `manufactureDate` when both are present. Engine line-input
validation (amended, not a new file): `batchId` optional uuid, with the
required-when-tracked/forbidden-when-untracked rule enforced against the loaded
product's `isBatchTracked` flag, not the client's own claim about it.

---

# UI

Pages

- `/masters/products/[id]/batches` — a tab or sub-page on the existing Product detail
  view (only shown when `isBatchTracked`): batch list (Batch Number, Manufacture Date,
  Expiry Date, Current Stock, Active) with a "New Batch" action
- No new top-level hub entry — Batch Tracking is a Product Management extension, not a
  standalone document flow

Components (`src/modules/product-batches/components/`): Product Batch Table, Product
Batch Form (create/edit, disabled fields once movements exist), **Batch Picker** — a
reusable `<BatchSelector productId quantity? />` component every batch-tracked line
editor composes; this is the one piece of UI this spec ships that other documents will
later import (see the Retrofit note below).

Wire-up

- Add an `isBatchTracked` toggle to the existing Product create/edit form
  (`25-product-management.md`'s existing form), gated to `TRADING` products only,
  disabled once the product has any stock transaction, and mutually exclusive with
  `isSerialTracked` (feature-spec 51) in the same form.
- **Retrofit note, explicitly not built in this task**: wiring the new `<BatchSelector>`
  into each of Purchase Invoice, Sales Invoice, Purchase Return, Sales Return, Opening
  Stock, Stock Adjustment, Stock Transfer, and Physical Verification's own line editors
  is each document's own follow-up change, tracked in `progress-tracker.md` as a known
  list once this spec lands — not performed as part of this spec's own implementation
  task (see Do Not).

---

# Security

Gated by the `masters` permission module for batch CRUD (batches are product-master
data, mirroring how HSN/GST Rate management sits under `masters` rather than
`inventory`) — `view`, `create`, `edit`. The `isBatchTracked` toggle rides the existing
Product form's `masters` gate. No new permission module. Company-scoped identically to
every spec in this project.

---

# Database

New columns `Product.isBatchTracked`; new model `ProductBatch`; one new nullable column
`StockTransaction.batchId` (additive amendment to spec 32's model, back-relation to
`ProductBatch`); a raw-SQL check constraint for the batch/serial mutual exclusion (see
Decisions). One migration. Back-relations on `Company`, `Product`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, no stored batch-quantity column anywhere, Serializable +
bounded-retry for batch-scoped OUT availability, vitest coverage for:

- batch-required-when-tracked / batch-forbidden-when-untracked rejection matrix across
  `recordMovements` and `transferStock`
- batch-scoped Σ IN − Σ OUT aggregation correctness, independent of the product's other
  batches' stock
- batch-scoped OUT availability rejection (cannot oversell one batch using another
  batch's stock)
- mutual exclusion: attempting to set `isBatchTracked` and `isSerialTracked` both true
  is rejected, in either order
- `isBatchTracked` immutability once the product has any stock transaction
- `(companyId, productId, batchNumber)` uniqueness; two different products sharing a
  batch number is allowed

---

# Do Not

Do not implement

- FIFO/FEFO automatic batch selection at billing time (manual picker only, this phase)
- A `batchId` column on any existing document's own item table (see Retrofit Decision)
- Actually wiring `<BatchSelector>` into any of the eight named documents' line editors
  (see the Retrofit note in UI — a follow-up task per document, not part of this spec)
- Serial number tracking (feature-spec 51)
- Batch-level costing methods (FIFO/Weighted Average)
- Batch expiry alerts/reports (a future Reports-phase concern, not this spec's UI)

---

# Success Criteria

Verify

- A `TRADING` product can opt into `isBatchTracked`; a non-`TRADING` product, or one
  already `isSerialTracked`, is rejected.
- Once a batch-tracked product has any `StockTransaction`, `isBatchTracked` can no
  longer be changed.
- A movement against a batch-tracked product without a `batchId` is rejected; a movement
  against a non-batch-tracked product with a `batchId` is rejected.
- Batch-scoped current stock and availability checks are correct and independent across
  a product's multiple batches.
- Two products may share the same `batchNumber`; the same product may not have two
  batches with the same number.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; the Product detail page's Batches tab appears for a batch-tracked product.

Feature-spec 50 (this spec) is `context/Phases/phase-tracker.md`'s Phase 5 item #48.
Feature-spec 51 (Serial Number Tracking, tracker #49) is next and last in Phase 5 —
read this spec's Retrofit Decision before writing that one, since both specs' consuming
documents share the same retrofit posture.
