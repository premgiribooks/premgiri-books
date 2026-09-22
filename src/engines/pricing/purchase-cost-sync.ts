import { roundHalfUpToTwoDecimals } from "@/engines/pricing/price-resolution";

// Backs 95-purchase-price-sync.md — the pure selection rule for which lines
// of a posted Purchase Invoice/Order should become the new Product.purchasePrice
// ("Latest Purchase Cost"). No IO here: persistence is the
// product-purchase-price-history module's job. Standalone module inside
// engines/pricing/, mirroring margin-override.ts, so "no price math outside
// src/engines/pricing/" stays true for this feature too.

export interface PurchaseCostLine {
  productId: string;
  lineNumber: number;
  /** Net-of-discount effective unit cost for this line (taxableAmount / quantity). */
  netUnitCost: number;
}

export interface PurchaseCostUpdate {
  productId: string;
  newPurchasePrice: number;
}

/**
 * Resolves one candidate `purchasePrice` update per distinct product from a
 * document's lines (95-purchase-price-sync.md §1.4-1.6):
 * - Last line wins: the highest `lineNumber` for a given `productId`.
 * - A resolved cost `<= 0` is dropped (a free-sample/zero-rated line must
 *   never zero out a product's cost basis).
 * - Non-finite input (NaN/Infinity) is dropped defensively.
 *
 * Whether the resolved value actually differs from the product's *current*
 * `purchasePrice` (the no-op guard) is not this function's concern — it has
 * no access to current state; that check happens at the persistence layer.
 */
export function resolveLatestPurchaseCostUpdates(
  lines: readonly PurchaseCostLine[],
): PurchaseCostUpdate[] {
  const winningLineByProduct = new Map<string, PurchaseCostLine>();

  for (const line of lines) {
    const current = winningLineByProduct.get(line.productId);
    if (!current || line.lineNumber > current.lineNumber) {
      winningLineByProduct.set(line.productId, line);
    }
  }

  const updates: PurchaseCostUpdate[] = [];
  for (const line of winningLineByProduct.values()) {
    if (!Number.isFinite(line.netUnitCost) || line.netUnitCost <= 0) {
      continue;
    }
    updates.push({
      productId: line.productId,
      newPurchasePrice: roundHalfUpToTwoDecimals(line.netUnitCost),
    });
  }
  return updates;
}
