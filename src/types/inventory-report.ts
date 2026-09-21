import type { StockDirection, StockTransactionType } from "@prisma/client";

// 70-inventory-reports.md — the four Inventory Reports view-models, produced
// by src/engines/reporting/inventory-reports.ts. No new Prisma model
// anywhere in this file — every figure is read directly from
// inventoryEngine's own getCurrentStock/getStockLedger/getStockValuation
// output, or is a plain display-composition join against Product/Warehouse
// master data (never a re-derivation of stock quantity).

/**
 * A TRADING product's display fields for this module's own reports — fetched
 * directly from Prisma in inventory-report-service.ts rather than through
 * `productService.listSelectableProducts()` (the spec's own literal
 * suggestion): the seeded Accountant role has `reports:view` but not
 * `masters:view` (the same permission-mismatch precedent
 * purchase-report-service.ts's own listProductOptions/listWarehouseOptions
 * already established for this batch of reports), so routing this read
 * through that masters-gated service would 403 exactly the role this module
 * exists to serve. `isActive` is carried so a report can still resolve a
 * name for a since-deactivated product's historical stock movement while
 * excluding it from any "every active product" listing (the zero-stock/
 * low-stock unions below).
 */
export interface InventoryReportProductOption {
  id: string;
  name: string;
  productCode: string | null;
  unitName: string;
  isActive: boolean;
  /** `Product.minStockLevel`, already Decimal->number converted; null when unset. */
  minStockLevel: number | null;
}

export interface InventoryReportWarehouseOption {
  id: string;
  name: string;
}

export interface CurrentStockReportRow {
  productId: string;
  productName: string;
  productCode: string | null;
  unitName: string;
  /** Null only for a synthetic zero-stock row added with no warehouse filter applied (never moved, so no warehouse to attribute it to). */
  warehouseId: string | null;
  warehouseName: string | null;
  quantity: number;
}

export interface CurrentStockReport {
  rows: CurrentStockReportRow[];
}

export interface StockLedgerReportLine {
  id: string;
  transactionType: StockTransactionType;
  direction: StockDirection;
  quantity: number;
  unitCost: number | null;
  transactionDate: Date;
  warehouseId: string;
  warehouseName: string | null;
  /** Business Rules #2's resolved label — a known document reference resolves to "<Friendly Name> #<document number>"; an unrecognized-but-present referenceType falls back to that raw string; a null referenceType (Opening Stock/Transfer) falls back to the humanized transactionType. */
  referenceLabel: string;
  narration: string | null;
  runningBalance: number;
}

export interface StockLedgerReport {
  productId: string;
  productName: string;
  lines: StockLedgerReportLine[];
  closingBalance: number;
}

export interface StockValuationReportRow {
  productId: string;
  productName: string;
  productCode: string | null;
  quantity: number;
  /** `product.purchasePrice`, or 0 when unset (see `isUnvalued`) — copied verbatim from `getStockValuation`. */
  unitCost: number;
  value: number;
  /** True when `product.purchasePrice` is null — flagged so the UI never shows a silent ₹0 valuation as if it were legitimate. */
  isUnvalued: boolean;
}

export interface StockValuationReport {
  rows: StockValuationReportRow[];
  /** Copied verbatim from `getStockValuation`'s own total — every unvalued row already contributes exactly 0 to it (unitCost 0), so no separate exclusion logic is needed. */
  totalValue: number;
}

export interface LowStockReportRow {
  productId: string;
  productName: string;
  productCode: string | null;
  /** Null only for a synthetic zero-stock row (see CurrentStockReportRow's identical note). */
  warehouseId: string | null;
  warehouseName: string | null;
  currentStock: number;
  minStockLevel: number;
  /** `minStockLevel - currentStock`, always positive (rows are pre-filtered to currentStock < minStockLevel). */
  shortfall: number;
}

export interface LowStockReport {
  rows: LowStockReportRow[];
}
