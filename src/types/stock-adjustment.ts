import type { StockAdjustment as PrismaStockAdjustment, StockAdjustmentItem as PrismaStockAdjustmentItem } from "@prisma/client";

export type { StockAdjustmentStatus, StockDirection } from "@prisma/client";

type StockAdjustmentItemDecimalField = "quantity";

// Decimal -> number normalization at the repository boundary — the
// src/types/purchase-invoice.ts convention.
export interface StockAdjustmentItem
  extends Omit<PrismaStockAdjustmentItem, StockAdjustmentItemDecimalField>,
    Record<StockAdjustmentItemDecimalField, number> {}

// No Decimal fields on the header itself (only StockAdjustmentItem.quantity
// is Decimal) — a plain alias, not an Omit/Record normalization pair.
export type StockAdjustment = PrismaStockAdjustment;

/** A line's read-model needs its product/warehouse display fields — mirrors
 * PurchaseReturnInvoiceItemSnapshot's flattening, but directly on the item
 * since StockAdjustmentItem references Product/Warehouse itself (no source
 * document to snapshot through). */
export interface StockAdjustmentItemDetail extends StockAdjustmentItem {
  productName: string;
  productCode: string | null;
  warehouseName: string;
  unitSymbol: string;
  unitDecimalPlaces: number;
}

export interface StockAdjustmentDetail extends StockAdjustment {
  items: StockAdjustmentItemDetail[];
}

export interface StockAdjustmentListRow extends StockAdjustment {
  lineCount: number;
}

export type StockAdjustmentStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface StockAdjustmentListFilters {
  search?: string;
  status?: StockAdjustmentStatusFilter;
  fromDate?: Date;
  toDate?: Date;
}

export interface StockAdjustmentProductOption {
  id: string;
  name: string;
  productCode: string | null;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
  defaultWarehouseId: string | null;
}

export interface StockAdjustmentWarehouseOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/** Everything the Stock Adjustment Form needs — mirrors
 * PurchaseInvoiceFormOptions's `nextInvoiceNumber` preview (advisory only;
 * the posted number is whatever `generateNumber` returns inside the posting
 * transaction). */
export interface StockAdjustmentFormOptions {
  products: StockAdjustmentProductOption[];
  warehouses: StockAdjustmentWarehouseOption[];
  nextAdjustmentNumber: string;
}
