# 48 - Stock Transfer

> Feature-spec file number 48. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 5 — Inventory** item **#46 Stock Transfer**. Depends on Warehouse Management
> (feature-spec 24). Third of Phase 5's six documents. Read `32-inventory-engine.md`
> first — this spec is the header/document lifecycle the engine's own Data Model section
> explicitly deferred ("No separate transfer-header table until Stock Transfer (#46)
> needs one for its document lifecycle").

## Goal

Implement **Stock Transfer** for **Premgiri Books ERP** — the numbered document that
moves stock for one or more products from one warehouse to another within the same
company, using the Inventory Engine's already-existing `transferStock` API.
`StockTransactionType.TRANSFER` already exists (spec 32) with no consumer — this
document is what it was reserved for, together with `DocumentType.STOCK_TRANSFER`
(spec 34).

---

# Project Context

Before implementation, review

- `32-inventory-engine.md` (**read this first** — `transferStock`'s existing contract:
  writes one linked OUT/IN row pair per call, sharing a `transferGroupId`, source ≠
  destination, availability validated on the OUT side, `unitCost` null on both rows)
- `24-warehouse-management.md` (`Warehouse` — the two-location dimension this document
  is entirely about)
- `25-product-management.md` (`TRADING`-only; unit `decimalPlaces`)
- `34-document-number-engine.md` (`DocumentType.STOCK_TRANSFER`, already reserved)
- `47-stock-adjustment.md` (the sibling Phase 5 document this spec's header/lifecycle
  shape mirrors most closely — same `DRAFT`/`POSTED`/`CANCELLED` three-state posture)

---

# Module Responsibilities

The Stock Transfer module is responsible for

- Stock Transfer Master (Create/Post/View/Cancel, scoped to the active company and
  financial year): one document = one source warehouse, one destination warehouse, and
  one or more product/quantity lines
- Posting, atomically: one `inventoryEngine.transferStock` call per line (each producing
  its own linked OUT/IN row pair with its own `transferGroupId` — see Data Model
  Decisions for why the document does not force one shared group id across lines)
- Stock Transfer numbering via the Document Number Engine
  (`DocumentType.STOCK_TRANSFER`)

The Stock Transfer module is **not** responsible for

- An in-transit/received-at-destination two-step workflow (see Data Model Decisions —
  this spec deliberately keeps a single `POSTED` state, not a `DRAFT → IN_TRANSIT →
  COMPLETED` lifecycle)
- Any GST or Voucher Engine call — a transfer has zero net stock change company-wide and
  zero financial consequence
- Stock Adjustment (#45) or Physical Verification (#47) — a transfer is neither a
  correction nor a count

---

# Data Model

Add to `prisma/schema.prisma` (plus `stockTransfers StockTransfer[]` back-relations on
`Company`, `FinancialYear`, `Warehouse` (×2, source and destination — see Decisions),
`User`):

```text
enum StockTransferStatus {
  DRAFT
  POSTED
  CANCELLED
}

model StockTransfer {
  id                    String              @id @default(uuid())
  companyId             String
  company               Company             @relation(fields: [companyId], references: [id])
  financialYearId       String
  financialYear         FinancialYear       @relation(fields: [financialYearId], references: [id])
  transferNumber        String?
  transferDate          DateTime            @db.Date
  sourceWarehouseId     String
  sourceWarehouse       Warehouse           @relation("StockTransferSource", fields: [sourceWarehouseId], references: [id])
  destinationWarehouseId String
  destinationWarehouse  Warehouse           @relation("StockTransferDestination", fields: [destinationWarehouseId], references: [id])
  status                StockTransferStatus @default(DRAFT)
  narration             String?
  createdByUserId       String?
  createdBy             User?               @relation(fields: [createdByUserId], references: [id])
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  items StockTransferItem[]

  @@unique([companyId, financialYearId, transferNumber])
  @@index([companyId, status])
  @@index([sourceWarehouseId])
  @@index([destinationWarehouseId])
}

model StockTransferItem {
  id              String        @id @default(uuid())
  stockTransferId String
  stockTransfer   StockTransfer @relation(fields: [stockTransferId], references: [id])
  lineNumber      Int
  productId       String
  product         Product       @relation(fields: [productId], references: [id])
  quantity        Decimal       @db.Decimal(14, 4)

  @@unique([stockTransferId, lineNumber])
  @@index([productId])
}
```

Decisions

- **Single `POSTED` state, not an in-transit workflow.** A physical goods-in-transit
  concept (dispatched from source, not yet received at destination — with stock
  temporarily belonging to neither location) is a real-world pattern, but
  `context/Phases/phase-tracker.md`'s Phase 5 table does not ask for it, and the
  Inventory Engine's existing `transferStock` API already writes both the OUT and IN
  rows atomically in one call — modeling an in-transit gap would mean *not* using
  `transferStock` as built (it would need a third "in transit" pseudo-location or a
  deferred IN row), a materially bigger change to already-shipped engine behavior than
  this document warrants. This spec picks the simpler, engine-native shape: `DRAFT` (data
  entry) → `POSTED` (both warehouses updated atomically, in the same instant) →
  `CANCELLED` (from `DRAFT` only, since `POSTED` represents stock that has already,
  atomically, arrived). If a real future requirement needs true in-transit tracking, that
  is a new feature-spec's job — recorded here as a deliberate simplification, the same
  posture `37-delivery-challans.md` took for its own no-stock-effect scope decision.
- **`transferStock` is called once per line, not once per document.** The engine's own
  contract ties one `transferGroupId` to one OUT/IN pair (one product, one quantity, one
  source, one destination). A multi-line transfer document therefore makes N engine
  calls inside one Serializable transaction (all-or-nothing across lines, same posting
  transaction) — the document's own `id` is the durable "these N transfers happened
  together" grouping; no attempt is made to force a single shared `transferGroupId`
  across lines, since the engine does not expose that as a parameter and forcing it
  would require an engine API change out of scope for a consuming document.
- **`sourceWarehouseId`/`destinationWarehouseId` are header-level, not per-line** — a
  single Stock Transfer document moves goods between exactly two warehouses; a transfer
  spanning more than two locations is two separate documents. This mirrors real-world
  transfer-note usage (Tally-class ERPs model stock journals the same way) and keeps the
  per-line schema minimal (`productId` + `quantity` only).
- Two named relations (`StockTransferSource`/`StockTransferDestination`) on `Warehouse`
  are required since both FKs target the same model — the standard Prisma pattern for
  a self-referencing-target double relation (already used elsewhere in this codebase for
  `CompanySettings`'s multiple `Ledger` relations).
- **`transferNumber` is nullable, assigned only at posting** — identical rationale to
  every other document in this codebase with the same decision (Purchase Invoice, Stock
  Adjustment): a `DRAFT` transfer has no committed identity yet; Postgres's
  NULLs-are-distinct semantics keep the `@@unique` correct across coexisting drafts.
- No `branchId`, same posture as every spec in this project.

---

# Business Rules

- **`sourceWarehouseId` ≠ `destinationWarehouseId`**, validated at both draft-save and
  posting time (the engine's own `transferStock` rule, re-surfaced here with a
  document-level friendly error before any engine call).
- Both warehouses must belong to the caller's company and be **active**.
- **Editable while `DRAFT`.** Posting freezes the document.
- **Posting (`postStockTransfer`, one transaction)**:
  1. Re-validate both warehouses (active, company-owned, distinct) and every line's
     product (active, company-owned, `TRADING`).
  2. Generate `transferNumber` (`ensureSequence` before the transaction,
     `generateNumber` inside it — spec 34's contract).
  3. For each line, call `inventoryEngine.transferStock(companyId, {productId,
     sourceWarehouseId, destinationWarehouseId, quantity, transactionDate}, tx)` — all N
     calls share this document's one Serializable transaction (the engine's own
     documented isolation contract for any batch containing an OUT-side movement,
     which every transfer line is).
  4. Set `status = POSTED`.
- **Availability**: each line's transfer is rejected if the source warehouse's current
  stock for that product is insufficient, unless `CompanySettings.allowNegativeStock` is
  true — the engine's own existing gate on the OUT side of `transferStock`, not
  reimplemented here.
- **Cancellation**: `cancelStockTransfer(id)` — only a `POSTED`, not-yet-cancelled
  transfer; for each line, calls `inventoryEngine.transferStock` again with source and
  destination **swapped** (moving the same quantity back), atomically in one Serializable
  transaction with bounded retry, mirroring how every other posted-document cancellation
  in this codebase reverses its original engine call rather than mutating history. Sets
  `status = CANCELLED`.
- **Company-scoped for every user**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/stock-transfers/repositories/stock-transfer-repository.ts
src/modules/stock-transfers/services/stock-transfer-service.ts
src/modules/stock-transfers/validation/stock-transfer-schema.ts
src/modules/stock-transfers/actions/stock-transfer-actions.ts
src/modules/stock-transfers/components/…
src/types/stock-transfer.ts
```

- `stockTransferService`: `listStockTransfers(filters)`, `getStockTransfer(id)`,
  `createDraft(input)`, `updateDraft(id, input)` (only while `DRAFT`),
  `postStockTransfer(id)`, `cancelStockTransfer(id)`.

---

# Validation

Zod (`stock-transfer-schema.ts`): `transferDate` calendar date, `sourceWarehouseId`/
`destinationWarehouseId` uuid with an object-level refine rejecting equal values,
`narration` ≤ 500, lines array ≥ 1 (`productId` uuid, `quantity` > 0 honoring unit
precision).

---

# UI

Pages (under the `/inventory` hub)

- `/inventory/transfers` — Stock Transfer list (Number, Source, Destination, Date, Line
  Count, Status, Actions) with search + status/warehouse/date filters
- `/inventory/transfers/new` — Create Stock Transfer (source + destination warehouse
  pickers, multi-line product/quantity grid)
- `/inventory/transfers/[id]` — View Stock Transfer (read-only detail, status actions:
  Post / Cancel)
- `/inventory/transfers/[id]/edit` — Edit Stock Transfer (only reachable while `DRAFT`)

Components (`src/modules/stock-transfers/components/`): Stock Transfer Table (+ filter
bar), Stock Transfer Form (warehouse-pair picker + product/quantity line editor), Stock
Transfer Status Badge.

Wire-up

- Add a "Stock Transfer" card to the `/inventory` hub page.
- Add `transfers: "Stock Transfers"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `inventory` permission module: `view`, `create`, `edit` (update while
`DRAFT`), `approve` used by Post (unconditional, same posture as Stock Adjustment's
Post-gate), `delete` not implemented. Company-scoped identically to every spec in this
project.

---

# Database

New enum `StockTransferStatus`; new models `StockTransfer`, `StockTransferItem`. One
migration. Back-relations on `Company`, `FinancialYear`, `Warehouse` (two named
relations), `Product`, `User`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic outside the Inventory Engine, Serializable +
bounded-retry for posting and cancellation, vitest coverage for:

- source ≠ destination rejection (both at schema and service level)
- multi-line transfer atomicity (an injected failure on a later line rolls back earlier
  lines' engine calls in the same posting transaction)
- availability rejection on the source side (with `allowNegativeStock` off) and the
  allowed-negative case (with it on)
- cancellation's swapped-direction reversal per line and its transaction atomicity
- non-`TRADING` product rejection, inactive/cross-company warehouse/product rejection
- numbering uniqueness and the nullable-until-posted `transferNumber` behavior

---

# Do Not

Do not implement

- An in-transit / two-step receive workflow (see Data Model Decisions)
- Any GST or Voucher Engine call
- Stock Adjustment (#45) or Physical Verification (#47) concepts
- Printing, PDF generation, or WhatsApp sharing

---

# Success Criteria

Verify

- Posting a multi-line Stock Transfer produces exactly one linked OUT/IN row pair per
  line at the correct warehouses, atomically, and rejects the whole posting if any line
  fails (e.g. insufficient source stock on one line rolls back lines already processed
  in the same transaction).
- `sourceWarehouseId === destinationWarehouseId` is rejected before any engine call.
- Cancelling a posted transfer reverses every line (source and destination swapped, same
  quantity), atomically.
- A `DRAFT` transfer persists with `transferNumber = null`; multiple `DRAFT` transfers
  coexist without a unique-constraint conflict; posting assigns the first real number.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/inventory/transfers*` appears in the build route table.

Feature-spec 48 (this spec) is `context/Phases/phase-tracker.md`'s Phase 5 item #46.
Feature-spec 49 (Physical Verification, tracker #47) is next.
