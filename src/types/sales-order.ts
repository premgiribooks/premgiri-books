import type { SalesOrder as PrismaSalesOrder, SalesOrderItem as PrismaSalesOrderItem } from "@prisma/client";

import type { PriceSource } from "@/engines/pricing/types";
import type { DocumentGroupResult } from "@/engines/gst/types";

export type { SalesOrderStatus } from "@prisma/client";

type SalesOrderItemDecimalField =
  | "quantity"
  | "deliveredQuantity"
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

type SalesOrderDecimalField =
  | "subtotal"
  | "totalDiscount"
  | "taxableAmount"
  | "totalCgst"
  | "totalSgst"
  | "totalIgst"
  | "totalCess"
  | "grandTotal";

// Decimal -> number normalization at the repository boundary — the
// src/types/quotation.ts convention, extended here identically.
export interface SalesOrderItem
  extends Omit<PrismaSalesOrderItem, SalesOrderItemDecimalField>,
    Record<SalesOrderItemDecimalField, number> {}

export interface SalesOrder
  extends Omit<PrismaSalesOrder, SalesOrderDecimalField>,
    Record<SalesOrderDecimalField, number> {}

/** The slice of Product a sales order line's read-model needs to display —
 * mirrors QuotationProductSnapshot. */
export interface SalesOrderProductSnapshot {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
}

export interface SalesOrderItemDetail extends SalesOrderItem {
  product: SalesOrderProductSnapshot;
}

/** The slice of Customer a sales order's read-model needs — mirrors
 * QuotationCustomerOption. */
export interface SalesOrderCustomerOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface SalesOrderListRow extends SalesOrder {
  customer: SalesOrderCustomerOption;
  /** "3/5 lines delivered" — a line counts as delivered once its
   * `deliveredQuantity` reaches its `quantity`. Computed in the repository
   * from a narrow items select, not the full item detail (findMany stays
   * cheap for the list screen). */
  deliveredLineCount: number;
  totalLineCount: number;
}

export interface SalesOrderDetail extends SalesOrder {
  customer: SalesOrderCustomerOption;
  items: SalesOrderItemDetail[];
}

export type SalesOrderStatusFilter =
  | "DRAFT"
  | "CONFIRMED"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

export interface SalesOrderListFilters {
  search?: string;
  status?: SalesOrderStatusFilter;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** The product picker's options — mirrors QuotationProductOption exactly
 * (see sales-order-repository.ts's findOrderableProducts). */
export interface SalesOrderProductOption {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
  hsnCode: string | null;
  hasGstRate: boolean;
  ratePercent: number;
  cessPercent: number;
  sellingPrice: number | null;
  purchasePrice: number | null;
}

/** Everything the Sales Order Form needs to render its pickers and the "next
 * number" preview, loaded once up front. */
export interface SalesOrderFormOptions {
  customers: SalesOrderCustomerOption[];
  products: SalesOrderProductOption[];
  companyStateCode: string | null;
  nextOrderNumber: string;
}

/** A resolved-or-warned line, returned by the live-preview Server Action —
 * mirrors QuotationLineComputation. */
export interface SalesOrderLineComputation {
  lineNumber: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  isBelowCost: boolean;
  isHsnMissing: boolean;
  isGstRateMissing: boolean;
}

export interface SalesOrderTotals {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

/** The live-editing preview — mirrors QuotationPreview. */
export interface SalesOrderPreview {
  lines: SalesOrderLineComputation[];
  totals: SalesOrderTotals;
  groups: DocumentGroupResult[];
}

export interface ResolvedSalesOrderLinePrice {
  price: number | null;
  source: PriceSource;
  isBelowCost: boolean;
  purchaseCost: number | null;
}
