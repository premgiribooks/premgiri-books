/**
 * The pure FIFO-by-warehouse-age allocation algorithm behind Sales Invoice's
 * automatic warehouse selection (removed the manual per-line warehouse
 * picker per explicit user request, 2026-09-20). Framework-free and
 * DB-free by design, mirroring page-tabs-reducer.ts's own split between pure
 * decision logic (here, unit-tested) and the DB-touching glue around it
 * (`resolveWarehouseFifoAllocation` in inventory-engine.ts).
 *
 * The rule, as the user specified it: draw from whichever warehouse has held
 * this product the LONGEST first (its own earliest ever stock-IN date for
 * this product), and only move on to the next-oldest warehouse once the
 * older one is exhausted. This is a warehouse-level FIFO approximation, not
 * true per-unit/batch aging — the stock model has no per-unit lot tracking
 * for a non-batch-tracked product, so "the warehouse that has carried this
 * product longest" is the best available proxy for "the oldest stock."
 */

const QUANTITY_EPSILON = 1e-6;

export interface WarehouseFifoCandidate {
  warehouseId: string;
  /** Current net quantity (Sigma IN - Sigma OUT) available at this
   * warehouse — only ever draws up to this amount from here. */
  availableQuantity: number;
}

export interface WarehouseAllocationLine {
  warehouseId: string;
  quantity: number;
}

export interface WarehouseAllocationResult {
  allocations: WarehouseAllocationLine[];
  /** The portion of `requiredQuantity` that no candidate warehouse could
   * cover — 0 when fully satisfied. The caller decides what to do with a
   * shortfall (allowNegativeStock: dump it into a fallback warehouse; not
   * allowed: reject the whole operation) — this function only ever draws
   * from the candidates it was given, never invents stock. */
  shortfall: number;
}

/**
 * Greedily fills `requiredQuantity` from `candidates`, IN THE ORDER GIVEN
 * (the caller sorts oldest-first) — never reorders them itself, so the
 * "oldest warehouse first" rule lives entirely in how the caller ranks its
 * candidates, not here. A candidate with zero or negative available
 * quantity is skipped (contributes nothing, never a negative allocation).
 */
export function allocateFifoQuantity(
  candidates: readonly WarehouseFifoCandidate[],
  requiredQuantity: number
): WarehouseAllocationResult {
  const allocations: WarehouseAllocationLine[] = [];
  let remaining = requiredQuantity;

  for (const candidate of candidates) {
    if (remaining <= QUANTITY_EPSILON) {
      break;
    }
    if (candidate.availableQuantity <= QUANTITY_EPSILON) {
      continue;
    }
    const take = Math.min(candidate.availableQuantity, remaining);
    allocations.push({ warehouseId: candidate.warehouseId, quantity: take });
    remaining -= take;
  }

  return { allocations, shortfall: remaining > QUANTITY_EPSILON ? remaining : 0 };
}

/**
 * Splits one already-resolved product-level allocation (an ordered queue of
 * warehouse chunks, oldest-first) across that SAME product's own several
 * invoice lines, in line order — needed because `allocateFifoQuantity` is
 * run once per DISTINCT product (combining every line that orders it), not
 * once per line, so two lines of the same product don't each independently
 * "see" and double-claim the same not-yet-consumed stock. Mutates nothing;
 * returns the slice taken for this one line plus the queue's own remainder
 * for the next line to consume from.
 */
export function takeFromAllocationQueue(
  queue: readonly WarehouseAllocationLine[],
  requiredQuantity: number
): { taken: WarehouseAllocationLine[]; remainingQueue: WarehouseAllocationLine[] } {
  const taken: WarehouseAllocationLine[] = [];
  const remainingQueue = queue.map((line) => ({ ...line }));
  let remaining = requiredQuantity;

  while (remaining > QUANTITY_EPSILON && remainingQueue.length > 0) {
    const chunk = remainingQueue[0];
    const take = Math.min(chunk.quantity, remaining);
    taken.push({ warehouseId: chunk.warehouseId, quantity: take });
    chunk.quantity -= take;
    remaining -= take;
    if (chunk.quantity <= QUANTITY_EPSILON) {
      remainingQueue.shift();
    }
  }

  return { taken, remainingQueue };
}
