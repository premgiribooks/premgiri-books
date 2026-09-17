# 98 - FIFO / Weighted Average Costing

> Feature-spec file number 98 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 3 — Architecture
> Hardening**, tracker item **#89 FIFO / Weighted Average Costing**.
>
> Depends On: Inventory Engine (v2 #30, spec 32); Purchase Invoice (v2 #42, spec 44).
> Must be implemented before any new modules in v3 that depend on cost-layered values.

## Goal

Extend the Inventory Engine and Pricing Engine to support FIFO (First In, First Out)
and Weighted Average costing methods alongside the existing Latest Purchase Cost method.

The costing method is a company-level setting. Changing the method recomputes costs from
the existing, immutable `StockTransaction` trail — no data is lost or changed.

---

## Project Context

Read before implementation:

1. `context/feature-specs/32-inventory-engine.md` — Inventory Engine spec; costing is
   extended here without changing existing engine interfaces.
2. `context/feature-specs/30-pricing-engine.md` — Pricing Engine reads costing data.
3. `context/feature-specs/44-purchase-invoice.md` — Purchase Invoice is the primary
   source of IN transactions used in cost-layer computation.
4. `context-v3/architecture-context.md` — Decision 3 (FIFO / Weighted Average Costing).
5. `context-v3/code-standards.md` — FIFO Costing Standards section.

---

## Module Responsibilities

- `CostingMethod` enum added to `CompanySettings`
- `costingEngine` (`src/engines/costing/`) — new pure engine; `getCostLayer()`,
  `computeFifoCost()`, `computeWeightedAvgCost()`
- `inventoryEngine.getStockValue(productId, warehouseId, method)` — new method
  returning current stock value in both quantity and monetary terms
- `pricingEngine` amendment — `resolvePrice()` uses `costingEngine.getCostLayer()`
  when `CostingMethod` is not `LATEST_PURCHASE_COST`
- Stock Valuation Report at `/reports/stock-valuation` showing cost-per-unit by method

---

## Data Model

```prisma
enum CostingMethod {
  LATEST_PURCHASE_COST   // current default — unchanged behavior
  FIFO
  WEIGHTED_AVERAGE
}

// Add to CompanySettings:
  costingMethod CostingMethod @default(LATEST_PURCHASE_COST)
```

No changes to `StockTransaction` — cost is always computed from the trail.

---

## FIFO Algorithm

```
getCostLayer(productId, warehouseId):
  1. Load all IN transactions ordered by transaction date ASC (oldest first).
  2. Load all OUT transactions to compute consumed quantities.
  3. Walk the IN queue, reducing each lot by OUT quantities in FIFO order.
  4. Return the remaining lots with their unit costs and quantities.
  5. The effective unit cost for a new OUT is the cost of the oldest available lot.
```

---

## Weighted Average Algorithm

```
computeWeightedAvgCost(productId, warehouseId):
  1. Sum (quantity × unitCost) for all IN transactions.
  2. Divide by total quantity received.
  3. Return that average as the current unit cost.
  Note: this is a running weighted average, recomputed fresh each time.
```

---

## Business Rules

1. Changing the costing method takes effect for all future price resolutions — it does
   not retroactively change already-posted vouchers.
2. FIFO requires that every IN transaction has a `unitCost` — Purchase Invoice already
   stores `rate` per line. Opening Stock must also carry a cost.
3. If a FIFO queue is exhausted (stock goes below zero), return the last available
   lot cost and log a warning — do not block the operation.
4. Weighted Average is computed fresh on every call — not cached.

---

## Validation Rules

- Costing method can only be changed by a Company Admin (gated on `settings/edit`).
- A company that has existing posted transactions can still change the method — the
  change is prospective, not retroactive.

---

## API / Server Actions

- `costingActions.getStockValuation(companyId, financialYearId, method)` — returns
  per-product, per-warehouse cost summary

---

## UI

### Company Settings Amendment
- Costing Method selector (Latest Purchase Cost / FIFO / Weighted Average)
- Informational note: "Changing this method affects future price calculations only"

### Stock Valuation Report (`/reports/stock-valuation`)
- Grouped by product, warehouse
- Columns: product, warehouse, qty, unit cost (by selected method), total value
- Method selector on the report page (compare methods side by side)
- Export to Excel

---

## Security Considerations

- Costing method change is gated on `settings/edit` — standard Company Admin action.
- `getCostLayer()` always re-reads from the DB — never cached client-side.

---

## Testing Requirements

- `computeFifoCost()`: single lot, multi-lot, partial lot consumption, lot exhaustion
- `computeWeightedAvgCost()`: zero transactions, single IN, mixed IN/OUT
- FIFO vs WA difference test: same transaction set produces different costs (asserts
  they are not always equal, catches copy-paste errors)
- Pricing Engine reads FIFO cost when method is FIFO
- Stock Valuation Report totals match sum of individual line values
