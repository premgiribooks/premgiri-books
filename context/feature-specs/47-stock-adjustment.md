# 47 - Stock Adjustment

> Feature-spec file number 47. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 5 — Inventory** item **#45 Stock Adjustment**. Depends on the Inventory Engine
> (feature-spec 32) and, for its `/inventory` hub placement, on Opening Stock
> (feature-spec 46, which establishes the hub). Second of Phase 5's six documents. Read
> `32-inventory-engine.md` and `46-opening-stock.md` first — unlike Opening Stock, this
> spec **does** introduce a real document header, matching
> `34-document-number-engine.md`'s `DocumentType.STOCK_ADJUSTMENT`, already reserved with
> no consumer until now.

## Goal

Implement **Stock Adjustment** for **Premgiri Books ERP** — the numbered document a
business uses to correct stock for a reason other than a sale, purchase, transfer, or
physical count: found extra stock, shrinkage, damage, expiry write-off, or fixing a
prior mis-entry (including Opening Stock's, per that spec's own documented deferral).
`StockTransactionType.ADJUSTMENT` already exists (spec 32) with no consumer — this
document is what it was reserved for, together with `DocumentType.STOCK_ADJUSTMENT`
(spec 34).

---

# Project Context

Before implementation, review

- `32-inventory-engine.md` (**read this first** — `recordMovements`,
  `StockTransactionType.ADJUSTMENT` → IN or OUT freely per movement, the availability
  gate on OUT lines honoring `CompanySettings.allowNegativeStock`)
- `46-opening-stock.md` (the `/inventory` hub this spec adds its second card to; the
  "Opening Stock mistakes are corrected here, not by re-entering Opening Stock" note)
- `25-product-management.md` (`TRADING`-only; unit `decimalPlaces`)
- `24-warehouse-management.md` (`Warehouse`)
- `34-document-number-engine.md` (`DocumentType.STOCK_ADJUSTMENT`, already reserved)
- `37-delivery-challans.md` (the closest structural analog: a document with no financial
  consequence, calling one already-built engine, with a simple two-state-past-draft
  lifecycle — read for the shape, not the content)

---

# Module Responsibilities

The Stock Adjustment module is responsible for

- Stock Adjustment Master (Create/Post/View/Cancel, scoped to the active company and
  financial year), one document = one or more product/warehouse lines, each with its
  own direction (IN = found/increase, OUT = write-off/decrease) and quantity
  - A mandatory header-level `reason` (free text) — the audit trail for *why* stock
    moved outside the normal sales/purchase/transfer flow
- Posting, atomically: one `StockTransactionType.ADJUSTMENT` stock movement per line
  (direction as chosen per line), honoring the engine's availability gate for OUT lines
- Stock Adjustment numbering via the Document Number Engine
  (`DocumentType.STOCK_ADJUSTMENT`)

The Stock Adjustment module is **not** responsible for

- Any GST or Voucher Engine call — an adjustment has zero financial consequence in this
  spec's scope (see the explicit note below)
- Physical-count reconciliation workflows (Physical Verification, #47, is the dedicated,
  auditable count-and-variance document; Stock Adjustment is for a single known
  correction, not a full recount)
- Stock Transfer between two warehouses of the same company (#46 — a transfer is not an
  adjustment; it has no net stock change company-wide)

**Explicit, recorded scope note — a known asymmetry, not resolved speculatively.** A
real business's shrinkage/damage write-off often *should* eventually hit an expense
ledger (e.g., "Inventory Write-off" under Indirect Expenses) — the Inventory Engine's own
"Inventory module never creates accounting entries directly" rule is why this spec does
not add that call itself; a document is free to orchestrate the Voucher Engine
alongside the Inventory Engine (as Purchase Invoice and Sales Invoice both do), so the
absence of a financial consequence here is a **scope decision of this spec**, not a
structural impossibility. It is deferred because `context/Phases/phase-tracker.md`'s
Phase 5 table does not ask for it and no Company Settings ledger mapping for an
"Inventory Write-off" ledger exists yet. If a future requirement asks for it, that is a
new feature-spec's job to scope (mirroring how `45-purchase-return.md`'s own Goal section
recorded its Purchase-side Credit/Debit Note gap the same way) — not a silent addition
here.

---

# Data Model

Add to `prisma/schema.prisma` (plus `stockAdjustments StockAdjustment[]` back-relations
on `Company`, `FinancialYear`, `User`):

```text
enum StockAdjustmentStatus {
  DRAFT
  POSTED
  CANCELLED
}

model StockAdjustment {
  id                String                @id @default(uuid())
  companyId         String
  company           Company               @relation(fields: [companyId], references: [id])
  financialYearId   String
  financialYear     FinancialYear         @relation(fields: [financialYearId], references: [id])
  adjustmentNumber  String?
  adjustmentDate    DateTime              @db.Date
  reason            String
  status            StockAdjustmentStatus @default(DRAFT)
  createdByUserId   String?
  createdBy         User?                 @relation(fields: [createdByUserId], references: [id])
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  items StockAdjustmentItem[]

  @@unique([companyId, financialYearId, adjustmentNumber])
  @@index([companyId, status])
}

model StockAdjustmentItem {
  id                 String          @id @default(uuid())
  stockAdjustmentId  String
  stockAdjustment    StockAdjustment @relation(fields: [stockAdjustmentId], references: [id])
  lineNumber         Int
  productId          String
  product            Product         @relation(fields: [productId], references: [id])
  warehouseId        String
  warehouse          Warehouse       @relation(fields: [warehouseId], references: [id])
  direction          StockDirection  // reused enum, spec 32 — IN (found) or OUT (write-off)
  quantity           Decimal         @db.Decimal(14, 4)
  narration          String?

  @@unique([stockAdjustmentId, lineNumber])
  @@index([productId])
  @@index([warehouseId])
}
```

Decisions

- **`adjustmentNumber` is nullable, assigned only at posting** — identical rationale to
  `44-purchase-invoice.md`'s `invoiceNumber` decision: a `DRAFT` adjustment has no
  committed identity yet, and Postgres unique indexes treat multiple `NULL`s as
  distinct, so the `@@unique` holds correctly across coexisting drafts.
- **`direction` reused from spec 32's `StockDirection` enum, per line** — a single
  adjustment document may mix found-stock (IN) and write-off (OUT) lines; the engine
  already validates `ADJUSTMENT` freely as IN or OUT per movement, so this schema
  mirrors that shape exactly rather than forcing one direction per document.
- **Header-level `reason` is required**; per-line `narration` is optional
  supplementary detail (e.g. "carton crushed in transit" on one specific line within a
  broader "quarterly shrinkage write-off" header reason).
- No `refundMode`/ledger fields of any kind — see Module Responsibilities' explicit
  scope note; this document has no financial dimension in this spec.
- No `branchId`, same posture as every spec in this project.

---

# Business Rules

- **Editable while `DRAFT`.** Posting freezes the document.
- **Posting (`postStockAdjustment`, one transaction)**:
  1. Re-validate every line's product/warehouse belong to the company and are active,
     and the product is `TRADING`.
  2. Generate `adjustmentNumber` (`ensureSequence` before the transaction,
     `generateNumber` inside it — spec 34's contract).
  3. Call `inventoryEngine.recordMovements(companyId, lines, tx)` —
     `StockTransactionType.ADJUSTMENT`, each line's own `direction`,
     `referenceType = "STOCK_ADJUSTMENT"`, `referenceId = adjustment.id`. Because the
     batch may contain OUT lines, this transaction runs at **Serializable isolation
     with bounded P2034 retry** (the engine's own documented contract for any batch
     containing an OUT line — this document owns that retry, not the engine, per spec
     32's isolation-contract note).
  4. Set `status = POSTED`.
- **Availability**: an OUT line is rejected if it would take a product/warehouse's
  current stock negative, unless `CompanySettings.allowNegativeStock` is true — the
  engine's own existing gate, not reimplemented here.
- **Cancellation**: `cancelStockAdjustment(id)` — only a `POSTED`, not-yet-cancelled
  adjustment; reverses every line's stock movement (same product/warehouse/quantity,
  **opposite direction** — an OUT line's reversal is an IN of the same quantity, and
  vice versa) atomically, in one Serializable transaction with bounded retry (mirrors
  the reversal pattern of every posted-document cancellation in this codebase). Sets
  `status = CANCELLED`.
- **Company-scoped for every user**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/stock-adjustments/repositories/stock-adjustment-repository.ts
src/modules/stock-adjustments/services/stock-adjustment-service.ts
src/modules/stock-adjustments/validation/stock-adjustment-schema.ts
src/modules/stock-adjustments/actions/stock-adjustment-actions.ts
src/modules/stock-adjustments/components/…
src/types/stock-adjustment.ts
```

- `stockAdjustmentService`: `listStockAdjustments(filters)`, `getStockAdjustment(id)`,
  `createDraft(input)`, `updateDraft(id, input)` (only while `DRAFT`),
  `postStockAdjustment(id)`, `cancelStockAdjustment(id)`.

---

# Validation

Zod (`stock-adjustment-schema.ts`): `adjustmentDate` calendar date, `reason` required
non-empty ≤ 500, lines array ≥ 1 (`productId`/`warehouseId` uuid, `direction` enum
`IN`/`OUT`, `quantity` > 0 honoring unit precision, `narration` ≤ 500 optional per line).

---

# UI

Pages (under the `/inventory` hub, established by `46-opening-stock.md`)

- `/inventory/adjustments` — Stock Adjustment list (Number, Date, Reason, Line Count,
  Status, Actions) with search + status/date filters
- `/inventory/adjustments/new` — Create Stock Adjustment (header reason + multi-line
  grid: product, warehouse, direction toggle, quantity, optional per-line narration)
- `/inventory/adjustments/[id]` — View Stock Adjustment (read-only detail, status
  actions: Post / Cancel)
- `/inventory/adjustments/[id]/edit` — Edit Stock Adjustment (only reachable while
  `DRAFT`)

Components (`src/modules/stock-adjustments/components/`): Stock Adjustment Table (+
filter bar), Stock Adjustment Form (direction-aware line editor), Stock Adjustment
Status Badge.

Wire-up

- Add a "Stock Adjustment" card to the `/inventory` hub page.
- Add `adjustments: "Stock Adjustments"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `inventory` permission module: `view`, `create`, `edit` (update while
`DRAFT`), `approve` used by Post (unconditional — every adjustment is a stock correction
outside the normal transactional flow and warrants sign-off, mirroring Purchase
Return's unconditional Post-gate posture), `delete` not implemented. Company-scoped
identically to every spec in this project.

---

# Database

New enum `StockAdjustmentStatus` (reuses spec 32's `StockDirection`, no new direction
enum); new models `StockAdjustment`, `StockAdjustmentItem`. One migration. Back-relations
on `Company`, `FinancialYear`, `Product`, `Warehouse`, `User`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic outside the Inventory Engine, Serializable +
bounded-retry for posting (OUT-line availability) and cancellation, vitest coverage for:

- mixed IN/OUT lines within one document posting correctly and atomically
- OUT-line availability rejection (with `allowNegativeStock` off) and the allowed-negative
  case (with it on)
- cancellation's mirrored per-line reversal (an IN line's cancellation reversal is OUT,
  and vice versa) and its transaction atomicity
- non-`TRADING` product rejection, inactive/cross-company product/warehouse rejection
- numbering uniqueness and the nullable-until-posted `adjustmentNumber` behavior
  (multiple coexisting `DRAFT` adjustments, no unique-constraint conflict)

---

# Do Not

Do not implement

- Any GST or Voucher Engine call (see Module Responsibilities' explicit scope note)
- Physical-count reconciliation (Physical Verification, #47, owns that workflow)
- Stock Transfer (#46 — a distinct document with no net stock change)
- Printing, PDF generation, or WhatsApp sharing

---

# Success Criteria

Verify

- Posting a Stock Adjustment with mixed IN/OUT lines produces the correct
  `StockTransactionType.ADJUSTMENT` row per line, atomically, with each line's own
  direction honored.
- An OUT line that would take stock negative is rejected when `allowNegativeStock` is
  off, and allowed (with negative stock reading back correctly) when on.
- Cancelling a posted adjustment reverses every line correctly (opposite direction, same
  quantity), atomically — an injected failure partway through rolls back the whole
  cancellation.
- A `DRAFT` adjustment persists with `adjustmentNumber = null`; multiple `DRAFT`
  adjustments coexist without a unique-constraint conflict; posting assigns the first
  real number.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/inventory/adjustments*` appears in the build route table.

Feature-spec 47 (this spec) is `context/Phases/phase-tracker.md`'s Phase 5 item #45.
Feature-spec 48 (Stock Transfer, tracker #46) is next.
