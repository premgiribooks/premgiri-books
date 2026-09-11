import type {
  PhysicalVerification as PrismaPhysicalVerification,
  PhysicalVerificationItem as PrismaPhysicalVerificationItem,
} from "@prisma/client";

export type { PhysicalVerificationStatus } from "@prisma/client";

type PhysicalVerificationItemDecimalField = "systemQuantity" | "countedQuantity" | "varianceQuantity";

// Decimal -> number normalization at the repository boundary — the
// src/types/stock-adjustment.ts convention.
export interface PhysicalVerificationItem
  extends Omit<PrismaPhysicalVerificationItem, PhysicalVerificationItemDecimalField>,
    Record<PhysicalVerificationItemDecimalField, number> {}

// No Decimal fields on the header itself — a plain alias, like StockAdjustment/StockTransfer.
export type PhysicalVerification = PrismaPhysicalVerification;

/** A line's read-model needs its product display fields — mirrors
 * StockAdjustmentItemDetail's/StockTransferItemDetail's identical
 * flattening, directly on the item since PhysicalVerificationItem
 * references Product itself (no source document to snapshot through). */
export interface PhysicalVerificationItemDetail extends PhysicalVerificationItem {
  productName: string;
  productCode: string;
  unitSymbol: string;
  unitDecimalPlaces: number;
}

export interface PhysicalVerificationDetail extends PhysicalVerification {
  warehouseName: string;
  items: PhysicalVerificationItemDetail[];
}

export interface PhysicalVerificationListRow extends PhysicalVerification {
  warehouseName: string;
  lineCount: number;
}

export type PhysicalVerificationStatusFilter = "DRAFT" | "COMPLETED" | "CANCELLED";

export interface PhysicalVerificationListFilters {
  search?: string;
  status?: PhysicalVerificationStatusFilter;
  warehouseId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface PhysicalVerificationProductOption {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
  defaultWarehouseId: string | null;
}

export interface PhysicalVerificationWarehouseOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/** Everything the Physical Verification Form needs — mirrors
 * StockTransferFormOptions's `nextTransferNumber` preview (advisory only;
 * the completed number is whatever `generateNumber` returns inside the
 * completing transaction). The live system-quantity preview per line is
 * fetched separately, per selected warehouse (see
 * getWarehouseStockPreviewAction) — not part of this static option set. */
export interface PhysicalVerificationFormOptions {
  products: PhysicalVerificationProductOption[];
  warehouses: PhysicalVerificationWarehouseOption[];
  nextVerificationNumber: string;
}
