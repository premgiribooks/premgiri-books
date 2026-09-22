import type { PurchasePriceSourceType } from "@prisma/client";

// 95-purchase-price-sync.md. Decimal columns (oldPurchasePrice/newPurchasePrice)
// are normalized to `number` at the repository boundary, mirroring every
// other module in this codebase (e.g. types/product.ts).
export interface ProductPurchasePriceHistoryRow {
  id: string;
  productId: string;
  oldPurchasePrice: number | null;
  newPurchasePrice: number;
  sourceDocumentType: PurchasePriceSourceType;
  sourceDocumentId: string;
  sourceDocumentNumber: string | null;
  sourceDocumentDate: Date;
  changedByUserId: string | null;
  changedByUserName: string | null;
  createdAt: Date;
}

/**
 * One resolved product-level cost change to persist, handed by
 * `syncFromPurchaseDocument`'s caller (the posting flow) after the pure
 * engine (`purchase-cost-sync.ts`) has already picked the winning line per
 * product. `oldPurchasePrice` is read by the repository itself inside the
 * same transaction, not supplied here.
 */
export interface PurchaseCostSyncLine {
  productId: string;
  lineNumber: number;
  /** Net-of-discount effective unit cost for this line (taxableAmount / quantity). */
  netUnitCost: number;
}

export interface SyncPurchasePriceFromDocumentInput {
  lines: readonly PurchaseCostSyncLine[];
  sourceDocumentType: PurchasePriceSourceType;
  sourceDocumentId: string;
  sourceDocumentNumber: string | null;
  sourceDocumentDate: Date;
  changedByUserId: string | null;
}
