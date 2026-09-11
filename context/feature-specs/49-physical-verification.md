# 49 - Physical Verification

> Feature-spec file number 49. This feature is `context/Phases/phase-tracker.md`'s
> **Phase 5 — Inventory** item **#47 Physical Verification**. Depends on the Inventory
> Engine (feature-spec 32). Fourth of Phase 5's six documents. Read `32-inventory-engine.md`
> first — this spec adds a new `DocumentType.PHYSICAL_VERIFICATION` value that
> `34-document-number-engine.md` did **not** originally reserve (unlike `STOCK_ADJUSTMENT`/
> `STOCK_TRANSFER`), since a physical count is exactly the kind of auditable, numbered
> business document that engine's own numbering rules exist for — see Decisions.

## Goal

Implement **Physical Verification** for **Premgiri Books ERP** — the stock-count
reconciliation document: a user records the physically counted quantity of each
product/warehouse pair being verified, the system computes the variance against current
system stock, and confirming the count posts one stock movement per line with a
non-zero variance. `StockTransactionType.PHYSICAL_VERIFICATION` already exists (spec 32)
with no consumer — this document is what it was reserved for.

---

# Project Context

Before implementation, review

- `32-inventory-engine.md` (**read this first** — `getCurrentStock` for the variance
  calculation, `recordMovements`, `StockTransactionType.PHYSICAL_VERIFICATION` → IN or
  OUT freely, distinct from `ADJUSTMENT` — see Decisions for why this document posts as
  the former, not the latter)
- `47-stock-adjustment.md` (the sibling document this spec is most easily confused
  with — read its Module Responsibilities' distinction: Stock Adjustment is a single
  known correction with a reason; Physical Verification is a full count-and-reconcile
  event with a system-vs-counted snapshot per line)
- `25-product-management.md` (`TRADING`-only; unit `decimalPlaces`)
- `24-warehouse-management.md` (`Warehouse` — a count is always scoped to one warehouse)
- `34-document-number-engine.md` (this spec adds `DocumentType.PHYSICAL_VERIFICATION`)

---

# Module Responsibilities

The Physical Verification module is responsible for

- Physical Verification Master (Create/Complete/View/Cancel-while-draft, scoped to the
  active company, financial year, and **one warehouse per document**): a count header
  (count date, counted-by, warehouse) plus one line per product counted, each snapshotting
  **system quantity at completion time** (not draft-entry time — see Business Rules),
  **counted quantity** (user-entered), and the derived **variance**
- On completion, posting a `StockTransactionType.PHYSICAL_VERIFICATION` movement for
  every line whose variance is non-zero (direction IN when counted > system, OUT when
  counted < system); lines with zero variance produce no stock movement, but remain
  part of the permanent record (a "counted, confirmed correct" line has audit value too)
- Physical Verification numbering via the Document Number Engine
  (`DocumentType.PHYSICAL_VERIFICATION`)

The Physical Verification module is **not** responsible for

- Single, ad hoc corrections with a known cause (Stock Adjustment, #45, is that
  document — free text reason, no system-vs-counted snapshot, no variance concept)
- Multi-warehouse counts in one document (see Data Model Decisions)
- Any GST or Voucher Engine call — identical zero-financial-consequence posture to Stock
  Adjustment and Stock Transfer

---

# Data Model

Add to `prisma/schema.prisma` (plus `physicalVerifications PhysicalVerification[]`
back-relations on `Company`, `FinancialYear`, `Warehouse`, `User`; one new
`DocumentType` value):

```text
enum PhysicalVerificationStatus {
  DRAFT
  COMPLETED
  CANCELLED
}

model PhysicalVerification {
  id                String                     @id @default(uuid())
  companyId         String
  company           Company                    @relation(fields: [companyId], references: [id])
  financialYearId   String
  financialYear     FinancialYear              @relation(fields: [financialYearId], references: [id])
  verificationNumber String?
  verificationDate  DateTime                   @db.Date
  warehouseId       String
  warehouse         Warehouse                  @relation(fields: [warehouseId], references: [id])
  status            PhysicalVerificationStatus @default(DRAFT)
  narration         String?
  createdByUserId   String?
  createdBy         User?                      @relation(fields: [createdByUserId], references: [id])
  createdAt         DateTime                   @default(now())
  updatedAt         DateTime                   @updatedAt

  items PhysicalVerificationItem[]

  @@unique([companyId, financialYearId, verificationNumber])
  @@index([companyId, status])
  @@index([warehouseId])
}

model PhysicalVerificationItem {
  id                     String               @id @default(uuid())
  physicalVerificationId String
  physicalVerification   PhysicalVerification @relation(fields: [physicalVerificationId], references: [id])
  lineNumber             Int
  productId              String
  product                Product              @relation(fields: [productId], references: [id])
  systemQuantity         Decimal              @db.Decimal(14, 4)
  countedQuantity        Decimal              @db.Decimal(14, 4)
  varianceQuantity       Decimal              @db.Decimal(14, 4)

  @@unique([physicalVerificationId, lineNumber])
  @@index([productId])
}
```

Decisions

- **`DocumentType.PHYSICAL_VERIFICATION` is a new enum value**, added by this spec's
  migration — `34-document-number-engine.md`'s original `DocumentType` list (drafted
  2026-07-12) reserved `STOCK_ADJUSTMENT`/`STOCK_TRANSFER` but not this one. Rather than
  silently treating that omission the way `46-opening-stock.md` treated it (as a signal
  that no document/numbering is warranted), this spec's own requirement — "a mandatory
  count-header document... so a physical count is auditable as one document, not silent
  ad hoc rows" — is exactly the kind of recurring, referenceable business document the
  engine exists to number. The omission is treated here as an incomplete original list,
  not a deliberate exclusion, and is corrected by adding the value now rather than
  working around it.
- **Posts as `StockTransactionType.PHYSICAL_VERIFICATION`, not `ADJUSTMENT`** — both
  types are documented in spec 32 as freely IN-or-OUT, and either would function
  correctly, but using the distinct reserved type keeps a stock ledger/report reader able
  to tell "this movement came from a scheduled count reconciliation" apart from "this
  movement came from an ad hoc adjustment" without cross-referencing `referenceType`. The
  two-type reservation in spec 32 only makes sense if this document actually uses its
  own type; using `ADJUSTMENT` here instead would leave `PHYSICAL_VERIFICATION` a dead
  enum value.
- **One warehouse per document, header-level** — a physical count is inherently a
  location-scoped event (someone walks one warehouse's floor); a multi-warehouse count
  is modeled as one Physical Verification document per warehouse, not one document
  spanning several. This mirrors Stock Transfer's header-level warehouse decision for
  the same reason: keeping per-line schema minimal and the document's real-world meaning
  unambiguous.
- **`systemQuantity` is captured fresh at completion time, not at draft-creation
  time** — a count may be drafted (products added to the sheet) hours or days before
  the physical walk is confirmed; using a stale draft-time system quantity would produce
  a wrong variance against whatever stock movements happened in between (a purchase
  receipt, another sale). This mirrors Purchase Invoice's "recompute from current
  state, never trust stale draft totals" posture (spec 44) applied to quantities instead
  of money. `systemQuantity`/`varianceQuantity` as *stored* on the row are therefore
  always the values computed and frozen at the moment of completion, re-derived from
  `inventoryEngine.getCurrentStock` inside the same transaction that posts the resulting
  movements — never client-supplied, never trusted from the draft-time UI preview.
- **`verificationNumber` is nullable, assigned only at completion** — identical
  rationale to every other spec in this project with the same decision.
- No `refundMode`/ledger fields, no `branchId` — same posture as every spec in this
  project.

---

# Business Rules

- **Editable while `DRAFT`** (adding/removing product lines, adjusting the warehouse or
  date). Completion freezes the document.
- **Completing a verification (`completePhysicalVerification`, one transaction)**:
  1. Re-validate the warehouse (active, company-owned) and every line's product (active,
     company-owned, `TRADING`).
  2. For each line, re-read `inventoryEngine.getCurrentStock(companyId, {productId,
     warehouseId})` **inside the transaction** and overwrite `systemQuantity` with that
     freshly-read value (never the client-submitted or draft-time value); compute
     `varianceQuantity = countedQuantity − systemQuantity`.
  3. Generate `verificationNumber` (`ensureSequence` before the transaction,
     `generateNumber` inside it — spec 34's contract).
  4. For every line where `varianceQuantity ≠ 0`, call
     `inventoryEngine.recordMovements` with `StockTransactionType.PHYSICAL_VERIFICATION`,
     direction `IN` when `varianceQuantity > 0` and `OUT` when `varianceQuantity < 0`,
     quantity `abs(varianceQuantity)`, `referenceType = "PHYSICAL_VERIFICATION"`,
     `referenceId = verification.id`. Because the batch may contain OUT lines, this
     transaction runs at **Serializable isolation with bounded P2034 retry** (the same
     contract Stock Adjustment's posting uses).
  5. Set `status = COMPLETED`.
- **Availability**: an OUT-direction variance line (counted less than system — a
  shortage) is rejected only if it would take stock negative and
  `CompanySettings.allowNegativeStock` is false — in practice this should be rare (a
  shortage variance brings stock *down* toward the counted, presumably non-negative,
  reality), but the engine's own gate is not bypassed here; a company with the setting
  off and a data-entry error (counted quantity accidentally negative, caught by Zod
  before this point regardless) still gets the same protection every other OUT-writer
  gets.
- **No cancellation of a `COMPLETED` verification** — once movements are posted, the
  document is immutable, identical posture to the Inventory Engine's "stock transactions
  are never edited or deleted" invariant; only `DRAFT → CANCELLED` exists (abandoning an
  in-progress count before completion, no reversal needed since nothing was posted). A
  miscounted verification is corrected by a **subsequent** Stock Adjustment (#45)
  document, exactly as `46-opening-stock.md`'s own mis-entries are corrected there — not
  by editing or un-completing this one.
- **Company-scoped for every user**, identical posture to every spec in this project.

---

# Service / Repository

Create

```text
src/modules/physical-verifications/repositories/physical-verification-repository.ts
src/modules/physical-verifications/services/physical-verification-service.ts
src/modules/physical-verifications/validation/physical-verification-schema.ts
src/modules/physical-verifications/actions/physical-verification-actions.ts
src/modules/physical-verifications/components/…
src/types/physical-verification.ts
```

- `physicalVerificationService`: `listPhysicalVerifications(filters)`,
  `getPhysicalVerification(id)`, `createDraft(input)` (each line's `systemQuantity`
  shown as a **live preview only**, via `getCurrentStock`, not persisted until
  completion), `updateDraft(id, input)` (only while `DRAFT`),
  `completePhysicalVerification(id)`, `cancelPhysicalVerification(id)` (`DRAFT` only).

---

# Validation

Zod (`physical-verification-schema.ts`): `verificationDate` calendar date,
`warehouseId` uuid, `narration` ≤ 500, lines array ≥ 1 (`productId` uuid,
`countedQuantity` ≥ 0 honoring unit precision — zero is a legal count, meaning "found
none," distinct from omitting the line entirely). `systemQuantity`/`varianceQuantity`
are never accepted as client input on the write path (server-computed only — see Data
Model Decisions); if present in a submitted payload they are ignored, not merely
validated.

---

# UI

Pages (under the `/inventory` hub)

- `/inventory/verifications` — Physical Verification list (Number, Warehouse, Date,
  Line Count, Status, Actions) with search + status/warehouse/date filters
- `/inventory/verifications/new` — Create Physical Verification (warehouse picker,
  multi-line product grid with a live system-quantity preview column and a
  counted-quantity input column; variance shown live, client-side, for the user's
  benefit — always recomputed server-side at completion regardless)
- `/inventory/verifications/[id]` — View Physical Verification (read-only detail
  showing system/counted/variance per line, status actions: Complete / Cancel — Cancel
  only shown while `DRAFT`)
- `/inventory/verifications/[id]/edit` — Edit Physical Verification (only reachable
  while `DRAFT`)

Components (`src/modules/physical-verifications/components/`): Physical Verification
Table (+ filter bar), Physical Verification Form (warehouse picker + count-entry line
editor with live variance column), Physical Verification Status Badge.

Wire-up

- Add a "Physical Verification" card to the `/inventory` hub page — **this is the
  fourth of six cards**, alongside Opening Stock, Stock Adjustment, and Stock Transfer.
- Add `verifications: "Physical Verification"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `inventory` permission module: `view`, `create`, `edit` (update while
`DRAFT`), `approve` used by Complete (unconditional, same posture as Stock
Adjustment/Transfer's Post-gate), `delete` not implemented (Cancel, `DRAFT`-only, is the
removal path). Company-scoped identically to every spec in this project.

---

# Database

New enum `PhysicalVerificationStatus`; new `DocumentType.PHYSICAL_VERIFICATION` value;
new models `PhysicalVerification`, `PhysicalVerificationItem`. One migration.
Back-relations on `Company`, `FinancialYear`, `Warehouse`, `Product`, `User`. No
seeding.

---

# Code Standards

Strict TypeScript, no `any`, no arithmetic outside the Inventory Engine (variance
subtraction is simple enough to live in the service, mirroring how Stock Adjustment's
direction choice lives in the service rather than an engine call — the engine still
owns all actual stock-quantity aggregation via `getCurrentStock`), Serializable +
bounded-retry for completion, vitest coverage for:

- variance computation (positive → IN movement, negative → OUT movement, zero → no
  movement, all in one document) using the **freshly re-read** system quantity at
  completion time, not a stale draft-time value (a test that changes stock between draft
  creation and completion and asserts the movement reflects the *completion-time*
  variance, not the draft-time one)
- a client-submitted `systemQuantity`/`varianceQuantity` on the payload is ignored, not
  trusted
- OUT-direction variance availability rejection (with `allowNegativeStock` off) and the
  allowed-negative case (with it on)
- no cancellation path exists for a `COMPLETED` verification (only `DRAFT` cancels)
- non-`TRADING` product rejection, inactive/cross-company warehouse/product rejection
- numbering uniqueness and the nullable-until-completed `verificationNumber` behavior

---

# Do Not

Do not implement

- Cancellation/reversal of a `COMPLETED` verification (correct via Stock Adjustment
  instead — see Business Rules)
- Multi-warehouse documents (one warehouse per document — see Data Model Decisions)
- Any GST or Voucher Engine call
- Printing, PDF generation, or WhatsApp sharing

---

# Success Criteria

Verify

- Completing a verification with mixed positive/negative/zero-variance lines posts
  exactly one `StockTransactionType.PHYSICAL_VERIFICATION` row per non-zero-variance
  line, correct direction, atomically; zero-variance lines produce no movement but
  remain on the record.
- `systemQuantity`/`varianceQuantity` reflect stock state **at completion time**, not
  draft-creation time, even when other movements occurred in between.
- A client-supplied `systemQuantity`/`varianceQuantity` in the request payload has no
  effect on the posted result.
- No API exists to cancel or edit a `COMPLETED` verification.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/inventory/verifications*` appears in the build route table.

Feature-spec 49 (this spec) is `context/Phases/phase-tracker.md`'s Phase 5 item #47.
Feature-spec 50 (Batch Tracking, tracker #48) is next — the first of the two remaining
Phase 5 documents that genuinely extend the Inventory Engine's own schema, unlike
46–49's UI-and-document-layer-only shape.
