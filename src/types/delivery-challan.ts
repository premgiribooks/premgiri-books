import type {
  DeliveryChallan as PrismaDeliveryChallan,
  DeliveryChallanItem as PrismaDeliveryChallanItem,
} from "@prisma/client";

export type { DeliveryChallanStatus } from "@prisma/client";

// Decimal -> number normalization at the repository boundary — the
// src/types/sales-order.ts convention, extended here identically. Only
// `quantity` is Decimal on this document (37-delivery-challans.md: "No
// pricing or GST fields on this document").
export interface DeliveryChallanItem extends Omit<PrismaDeliveryChallanItem, "quantity"> {
  quantity: number;
}

export type DeliveryChallan = PrismaDeliveryChallan;

/** The slice of Product a delivery challan line's read-model needs to
 * display — mirrors SalesOrderProductSnapshot. */
export interface DeliveryChallanProductSnapshot {
  id: string;
  name: string;
  productCode: string | null;
  isActive: boolean;
}

export interface DeliveryChallanItemDetail extends DeliveryChallanItem {
  product: DeliveryChallanProductSnapshot;
}

/** The slice of Customer a delivery challan's read-model needs — mirrors
 * SalesOrderCustomerOption. */
export interface DeliveryChallanCustomerOption {
  id: string;
  name: string;
  isActive: boolean;
}

/** The slice of the linked Sales Order a delivery challan's read-model
 * needs for display (list "Linked Order" column, detail header). */
export interface DeliveryChallanSalesOrderSnapshot {
  id: string;
  orderNumber: string;
}

export interface DeliveryChallanListRow extends DeliveryChallan {
  customer: DeliveryChallanCustomerOption;
  salesOrder: DeliveryChallanSalesOrderSnapshot | null;
  lineCount: number;
}

export interface DeliveryChallanDetail extends DeliveryChallan {
  customer: DeliveryChallanCustomerOption;
  salesOrder: DeliveryChallanSalesOrderSnapshot | null;
  items: DeliveryChallanItemDetail[];
}

export type DeliveryChallanStatusFilter = "DRAFT" | "DISPATCHED" | "INVOICED" | "CANCELLED";

export interface DeliveryChallanListFilters {
  search?: string;
  status?: DeliveryChallanStatusFilter;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** The product picker's options — no pricing/GST columns needed, unlike
 * SalesOrderProductOption (this document records quantity and warehouse
 * only). */
export interface DeliveryChallanProductOption {
  id: string;
  name: string;
  productCode: string | null;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
}

/** Everything the Delivery Challan Form needs to render its pickers and the
 * "next number" preview, loaded once up front — mirrors
 * SalesOrderFormOptions. */
export interface DeliveryChallanFormOptions {
  customers: DeliveryChallanCustomerOption[];
  products: DeliveryChallanProductOption[];
  nextChallanNumber: string;
}

/**
 * One remaining (undelivered) line of an open Sales Order — the shape the
 * "New Delivery Challan" page pre-fills its lines from when navigated with
 * `?salesOrderId=`. Read-only lookup data, not a persisted entity; see
 * delivery-challan-service.ts's file comment for why this replaces a
 * dedicated `createFromSalesOrder` persist method.
 */
export interface OpenSalesOrderLineOption {
  salesOrderItemId: string;
  productId: string;
  productName: string;
  productCode: string | null;
  unitSymbol: string;
  unitDecimalPlaces: number;
  orderedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
}

/** The prefill payload for "New Delivery Challan" when reached from a Sales
 * Order's "Create Delivery Challan" action. */
export interface SalesOrderPrefill {
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  lines: OpenSalesOrderLineOption[];
}
