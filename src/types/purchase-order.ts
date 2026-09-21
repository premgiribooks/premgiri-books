import type { PurchaseOrder as PrismaPurchaseOrder, PurchaseOrderItem as PrismaPurchaseOrderItem } from "@prisma/client";

import type { DocumentGroupResult } from "@/engines/gst/types";

export type { PurchaseOrderStatus } from "@prisma/client";

type PurchaseOrderItemDecimalField =
  | "quantity"
  | "receivedQuantity"
  | "rate"
  | "discountPercent"
  | "discountAmount"
  | "ratePercent"
  | "cessPercent"
  | "taxableAmount"
  | "cgst"
  | "sgst"
  | "igst"
  | "cess"
  | "totalAmount";

type PurchaseOrderDecimalField =
  | "subtotal"
  | "totalDiscount"
  | "taxableAmount"
  | "totalCgst"
  | "totalSgst"
  | "totalIgst"
  | "totalCess"
  | "grandTotal";

// Decimal -> number normalization at the repository boundary — the
// src/types/sales-order.ts convention, extended here identically.
export interface PurchaseOrderItem
  extends Omit<PrismaPurchaseOrderItem, PurchaseOrderItemDecimalField>,
    Record<PurchaseOrderItemDecimalField, number> {}

export interface PurchaseOrder
  extends Omit<PrismaPurchaseOrder, PurchaseOrderDecimalField>,
    Record<PurchaseOrderDecimalField, number> {}

/** The slice of Product a purchase order line's read-model needs to display —
 * mirrors SalesOrderProductSnapshot. */
export interface PurchaseOrderProductSnapshot {
  id: string;
  name: string;
  productCode: string | null;
  isActive: boolean;
}

export interface PurchaseOrderItemDetail extends PurchaseOrderItem {
  product: PurchaseOrderProductSnapshot;
}

/** The slice of Supplier a purchase order's read-model needs — mirrors
 * SalesOrderCustomerOption. */
export interface PurchaseOrderSupplierOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PurchaseOrderListRow extends PurchaseOrder {
  supplier: PurchaseOrderSupplierOption;
  /** "3/5 lines received" — a line counts as received once its
   * `receivedQuantity` reaches its `quantity`. Computed in the repository
   * from a narrow items select, not the full item detail (findMany stays
   * cheap for the list screen). */
  receivedLineCount: number;
  totalLineCount: number;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  supplier: PurchaseOrderSupplierOption;
  items: PurchaseOrderItemDetail[];
}

export type PurchaseOrderStatusFilter =
  | "DRAFT"
  | "CONFIRMED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED";

export interface PurchaseOrderListFilters {
  search?: string;
  status?: PurchaseOrderStatusFilter;
  supplierId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** The product picker's options — mirrors SalesOrderProductOption, minus the
 * selling-price dimension this spec never reads: `rate` prefills from
 * `purchasePrice` (the cost basis), never from `resolvePrice`. */
export interface PurchaseOrderProductOption {
  id: string;
  name: string;
  productCode: string | null;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
  hsnCode: string | null;
  hasGstRate: boolean;
  ratePercent: number;
  cessPercent: number;
  purchasePrice: number | null;
}

/** Everything the Purchase Order Form needs to render its pickers and the
 * "next number" preview, loaded once up front. */
export interface PurchaseOrderFormOptions {
  suppliers: PurchaseOrderSupplierOption[];
  products: PurchaseOrderProductOption[];
  companyStateCode: string | null;
  nextOrderNumber: string;
}

/** A resolved-or-warned line, returned by the live-preview Server Action —
 * mirrors SalesOrderLineComputation, minus `isBelowCost` (a selling-side-only
 * concept per code-standards.md's Pricing Rules — no below-cost check
 * applies to what the company itself pays). */
export interface PurchaseOrderLineComputation {
  lineNumber: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  isHsnMissing: boolean;
  isGstRateMissing: boolean;
}

export interface PurchaseOrderTotals {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

/** The live-editing preview — mirrors SalesOrderPreview. */
export interface PurchaseOrderPreview {
  lines: PurchaseOrderLineComputation[];
  totals: PurchaseOrderTotals;
  groups: DocumentGroupResult[];
}
