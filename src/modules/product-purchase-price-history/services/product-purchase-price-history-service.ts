import type { Prisma } from "@prisma/client";

import { resolveLatestPurchaseCostUpdates } from "@/engines/pricing/purchase-cost-sync";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { productPurchasePriceHistoryRepository } from "@/modules/product-purchase-price-history/repositories/product-purchase-price-history-repository";
import type {
  ProductPurchasePriceHistoryRow,
  SyncPurchasePriceFromDocumentInput,
} from "@/types/product-purchase-price-history";

// 95-purchase-price-sync.md. Purchase price history is product-master data
// (mirrors how Batches/HSN/GST-Rate management sit under `masters` rather
// than `inventory`/`purchase`) — the read path below is gated on it.
const MODULE = "masters";

/** 2-decimal-precision equality, matching Decimal(14,2) storage. */
function isSamePrice(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export const productPurchasePriceHistoryService = {
  /**
   * The single entry point both Purchase Invoice posting and Purchase Order
   * confirmation call. Requires a caller-supplied `tx` — this must never run
   * outside the source document's own posting/confirmation transaction, so a
   * failed posting rolls the price update and history row back with it.
   *
   * Performs NO permission assertion of its own: it is a system-driven side
   * effect of an already-authorized purchase posting (the caller already
   * ran its own `assertPermission(user, "purchase", ...)`). Gating this
   * again on `masters:edit` would break posting for Purchase-role users, who
   * by design hold `masters:view` only — a deliberate, recorded deviation
   * from the "every service method asserts a permission" norm.
   */
  async syncFromPurchaseDocument(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: SyncPurchasePriceFromDocumentInput
  ): Promise<void> {
    const updates = resolveLatestPurchaseCostUpdates(
      input.lines.map((line) => ({
        productId: line.productId,
        lineNumber: line.lineNumber,
        netUnitCost: line.netUnitCost,
      }))
    );
    if (updates.length === 0) {
      return;
    }

    const currentPrices = await productPurchasePriceHistoryRepository.findCurrentPurchasePrices(
      tx,
      companyId,
      updates.map((update) => update.productId)
    );

    for (const update of updates) {
      const oldPrice = currentPrices.get(update.productId);
      // Not found for this company (cross-company/stale reference) —
      // silently skip; a posting must never fail because of this feature.
      if (oldPrice === undefined) {
        continue;
      }
      // No-op guard: resolved value equals the current price already.
      if (oldPrice !== null && isSamePrice(oldPrice, update.newPurchasePrice)) {
        continue;
      }

      await productPurchasePriceHistoryRepository.applyPriceChange(tx, companyId, {
        productId: update.productId,
        oldPurchasePrice: oldPrice,
        newPurchasePrice: update.newPurchasePrice,
        sourceDocumentType: input.sourceDocumentType,
        sourceDocumentId: input.sourceDocumentId,
        sourceDocumentNumber: input.sourceDocumentNumber,
        sourceDocumentDate: input.sourceDocumentDate,
        changedByUserId: input.changedByUserId,
      });
    }
  },

  /** The Purchase Price History tab's read path — gated normally, unlike the write path above. */
  async listHistoryForProduct(productId: string): Promise<ProductPurchasePriceHistoryRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");
    return productPurchasePriceHistoryRepository.listHistoryForProduct(user.companyId, productId);
  },
};
