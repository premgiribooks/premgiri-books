# 51 - Serial Number Tracking

> Feature-spec file number 51 — the last of Phase 5. This feature is
> `context/Phases/phase-tracker.md`'s **Phase 5 — Inventory** item **#49 Serial Number
> Tracking**. Depends on Product Management (feature-spec 25). Read
> `50-batch-tracking.md` first in full — this spec is its structural mirror for
> one-of-a-kind (serialized) products instead of lot-batched ones, reuses its Retrofit
> Decision verbatim, and records only what genuinely differs.

## Goal

Implement **Serial Number Tracking** for **Premgiri Books ERP** — an opt-in, per-product
capability to track stock by individual serial number (IMEI, device serial, equipment
tag) rather than by bare quantity, for products where each physical unit has its own
identity.

Like Batch Tracking (spec 50), this is schema-and-service work extending the Inventory
Engine, not a document a user posts.

---

# Project Context

Before implementation, review

- `50-batch-tracking.md` (**read this first in full** — the Retrofit Decision, the
  "no stored quantity" derivation pattern, the mutual-exclusion rule, and the overall
  spec shape this document mirrors almost exactly with product-scoped batches replaced
  by individually-identified serials)
- `32-inventory-engine.md` (`StockTransaction`, `recordMovements`, the "no
  stock-quantity column anywhere" invariant this spec's status-derivation design must
  also preserve)
- `25-product-management.md` (`Product.productType`, `Unit.decimalPlaces` — see
  Decisions for why a serialized line's quantity is always exactly 1 regardless of the
  product's configured unit precision)

---

# Module Responsibilities

The Serial Number Tracking module is responsible for

- A per-product opt-in flag, `Product.isSerialTracked`
- The `SerialNumber` catalog (serial value, per serial-tracked product) — a static
  identity registry, **not** a mutable status record (see Decisions)
- Extending `StockTransaction` with an optional `serialId` (alongside Batch Tracking's
  `batchId` — a `StockTransaction` row may carry at most one of the two, never both,
  since a product is never both batch- and serial-tracked) and the Inventory Engine's
  movement-line input types with an optional `serialId` field, required whenever the
  line's product is serial-tracked and forbidden otherwise
- `getSerialStatus(serialId)` — derives a serial's current status
  (`IN_STOCK`/`SOLD`/`RETURNED`/etc.) and current warehouse **from its latest
  `StockTransaction` row**, never a stored, independently-mutable status column (see
  Decisions)
- A serial picker/scanner-friendly input UI surface every serial-tracked line editor can
  compose

The Serial Number Tracking module is **not** responsible for

- Anything Batch Tracking already covers for lot-controlled products — the two are
  mutually exclusive per product (spec 50's rule, reused verbatim here)
- Retrofitting a `serialId` column onto any existing document's own item table — same
  Retrofit Decision as spec 50, reused, not re-derived (see Decisions)
- Warranty/service-history tracking beyond the plain stock-movement trail (a
  `SerialNumber`'s "history" in this phase is exactly its `StockTransaction` rows, no
  richer domain model)

---

# Data Model

Add to `prisma/schema.prisma`:

```text
// Added to model Product:
//   isSerialTracked Boolean @default(false)
//   serialNumbers   SerialNumber[]

model SerialNumber {
  id          String   @id @default(uuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  serialValue String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  stockTransactions StockTransaction[]

  @@unique([companyId, productId, serialValue])
  @@index([companyId, productId])
}

// Amend model StockTransaction (32-inventory-engine.md, further amended by spec 50) —
// additive, optional column:
//   serialId String?
//   serial   SerialNumber? @relation(fields: [serialId], references: [id])
//   @@index([serialId])
```

Decisions

- **Retrofit Decision reused verbatim from `50-batch-tracking.md`**: `serialId` is added
  to `StockTransaction` only, threaded through the engine's existing movement-line input
  types as an optional field, exactly as `batchId` was — not retrofitted onto any
  existing document's own item table. The same follow-up-per-document wiring cost
  applies and is tracked the same way (see that spec's UI Retrofit note).
- **No stored, independently-mutable status column on `SerialNumber`.** The directive
  considered a `status` enum (`IN_STOCK`/`SOLD`/`RETURNED`) as a column on the model
  itself, but this codebase's governing invariant — "current stock is calculated from
  stock transactions," applied at the batch grain by spec 50 — applies identically here:
  a stored `status` column would be a second source of truth that could drift from the
  actual movement history (e.g. a bug or a direct-write bypass leaving `status = SOLD`
  while the last real movement was actually a `SALES_RETURN` IN). Instead,
  `getSerialStatus(serialId)` derives status **and current warehouse** by reading that
  serial's most recent `StockTransaction` row (ordered by `createdAt`) and mapping its
  `transactionType`/`direction`: the latest IN movement's `transactionType` and
  `warehouseId` describe where the unit currently sits; the latest OUT movement
  (`SALES`, uncountered by a later `SALES_RETURN` IN) means sold and out of stock;
  `PURCHASE_RETURN` OUT means returned to the supplier. `SerialNumber` itself is a
  **static identity catalog only** — this is the more consistent design given spec 32's
  own architecture, not merely a stylistic preference.
- **A serialized movement's `quantity` must always equal exactly 1.** A serial number
  identifies one physical unit; there is no such thing as "3 units of serial ABC123."
  This is validated at the same point `batchId`'s required/forbidden rule is validated
  (the engine's line-input check) — a serial-tracked movement line with `quantity ≠ 1` is
  rejected regardless of what the product's own unit `decimalPlaces` would otherwise
  permit. A document line moving multiple physical units of a serialized product is
  therefore always multiple lines (or multiple `serialId` sub-entries per line — this
  spec assumes **one line per serial**, the simpler shape; a future document-level UI
  convenience that lets a user pick N serials against one nominal line and expands them
  into N engine-call lines internally is an implementation detail of each consuming
  document's own line editor, not a schema concept).
- **Mutually exclusive with Batch Tracking** (`isBatchTracked`) — reused verbatim from
  spec 50's rule and its enforced-both-directions guard (setting either flag true while
  the other is already true is rejected); a `StockTransaction` row may carry `batchId`
  or `serialId` but never both (enforced the same way as spec 50's mutual-exclusion
  check constraint, extended to cover this third combination).
- **`serialValue` uniqueness is scoped `(companyId, productId, serialValue)`**, the same
  scoping choice spec 50 made for `batchNumber`, for the same reason (two different
  products could theoretically share a colliding serial format from different
  manufacturers; real-world serials are usually globally unique by construction, but the
  database does not need to assume that to stay correct for this codebase's own
  purposes).
- **`isSerialTracked` becomes immutable once the product has any `StockTransaction`
  row** — identical rule and identical reasoning to spec 50's `isBatchTracked`
  immutability.
- **No update/delete API for `SerialNumber` beyond `isActive`** — identical posture to
  spec 50's `ProductBatch`; a serial's identity is never renamed once created (unlike a
  batch number typo, a wrong serial value is a data-entry mistake corrected by
  deactivating the wrong entry and creating the correct one, since a serial's whole
  purpose is being an immutable identifier).

---

# Business Rules

- A product's `isSerialTracked` may only be set `true` for a `TRADING` product.
- Setting `isSerialTracked = true` on a product that currently has `isBatchTracked =
  true` is rejected, and vice versa.
- Creating a `SerialNumber` requires the product to be `isSerialTracked`; rejected for a
  non-serial-tracked product.
- Every engine movement-line input for a serial-tracked product **requires**
  `serialId` (resolved and validated: active, belongs to the same product and company)
  and **requires `quantity === 1`**; for a non-serial-tracked product, a supplied
  `serialId` is rejected outright.
- **A given `serialId` cannot be moved OUT (e.g. sold) while it is not currently
  `IN_STOCK`** (per `getSerialStatus`) — the same "cannot oversell" principle spec 32
  and spec 50 both enforce at the quantity level, applied here at the identity level: a
  serial already sold cannot be sold again without an intervening return movement. This
  check runs inside the same Serializable-transaction contract every OUT-movement
  availability check in this codebase uses, reading the serial's latest transaction row
  for the check-then-write.
- **Company-scoped for every user**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/serial-numbers/repositories/serial-number-repository.ts
src/modules/serial-numbers/services/serial-number-service.ts
src/modules/serial-numbers/validation/serial-number-schema.ts
src/modules/serial-numbers/actions/serial-number-actions.ts
src/modules/serial-numbers/components/…
src/types/serial-number.ts
```

Amend (not replace) — the same four files `50-batch-tracking.md` amended, extended
further:

```text
src/engines/inventory/inventory-engine.ts     // movement-line input gains optional serialId + quantity===1 check
src/engines/inventory/inventory-queries.ts    // add getSerialStatus
src/engines/inventory/inventory-validation.ts // add the serial-required/forbidden + quantity===1 check
src/modules/products/services/product-service.ts // isSerialTracked toggle + mutual-exclusion + immutability-once-moved checks
```

- `serialNumberService`: `listSerialNumbers(productId, filters)`, `getSerialNumber(id)`,
  `createSerialNumber(input)`, `deactivateSerialNumber(id)`, `getSerialStatus(id)`
  (derived, per Decisions).
- Repository → Service layering, identical to every module in this codebase.

---

# Validation

Zod (`serial-number-schema.ts`): `productId` uuid, `serialValue` required non-empty ≤
100. Engine line-input validation (amended): `serialId` optional uuid, required-when-
tracked/forbidden-when-untracked (against the loaded product's `isSerialTracked` flag),
plus a refine rejecting `quantity !== 1` whenever `serialId` is present.

---

# UI

Pages

- `/masters/products/[id]/serial-numbers` — a tab or sub-page on the existing Product
  detail view (only shown when `isSerialTracked`): serial list (Serial Value, Current
  Status — derived, Current Warehouse — derived, Active) with a "Register Serial(s)"
  action (supports pasting/entering multiple serial values at once for bulk
  registration, since serialized goods are often received in batches of individually
  distinct units)
- No new top-level hub entry — same posture as Batch Tracking

Components (`src/modules/serial-numbers/components/`): Serial Number Table, Serial
Number Registration Form (single + bulk entry), **Serial Picker** — a reusable
`<SerialSelector productId />` component (filtered to currently `IN_STOCK` serials for
an OUT-direction line) every serial-tracked line editor can compose.

Wire-up

- Add an `isSerialTracked` toggle to the existing Product create/edit form, gated to
  `TRADING` products only, disabled once the product has any stock transaction, and
  mutually exclusive with `isBatchTracked` in the same form (both toggles live together;
  selecting one disables the other in the UI, reinforcing the server-side mutual
  exclusion).
- **Retrofit note, explicitly not built in this task** — identical posture and identical
  list of eight documents as `50-batch-tracking.md`'s own UI Retrofit note; not
  duplicated here in full, see that spec.

---

# Security

Gated by the `masters` permission module for serial CRUD (mirrors spec 50's placement
reasoning) — `view`, `create`, `edit`. The `isSerialTracked` toggle rides the existing
Product form's `masters` gate. No new permission module. Company-scoped identically to
every spec in this project.

---

# Database

New column `Product.isSerialTracked`; new model `SerialNumber`; one new nullable column
`StockTransaction.serialId`; the batch/serial mutual-exclusion check constraint from
spec 50, extended to cover this third combination. One migration. Back-relations on
`Company`, `Product`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, no stored serial-status column anywhere, Serializable +
bounded-retry for serial-availability (currently-in-stock) checks, vitest coverage for:

- serial-required-when-tracked / serial-forbidden-when-untracked rejection matrix
- `quantity !== 1` rejection for any serial-tracked movement line
- `getSerialStatus` correctness across a movement history (IN → OUT-sale → IN-return
  sequence correctly reports the final derived status and warehouse)
- a serial already `SOLD` cannot be moved OUT again without an intervening return
  (the "cannot oversell an identity" guard, including the concurrent-attempt race case)
- mutual exclusion with `isBatchTracked`, both directions
- `isSerialTracked` immutability once the product has any stock transaction
- `(companyId, productId, serialValue)` uniqueness; two different products sharing a
  serial value is allowed

---

# Do Not

Do not implement

- A stored, independently-mutable `status` column on `SerialNumber` (see Decisions —
  status is always derived)
- A `serialId` column on any existing document's own item table (Retrofit Decision,
  reused from spec 50)
- Actually wiring `<SerialSelector>` into any consuming document's line editor (a
  follow-up task per document, same posture as spec 50)
- Batch tracking (feature-spec 50 — mutually exclusive, not layered together)
- Warranty/service-history domain modeling beyond the plain stock-movement trail

---

# Success Criteria

Verify

- A `TRADING` product can opt into `isSerialTracked`; a non-`TRADING` product, or one
  already `isBatchTracked`, is rejected, and vice versa.
- Once a serial-tracked product has any `StockTransaction`, `isSerialTracked` can no
  longer be changed.
- A movement against a serial-tracked product without a `serialId`, or with
  `quantity !== 1`, is rejected; a movement against a non-serial-tracked product with a
  `serialId` is rejected.
- `getSerialStatus` correctly derives current status and warehouse from a serial's
  movement history, with no stored status column anywhere.
- A serial currently not `IN_STOCK` cannot be moved OUT again (including under a
  concurrent-attempt race).
- Two products may share the same `serialValue`; the same product may not register two
  serials with the same value.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; the Product detail page's Serial Numbers tab appears for a serial-tracked
  product.

Feature-spec 51 (this spec) is `context/Phases/phase-tracker.md`'s Phase 5 item #49 —
**the last item in Phase 5 (Inventory)**. Per `context/Phases/phase-tracker.md`, Phase 6
(Accounting — the four manual voucher screens, #50–#53) is next.
