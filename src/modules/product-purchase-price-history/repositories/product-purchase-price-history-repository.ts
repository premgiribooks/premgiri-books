import type { Prisma, PurchasePriceSourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ProductPurchasePriceHistoryRow } from "@/types/product-purchase-price-history";

// 95-purchase-price-sync.md. All writes here run inside a caller-supplied
// `tx` (the source document's own posting/confirmation transaction) — this
// repository never opens its own transaction, per the spec's "must never
// run outside a caller's transaction" rule for the write path.

export interface ApplyPriceChangeInput {
  productId: string;
  oldPurchasePrice: number | null;
  newPurchasePrice: number;
  sourceDocumentType: PurchasePriceSourceType;
  sourceDocumentId: string;
  sourceDocumentNumber: string | null;
  sourceDocumentDate: Date;
  changedByUserId: string | null;
}

function toRow(
  raw: {
    id: string;
    productId: string;
    oldPurchasePrice: Prisma.Decimal | null;
    newPurchasePrice: Prisma.Decimal;
    sourceDocumentType: PurchasePriceSourceType;
    sourceDocumentId: string;
    sourceDocumentNumber: string | null;
    sourceDocumentDate: Date;
    changedByUserId: string | null;
    changedBy: { fullName: string } | null;
    createdAt: Date;
  }
): ProductPurchasePriceHistoryRow {
  return {
    id: raw.id,
    productId: raw.productId,
    oldPurchasePrice: raw.oldPurchasePrice?.toNumber() ?? null,
    newPurchasePrice: raw.newPurchasePrice.toNumber(),
    sourceDocumentType: raw.sourceDocumentType,
    sourceDocumentId: raw.sourceDocumentId,
    sourceDocumentNumber: raw.sourceDocumentNumber,
    sourceDocumentDate: raw.sourceDocumentDate,
    changedByUserId: raw.changedByUserId,
    changedByUserName: raw.changedBy?.fullName ?? null,
    createdAt: raw.createdAt,
  };
}

export const productPurchasePriceHistoryRepository = {
  /** Current `purchasePrice` per product, scoped to the tenant — the "old value" source for the no-op guard and the history row, read on the caller's own `tx` so it sees the same snapshot the write will act on. */
  async findCurrentPurchasePrices(
    tx: Prisma.TransactionClient,
    companyId: string,
    productIds: readonly string[]
  ): Promise<Map<string, number | null>> {
    if (productIds.length === 0) {
      return new Map();
    }
    const products = await tx.product.findMany({
      where: { id: { in: [...productIds] }, companyId },
      select: { id: true, purchasePrice: true },
    });
    return new Map(products.map((product) => [product.id, product.purchasePrice?.toNumber() ?? null]));
  },

  /**
   * Updates `Product.purchasePrice` and inserts the matching history row for
   * one product, both on the caller's `tx` — the atomicity guarantee this
   * feature exists for. A `productId` that does not belong to `companyId` is
   * silently skipped (defensive; a posting must never fail because of this
   * feature — 95-purchase-price-sync.md §1.6.4).
   */
  async applyPriceChange(tx: Prisma.TransactionClient, companyId: string, input: ApplyPriceChangeInput): Promise<void> {
    const result = await tx.product.updateMany({
      where: { id: input.productId, companyId },
      data: { purchasePrice: input.newPurchasePrice },
    });
    if (result.count === 0) {
      return;
    }

    await tx.productPurchasePriceHistory.create({
      data: {
        companyId,
        productId: input.productId,
        oldPurchasePrice: input.oldPurchasePrice,
        newPurchasePrice: input.newPurchasePrice,
        sourceDocumentType: input.sourceDocumentType,
        sourceDocumentId: input.sourceDocumentId,
        sourceDocumentNumber: input.sourceDocumentNumber,
        sourceDocumentDate: input.sourceDocumentDate,
        changedByUserId: input.changedByUserId,
      },
    });
  },

  /** The Purchase Price History tab's data source — newest first. */
  async listHistoryForProduct(companyId: string, productId: string): Promise<ProductPurchasePriceHistoryRow[]> {
    const rows = await prisma.productPurchasePriceHistory.findMany({
      where: { companyId, productId },
      orderBy: { createdAt: "desc" },
      include: { changedBy: { select: { fullName: true } } },
    });
    return rows.map(toRow);
  },
};
