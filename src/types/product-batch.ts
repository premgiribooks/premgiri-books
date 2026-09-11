import type { ProductBatch as PrismaProductBatch } from "@prisma/client";

// ProductBatch has no Decimal columns — no repository-boundary normalization
// needed (unlike types/product.ts). Dates are plain `Date`, matching every
// other calendar-date field in this codebase.
export type ProductBatch = PrismaProductBatch;

/**
 * A batch row plus its derived current stock — `currentStock` is never a
 * stored column, always Sigma IN - Sigma OUT of StockTransaction rows scoped
 * to this batch (inventory-queries.ts's getBatchStock), computed at the
 * repository boundary (50-batch-tracking.md's "batch quantity is never
 * stored" invariant). `hasMovements` drives the UI's "disabled once moved"
 * rule and the service's immutability checks.
 */
export interface ProductBatchWithStock extends ProductBatch {
  currentStock: number;
  hasMovements: boolean;
}

export type ProductBatchStatusFilter = "all" | "active" | "inactive";

export interface ProductBatchListFilters {
  status?: ProductBatchStatusFilter;
}

/**
 * The `<BatchSelector>` read-model (50-batch-tracking.md's UI section) —
 * deliberately narrow, mirrors ProductMasterOption's convention: only what a
 * line editor's batch picker needs to render and validate a selection.
 */
export interface ProductBatchOption {
  id: string;
  batchNumber: string;
  expiryDate: Date | null;
  currentStock: number;
}

export type ActivateProductBatchResult =
  | { status: "not_found" }
  | { status: "ok"; batch: ProductBatchWithStock };

export type DeactivateProductBatchResult =
  | { status: "not_found" }
  | { status: "ok"; batch: ProductBatchWithStock };

export type UpdateProductBatchResult =
  | { status: "not_found" }
  | { status: "has_movements" }
  | { status: "ok"; batch: ProductBatchWithStock };
