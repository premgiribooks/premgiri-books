# 91 - Serial Number Tracking

> Feature-spec file number 91 (v3 sequence, continuing from v2's highest spec 90).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 1 — Carry-Over
> Completions**, tracker item **#82 Serial Number Tracking**.
>
> This is a carry-over from v2: the feature was fully spec-drafted as
> `context/feature-specs/51-serial-number-tracking.md` (v2 spec 51, v2 tracker #49)
> but was never implemented. The v2 spec is the authoritative design — read it in full
> before reading this file. This v3 spec adds only the carry-over context, any
> amendments discovered since v2's draft, and the implementation checklist.
>
> Depends On: Product Management (v2 #23, spec 25); Batch Tracking (v2 #48, spec 50).
> Must be implemented after Batch Tracking — the two features share the mutual-exclusion
> DB CHECK constraint deferred in spec 50.

## Goal

Implement **Serial Number Tracking** for Premgiri Books ERP — an opt-in, per-product
capability to track individual units by unique serial number (IMEI, equipment tag,
device serial) across the full inventory lifecycle: receipt, sale, transfer, return,
and physical verification.

Every serial number has a derivable status and current warehouse — never a stored
status column. Status and location are always computed from the serial number's own
movement history via `deriveSerialStatus()`.

---

## Project Context

Read before implementation:

1. `context/feature-specs/51-serial-number-tracking.md` — the v2 spec; **read in full**.
   This v3 spec is a wrapper — all detailed design is in the v2 spec.
2. `context/feature-specs/50-batch-tracking.md` — mutual-exclusion constraint between
   `isBatchTracked` and `isSerialTracked` was deferred to this spec's migration.
3. `context/feature-specs/32-inventory-engine.md` — `recordMovements()` is extended
   to validate serial numbers before an OUT movement.
4. `context/feature-specs/25-product-management.md` — `Product.isSerialTracked` flag.
5. `context-v3/architecture-context.md` — no new architectural decisions for this spec;
   the v2 invariants apply.

---

## Module Responsibilities

The Serial Number Tracking module is responsible for:

- `Product.isSerialTracked` flag — opt-in, mutually exclusive with `isBatchTracked`
- `SerialNumber` model — static catalog (identity, product FK, company FK); no `status`
  column
- `StockTransaction.serialId` — optional FK; required when the product `isSerialTracked`;
  quantity must equal exactly 1 for every line with a `serialId`
- `deriveSerialStatus(serialId)` — computes current status and warehouse from movement
  history; the only way status is ever known
- Serial Number Management UI at `/inventory/serial-numbers` — list, search by
  serial number / product / status
- Serial Numbers tab on the Product Detail Page (`/masters/products/[id]`) — per-product
  history view

---

## Data Model

```prisma
model SerialNumber {
  id          String   @id @default(uuid())
  companyId   String
  productId   String
  serialCode  String   // The actual serial/IMEI number
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company  Company  @relation(fields: [companyId], references: [id])
  product  Product  @relation(fields: [productId], references: [id])

  @@unique([companyId, serialCode])
  @@index([companyId, productId])
}
```

Add to `StockTransaction`:
```prisma
  serialId    String?
  serial      SerialNumber? @relation(fields: [serialId], references: [id])
```

Add to `Product`:
```prisma
  isSerialTracked Boolean @default(false)
```

Add the mutual-exclusion DB CHECK deferred from spec 50:
```prisma
  @@check(name: "batch_serial_exclusive", fields: ["isBatchTracked", "isSerialTracked"],
          constraint: "NOT (\"isBatchTracked\" AND \"isSerialTracked\")")
```

---

## Business Rules

1. A product cannot be both `isBatchTracked` and `isSerialTracked` simultaneously.
2. Every OUT movement for a serial-tracked product must supply a valid `serialId`.
3. A serial number that is already OUT (sold, transferred out) cannot be used in another
   OUT movement unless it has a corresponding IN movement bringing it back.
4. Serial number quantity per `StockTransaction` line must equal exactly 1.
5. `SerialNumber` rows are never deleted — only the movement history changes.
6. Changing `isSerialTracked` on a product that already has stock transactions is
   blocked with a user-facing error.

---

## Validation Rules

- `serialCode` is required on a `SerialNumber` record; max 100 characters.
- `serialId` on a `StockTransaction` line is required if `Product.isSerialTracked = true`.
- A `serialId` on an OUT line must belong to the same `companyId` and `productId`.
- `deriveSerialStatus()` is called inside the Inventory Engine's posting transaction
  to validate no double-out race condition.

---

## API / Server Actions

- `serialNumberActions.listSerialNumbers(companyId, filters)` — paginated list with
  derived status
- `serialNumberActions.getSerialHistory(companyId, serialId)` — full movement history
- `inventoryEngine.recordMovements()` amendment — validates `serialId` fields

---

## UI

### Serial Numbers Hub (`/inventory/serial-numbers`)
- Search by serial code, product name
- Filter by derived status (In Stock / Sold / Transferred / Returned)
- Table: serial code, product, current warehouse (derived), status badge, last movement date
- Click to view serial history

### Product Detail — Serial Numbers Tab
- List of all serials for this product
- Derived status per serial
- Link to the stock transaction that moved each serial

### Stock Movement Screens Amendment
- Purchase Invoice line editor: add serial number input for serial-tracked products
- Sales Invoice line editor: serial number picker (only shows available serials for the
  selected product/warehouse)
- Stock Transfer, Stock Adjustment: same serial picker

---

## Security Considerations

- `serialId` on a `StockTransaction` must belong to the requesting company — validated
  server-side in the service layer before the transaction is written.
- `deriveSerialStatus()` always re-reads from the DB inside the transaction — never
  from a client-supplied `status` field.

---

## Testing Requirements

- Unit tests for `deriveSerialStatus()` covering: never-moved, in-stock, sold, returned
- Integration tests for the mutual-exclusion constraint
- Service tests for the double-out race condition guard
- Schema tests: serial quantity = 1 enforcement, batch/serial exclusive guard

---

## Known Deviations / Decisions

1. **No stored `status` column** — status is always derived, as established by
   `context/architecture-context.md` Inventory Engine section.
2. **Retrofit to existing movement screens** (Purchase Invoice, Sales Invoice, Stock
   Transfer, Adjustment) is in scope for this spec — it was deferred in v2's batch
   tracking spec 50, and v3 resolves it here. Retrofit only affects the line-item
   editor UI and the service-layer `serialId` validation; no engine re-architecture.
