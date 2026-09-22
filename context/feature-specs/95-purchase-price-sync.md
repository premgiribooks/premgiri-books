# 95 - Purchase Price Sync to Product Master

> Feature-spec file number 95. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 4 — Purchase Management** item **#88**, appended as a post-closure amendment
> (Phase 4 was marked closed-in-full by feature-spec 45; this item reopens it for one
> amendment, mirroring how Phase 8 gained GSTR-2 (#80) and ITC Register (#81) after its
> own original batch closed). Depends on Purchase Orders (feature-spec 42), Purchase
> Invoice (feature-spec 44), Product Management (feature-spec 25), Product Detail Page
> (feature-spec 56). Read `30-pricing-engine.md`, `42-purchase-orders.md`,
> `44-purchase-invoice.md`, `45-purchase-return.md`, and `50-batch-tracking.md` first —
> this spec closes a gap those specs explicitly left open and follows batch-tracking's
> "own satellite module off Product" precedent.

## Goal

Automatically maintain `Product.purchasePrice` (the app-wide "Latest Purchase Cost" cost
basis the Pricing Engine already reads live for every margin/markup computation) from
posted purchase activity, and record every change as an immutable, queryable history
trail — so the cost basis reflects what was actually last paid, not a manually-entered
number that drifts out of date the moment a real purchase happens.

This closes a documented gap: `prisma/schema.prisma:946-949`'s own comment and
`30-pricing-engine.md:69-70` both say "Purchase Invoice overwrites it later" — that
follow-up was never built. It still is not built for computed selling prices (no change
needed there — `pricing-engine.ts:136` already reads `purchasePrice` live at resolve
time) but the write side has never existed until this spec.

---

# Project Context

Before implementation, review

- `30-pricing-engine.md` (§69-70 disclaims maintaining `purchasePrice`; §136-148 shows
  exactly how the engine consumes it — nothing there changes)
- `42-purchase-orders.md` (§154-163: confirming a PO today only *reads* `purchasePrice`
  as a rate suggestion, never writes it — this spec reverses that, see Business Rules)
- `44-purchase-invoice.md` (§247-251: same read-only posture on the invoice side)
- `45-purchase-return.md` (a return is a reversal of a prior purchase, not a new
  negotiated cost — it must not participate in this feature; verified the current
  `purchase-return-service.ts` posting flow makes no `Product` write today, so this is
  preservation of existing behavior, not a new exclusion rule)
- `50-batch-tracking.md` (the direct structural precedent: a small satellite entity
  hanging off `Product`, living in its own module, surfaced as a read-only tab on the
  Product detail page — this spec repeats that shape for a price-history entity instead
  of a batch catalog)

---

# Module Responsibilities

The Purchase Price Sync module is responsible for

- Selecting, from a posted document's lines, the correct new `purchasePrice` per product
  (a pure rule — see Business Rules §1.3-1.5)
- Persisting that new value onto `Product.purchasePrice` and an accompanying
  `ProductPurchasePriceHistory` row, inside the same database transaction as the source
  document's own posting/confirmation
- A read-only "Purchase Price History" tab on the Product detail page

The Purchase Price Sync module is **not** responsible for

- Any change to how selling prices are calculated — `src/engines/pricing/pricing-engine.ts`,
  `price-resolution.ts`, and `margin-override.ts` are untouched; they already read
  `purchasePrice` live
- Batch-level or FIFO/Weighted-Average costing — that remains a distinct, separately
  scoped future feature keyed off `StockTransaction`'s movement trail, not off this
  product-level price-change log; `StockTransaction.unitCost` is not wired up here
- Reverting `purchasePrice` on cancellation of the source document (see Business Rules
  §1.7)
- Purchase Return, Goods Receipt Note, or any sales-side document — none of these write
  to `purchasePrice`
- Backfilling history or `purchasePrice` for purchase documents posted **before** this
  feature ships — this feature is prospective-only (see Business Rules §1.9)
- Manual edits to `Product.purchasePrice` on the product master form — that path is
  unchanged and remains available

---

# Data Model

Add to `prisma/schema.prisma`:

```prisma
// Discriminates which document committed a purchase cost. Only the two documents that
// commit a negotiated purchase rate appear here (95-purchase-price-sync.md). Adding a
// future value is a small additive migration (YAGNI; mirrors ProductType's own comment,
// schema.prisma:930-933).
enum PurchasePriceSourceType {
  PURCHASE_INVOICE
  PURCHASE_ORDER
}

// Append-only audit trail of every automatic change to Product.purchasePrice (the
// "Latest Purchase Cost" cost basis the Pricing Engine reads live — pricing-engine.ts:136).
// One row per (product, source document), written inside the source document's own
// posting/confirmation transaction; never updated, never deleted, never user-editable
// (mirrors StockTransaction's immutability invariant, schema.prisma:1543-1545).
//
// Deliberately NOT written onto the existing AuditLog model: that model is scoped
// narrowly to Administration-side tenant-lifecycle events and is explicitly not a
// general-purpose audit retrofit (schema.prisma:1317-1324). Its untyped `metadata Json?`
// also cannot express a queryable per-product price series.
//
// sourceDocumentType/sourceDocumentId is a polymorphic link with no FK, matching
// StockTransaction.referenceType/referenceId. sourceDocumentNumber is a snapshot of the
// human-readable number at write time so the history renders without joining two
// different document tables.
//
// oldPurchasePrice is nullable — a product whose purchasePrice was never set has no old
// value, and that distinction must survive in the log.
model ProductPurchasePriceHistory {
  id                   String                  @id @default(uuid())
  companyId            String
  company              Company                 @relation(fields: [companyId], references: [id])
  productId            String
  product              Product                 @relation(fields: [productId], references: [id])
  oldPurchasePrice     Decimal?                @db.Decimal(14, 2)
  newPurchasePrice     Decimal                 @db.Decimal(14, 2)
  sourceDocumentType   PurchasePriceSourceType
  sourceDocumentId     String
  sourceDocumentNumber String?
  sourceDocumentDate   DateTime                @db.Date
  changedByUserId      String?
  changedBy            User?                   @relation(fields: [changedByUserId], references: [id])
  createdAt            DateTime                @default(now())

  @@index([companyId, productId, createdAt])
  @@index([sourceDocumentType, sourceDocumentId])
  @@index([companyId])
}

// Added back-relations:
//   Company: productPurchasePriceHistory ProductPurchasePriceHistory[]
//   Product: purchasePriceHistory        ProductPurchasePriceHistory[]
//   User:    productPurchasePriceChanges ProductPurchasePriceHistory[]
```

Decisions

- **No `Product.purchasePriceUpdatedAt` companion column.** "When was this last updated"
  is answered by the history table's own `createdAt` via the
  `(companyId, productId, createdAt)` index. A denormalized companion column would be a
  second source of the same truth that can drift out of sync with manual product-form
  edits (which do not go through this feature).
- **`DocumentType` (schema.prisma:1371-1398) was considered and rejected** for
  `sourceDocumentType`, per `ai-workflow-rules.md`'s Database Workflow rule ("can
  existing models be reused?"). It is the Document Number Engine's own numbering
  contract, referenced only by `DocumentSequence`, and carries values invalid here. A
  narrow 2-value enum is self-documenting and matches `StockTransactionType`'s
  precedent.
- Purely additive migration — one enum, one table, three back-relations. No columns
  added to existing tables, no data touched.

---

# Business Rules

### 1.1 Requirement
When a purchase document is committed, `Product.purchasePrice` must be updated to the
cost actually transacted for that product on that document, and every such change is
recorded as an immutable history row naming the source document, the old value, the new
value, the actor, and the timestamp.

### 1.2 Triggers
- `purchaseInvoiceService.postPurchaseInvoice` — `DRAFT → POSTED`.
- `purchaseOrderService.confirmPurchaseOrder` — `DRAFT → CONFIRMED` (a PO's only
  commit/freeze moment; `42-purchase-orders.md` states confirming "freezes the header
  and line quantities/pricing").
- No other document writes: not Purchase Return, not Goods Receipt Note (carries no
  pricing fields), not any sales document, not Opening Stock / Stock Adjustment /
  Physical Verification.
- **This is a deliberate deviation from `30-pricing-engine.md:69-70` and
  `42-purchase-orders.md:156-163`**, both of which state (or imply) only a Purchase
  Invoice would ever write back. Recorded here, in `architecture-context.md`, and in
  `progress-tracker.md`'s Architecture Decisions per explicit user instruction — a
  Purchase Order's confirmed rate is now also treated as an authoritative cost data
  point, not merely a suggestion. Consequence: a PO's negotiated-but-not-yet-invoiced
  rate can override a real invoiced cost if confirmed after that invoice posts — see
  §1.3.

### 1.3 "Most recent wins"
Defined as posting/confirmation chronology, not document date: each trigger performs an
**unconditional overwrite** of `Product.purchasePrice`. No comparison against the
existing value beyond the no-op guard in §1.6.

> Known, accepted consequence: **back-dated posting.** Posting an invoice dated last
> month today overwrites a newer cost. This is the literal reading of "most recently
> *posted* wins."

### 1.4 Multiple lines of the same product in one document
**Last line wins** — the line with the highest `lineNumber` for that `productId`
(`lineNumber` is unique within a document, so this is always deterministic, no tie-break
needed). Exactly one history row is written per `(product, document)`, never one per
line.

### 1.5 Which number becomes the new cost
The **net-of-discount effective unit cost**: `taxableAmount ÷ quantity` for that
product's winning line (per explicit user decision — the truer landed cost basis for
margin purposes). This is a recorded deviation from the gross `rate` field that
currently prefills PO/PI rate-entry fields and that the sales-side "below cost" warning
compares against (`sales-invoice-service.ts:241` etc. compare `input.rate` — a gross,
customer-facing rate — against `product.purchasePrice`). Once this ships,
`purchasePrice` is a discount-net figure while sales rates are gross; the below-cost
comparison remains directionally correct (net cost is always ≤ gross rate for the same
transaction) but is no longer a precise apples-to-apples gross comparison. Documented
here so a future session does not "fix" this as a bug.

### 1.6 Guard rules (no-op — write neither the product nor a history row)
1. **Non-positive resolved cost**: resolved value `<= 0` (covers a free-sample /
   zero-rated / fully-discounted line). A zero cost must never zero out a product's cost
   basis and its downstream computed margins.
2. **No actual change**: the resolved new value equals the current `purchasePrice`
   (compared at 2-decimal precision, matching `Decimal(14,2)`). Avoids a history log full
   of identical rows.
3. Not restricted by `productType` — applies to `TRADING`, `SERVICE`, and `EXPENSE`
   lines alike; `purchasePrice` exists on all three and the Pricing Engine reads it for
   all three.
4. A `productId` that does not belong to the posting company's own tenant is silently
   skipped (defensive; should be unreachable given existing line validation, but a
   posting must never fail because of this feature).

### 1.7 Cancellation
**Cancelling a posted Purchase Invoice or a confirmed Purchase Order does NOT revert
`purchasePrice` and does NOT write a history row.** A later document may have already
overwritten the value; "reverting" would restore a stale cost, which is worse than
leaving the last-known real transacted cost in place. The history row for the
cancelled document's own original price-setting event (if any) remains — it is
append-only, consistent with `code-standards.md`'s "financial data is immutable / posted
documents cannot be edited" posture.

### 1.8 Immutability
History rows are system-generated only. No create/update/delete API, no Server Action
mutation, no UI affordance — mirrors `StockTransaction`'s "no update/delete API exists
anywhere for this model" invariant.

### 1.9 Scope: prospective only
This feature applies **from rollout forward only** (explicit user decision). Purchase
Invoices already `POSTED` and Purchase Orders already `CONFIRMED` before this feature
ships are **not** backfilled — neither `purchasePrice` nor any history row is generated
retroactively for them. A product's Purchase Price History tab shows "No purchase price
changes recorded yet" until the next qualifying document is posted/confirmed after
rollout. No backfill script is part of this spec.

---

# Service / Repository

Create

```text
src/engines/pricing/purchase-cost-sync.ts             // pure selection rule (§1.3-1.6)
src/engines/pricing/purchase-cost-sync.test.ts
src/modules/product-purchase-price-history/repositories/product-purchase-price-history-repository.ts
src/modules/product-purchase-price-history/repositories/product-purchase-price-history-repository.test.ts
src/modules/product-purchase-price-history/services/product-purchase-price-history-service.ts
src/modules/product-purchase-price-history/services/product-purchase-price-history-service.test.ts
src/modules/product-purchase-price-history/components/product-purchase-price-history-table.tsx
src/modules/products/components/product-purchase-price-history-panel.tsx
src/types/product-purchase-price-history.ts
```

Amend (not replace)

```text
src/modules/purchase-invoices/services/purchase-invoice-service.ts  // postPurchaseInvoice calls sync
src/modules/purchase-orders/services/purchase-order-service.ts      // confirmPurchaseOrder becomes
                                                                      // transactional and calls sync
src/modules/products/components/product-detail-tabs.tsx             // new unconditional tab
```

- `resolveLatestPurchaseCostUpdates(lines)` — pure function in the Pricing Engine
  (`src/engines/pricing/purchase-cost-sync.ts`), no IO. Implements §1.4-1.6. Precedent:
  `src/engines/pricing/margin-override.ts` is an identically-shaped standalone pure
  module inside `engines/pricing/`.
- `productPurchasePriceHistoryService.syncFromPurchaseDocument(tx, companyId, input)` —
  the single shared entry point both posting flows call. Takes a **required** (not
  optional) `Prisma.TransactionClient` — this method must never run outside a caller's
  transaction. Internally: calls the pure engine function, reads current
  `purchasePrice` for affected products via `tx`, filters no-ops (§1.6), then calls one
  repository method that updates `Product.purchasePrice` and inserts history rows for
  all affected products in the same `tx`.
- `productPurchasePriceHistoryService.listHistoryForProduct(productId)` — read path for
  the UI tab, permission-gated (see Security).
- Repository → Service layering, Decimal → number normalization at the repository
  boundary — identical to every module in this codebase.

---

# Validation

No Zod schema is needed — this feature has no user-facing input. `syncFromPurchaseDocument`
is called internally with data already validated by the calling document's own posting
flow.

---

# UI

Pages

- `/masters/products/[id]/purchase-price-history` — a read-only tab on the existing
  Product detail view (shown **unconditionally**, for every product, unlike the
  Batches/Serial Numbers tabs which only appear when opted in): Date & Time, Source
  Document (type + number, newest first), Old Cost, New Cost, Changed By. Empty state:
  "No purchase price changes recorded yet."
- No new top-level hub entry — this is a Product Management extension, exactly like
  Batch Tracking's own tab.

Components (`src/modules/product-purchase-price-history/components/`): a plain
Server-Component table, no create/edit/delete affordances anywhere (§1.8).

Wire-up

- Register the new tab in `product-detail-tabs.tsx`'s `getProductDetailTabs`,
  unconditionally, after the existing Overview/Batches/Serial Numbers tabs.
- No change to the Product create/edit form — `purchasePrice` remains manually editable
  there exactly as today; this feature only adds an additional, automatic write path
  plus a read-only history view.

---

# Security

Gated by the `masters` permission module for the read path (`view`) — purchase price
history is product-master data, mirroring how Batches/HSN/GST-Rate management sit under
`masters` rather than `inventory` or `purchase`.

**`syncFromPurchaseDocument` itself performs no permission assertion of its own** — it
is a system-driven side effect of an already-authorized purchase posting
(`assertPermission(user, "purchase", "create"/"edit")` already ran in the calling
service). This is a deliberate, recorded deviation from the "every service method
asserts a permission" norm: gating it again on `masters:edit` would break posting for
Purchase-role users, who by design hold `masters:view` only, not `masters:edit`.

Company-scoped identically to every spec in this project.

---

# Database

New enum `PurchasePriceSourceType`; new model `ProductPurchasePriceHistory`; three new
back-relations (`Company`, `Product`, `User`). No columns added to existing tables. One
purely additive migration, no data backfill, no raw-SQL constraint needed.

---

# Code Standards

Strict TypeScript, no `any`, no duplicated logic between the two call sites (both go
through the single shared `syncFromPurchaseDocument` entry point), Serializable
transaction + existing bounded retry on both call sites (Purchase Order's
`confirmPurchaseOrder` gains this — it has none today), vitest coverage for:

- the pure selection rule (last-line-wins, zero/negative-rate exclusion, multi-product
  documents)
- the repository's product-update + history-insert atomicity on the caller's `tx`, and
  cross-company isolation
- the service's no-op short-circuit and its "no permission assert" deviation, pinned by
  test
- both posting flows calling the sync exactly once, with the correct source document
  type/number, and cancellation flows **not** calling it
- Purchase Return's posting flow **not** calling it (pins the exclusion as a tested
  business rule, not an accident of omission)

---

# Do Not

Do not implement

- Any change to `src/engines/pricing/pricing-engine.ts`, `price-resolution.ts`, or
  `margin-override.ts` — selling-price calculation is unaffected and unchanged
- A `Product.purchasePriceUpdatedAt` column
- Reuse of the `AuditLog` model
- Any create/update/delete API or UI for history rows
- A revert of `purchasePrice` on cancellation
- Wiring `StockTransaction.unitCost` (a separate, future FIFO/costing feature's concern)
- A backfill script for purchase documents posted before this feature ships
- Any change to `purchaseOrderService.closePurchaseOrder`/`cancelPurchaseOrder`, or
  `purchaseInvoiceService.cancelPurchaseInvoice`, beyond confirming they do not call sync
- Any change to `purchaseReturnService`'s posting flow

---

# Success Criteria

Verify

- Posting a Purchase Invoice updates `Product.purchasePrice` to the net-of-discount cost
  of the winning line per product and writes exactly one history row per product
  touched.
- Confirming a Purchase Order does the same.
- Whichever of the two is posted/confirmed most recently wins, even if it is the Purchase
  Order confirmed after an earlier Purchase Invoice.
- A zero/negative-cost line changes nothing.
- Posting a Purchase Return does not change `purchasePrice` and writes no history row.
- Cancelling a posted Purchase Invoice or a confirmed Purchase Order does not revert
  `purchasePrice` and writes no history row.
- The Purchase Price History tab renders for every product (not gated on any opt-in
  flag) and shows the correct rows, newest first.
- Pre-existing purchase documents (posted before this feature ships) do not retroactively
  generate history rows or change `purchasePrice`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 95 (this spec) is `context/Phases/phase-tracker.md`'s Phase 4 item #88, a
post-closure amendment.
