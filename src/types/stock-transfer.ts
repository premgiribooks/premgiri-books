import type { StockTransfer as PrismaStockTransfer, StockTransferItem as PrismaStockTransferItem } from "@prisma/client";

export type { StockTransferStatus } from "@prisma/client";

type StockTransferItemDecimalField = "quantity";

// Decimal -> number normalization at the repository boundary — the
// src/types/stock-adjustment.ts convention.
export interface StockTransferItem
  extends Omit<PrismaStockTransferItem, StockTransferItemDecimalField>,
    Record<StockTransferItemDecimalField, number> {}

// No Decimal fields on the header itself — a plain alias, like StockAdjustment.
export type StockTransfer = PrismaStockTransfer;

/** A line's read-model needs its product display fields — mirrors
 * StockAdjustmentItemDetail's flattening, directly on the item since
 * StockTransferItem references Product itself (no source document to
 * snapshot through). */
export interface StockTransferItemDetail extends StockTransferItem {
  productName: string;
  productCode: string;
  unitSymbol: string;
  unitDecimalPlaces: number;
}

export interface StockTransferDetail extends StockTransfer {
  sourceWarehouseName: string;
  destinationWarehouseName: string;
  items: StockTransferItemDetail[];
}

export interface StockTransferListRow extends StockTransfer {
  sourceWarehouseName: string;
  destinationWarehouseName: string;
  lineCount: number;
}

export type StockTransferStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface StockTransferListFilters {
  search?: string;
  status?: StockTransferStatusFilter;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface StockTransferProductOption {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
  defaultWarehouseId: string | null;
}

export interface StockTransferWarehouseOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/** Everything the Stock Transfer Form needs — mirrors
 * StockAdjustmentFormOptions's `nextAdjustmentNumber` preview (advisory
 * only; the posted number is whatever `generateNumber` returns inside the
 * posting transaction). */
export interface StockTransferFormOptions {
  products: StockTransferProductOption[];
  warehouses: StockTransferWarehouseOption[];
  nextTransferNumber: string;
}
