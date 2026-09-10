import type {
  SalesInvoice as PrismaSalesInvoice,
  SalesInvoiceItem as PrismaSalesInvoiceItem,
  SalesInvoicePayment as PrismaSalesInvoicePayment,
} from "@prisma/client";

import type { PriceSource } from "@/engines/pricing/types";
import type { DocumentGroupResult } from "@/engines/gst/types";

export type { SalesInvoiceStatus, CustomerMode } from "@prisma/client";

type SalesInvoiceItemDecimalField =
  | "quantity"
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

type SalesInvoiceItemNullableDecimalField =
  | "overriddenCgst"
  | "overriddenSgst"
  | "overriddenIgst"
  | "overriddenCess";

// Decimal -> number normalization at the repository boundary — the
// src/types/sales-order.ts convention, extended here with a second group for
// the nullable overridden* columns (null stays null, never coerced to 0).
export interface SalesInvoiceItem
  extends Omit<PrismaSalesInvoiceItem, SalesInvoiceItemDecimalField | SalesInvoiceItemNullableDecimalField>,
    Record<SalesInvoiceItemDecimalField, number>,
    Record<SalesInvoiceItemNullableDecimalField, number | null> {}

type SalesInvoiceDecimalField =
  | "subtotal"
  | "totalDiscount"
  | "taxableAmount"
  | "totalCgst"
  | "totalSgst"
  | "totalIgst"
  | "totalCess"
  | "roundOff"
  | "grandTotal"
  | "amountPaid";

export interface SalesInvoice
  extends Omit<PrismaSalesInvoice, SalesInvoiceDecimalField>,
    Record<SalesInvoiceDecimalField, number> {}

export interface SalesInvoicePayment extends Omit<PrismaSalesInvoicePayment, "amount"> {
  amount: number;
}

/** The slice of Product a sales invoice line's read-model needs — mirrors
 * SalesOrderProductSnapshot. */
export interface SalesInvoiceProductSnapshot {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
}

/** The slice of Warehouse a sales invoice line's read-model needs. */
export interface SalesInvoiceWarehouseSnapshot {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface SalesInvoiceItemDetail extends SalesInvoiceItem {
  product: SalesInvoiceProductSnapshot;
  warehouse: SalesInvoiceWarehouseSnapshot;
}

export interface SalesInvoicePaymentDetail extends SalesInvoicePayment {
  ledger: { id: string; name: string };
}

/** The slice of Customer a sales invoice's read-model needs — null for
 * QUICK/WALK_IN invoices (no Customer row). */
export interface SalesInvoiceCustomerOption {
  id: string;
  name: string;
  isActive: boolean;
  creditLimit: number | null;
}

export interface SalesInvoiceSalesOrderSnapshot {
  id: string;
  orderNumber: string;
}

export interface SalesInvoiceDeliveryChallanSnapshot {
  id: string;
  challanNumber: string;
}

export interface SalesInvoiceListRow extends SalesInvoice {
  customer: SalesInvoiceCustomerOption | null;
  salesOrder: SalesInvoiceSalesOrderSnapshot | null;
  deliveryChallan: SalesInvoiceDeliveryChallanSnapshot | null;
}

export interface SalesInvoiceDetail extends SalesInvoice {
  customer: SalesInvoiceCustomerOption | null;
  salesOrder: SalesInvoiceSalesOrderSnapshot | null;
  deliveryChallan: SalesInvoiceDeliveryChallanSnapshot | null;
  items: SalesInvoiceItemDetail[];
  payments: SalesInvoicePaymentDetail[];
}

export type SalesInvoiceStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface SalesInvoiceListFilters {
  search?: string;
  status?: SalesInvoiceStatusFilter;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** The product picker's options — mirrors SalesOrderProductOption exactly
 * (pricing/GST prefill is still display-only here, same as specs 35–36). */
export interface SalesInvoiceProductOption {
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

export interface SalesInvoiceWarehouseOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/** The payment line's ledger picker options — any active company Ledger,
 * per this spec's "no new mapping needed for cash/bank" decision. */
export interface SalesInvoicePaymentLedgerOption {
  id: string;
  name: string;
  groupName: string;
}

/** Everything the Sales Invoice Form needs to render its pickers and the
 * "next number" preview, loaded once up front — mirrors
 * SalesOrderFormOptions. `isLedgerMappingComplete` drives a form-level
 * warning banner when posting would be blocked for a missing mapping (the
 * authoritative check still runs server-side at posting time). */
export interface SalesInvoiceFormOptions {
  customers: SalesInvoiceCustomerOption[];
  products: SalesInvoiceProductOption[];
  warehouses: SalesInvoiceWarehouseOption[];
  paymentLedgers: SalesInvoicePaymentLedgerOption[];
  companyStateCode: string | null;
  nextInvoiceNumber: string;
  isLedgerMappingComplete: boolean;
}

/** A resolved-or-warned line, returned by the live-preview Server Action —
 * mirrors SalesOrderLineComputation. */
export interface SalesInvoiceLineComputation {
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

export interface SalesInvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  roundOff: number;
  grandTotal: number;
}

/** The live-editing preview — mirrors SalesOrderPreview, plus `roundOff`
 * (this document's own addition). */
export interface SalesInvoicePreview {
  lines: SalesInvoiceLineComputation[];
  totals: SalesInvoiceTotals;
  groups: DocumentGroupResult[];
}

export interface ResolvedSalesInvoiceLinePrice {
  price: number | null;
  source: PriceSource;
  isBelowCost: boolean;
  purchaseCost: number | null;
}

/**
 * One line of a `DISPATCHED`, not-yet-invoiced Delivery Challan — the shape
 * "New Sales Invoice" pre-fills its lines from when navigated with
 * `?deliveryChallanId=`. Read-only lookup data, mirrors
 * OpenSalesOrderLineOption's role in the Delivery Challan module.
 */
export interface DeliveryChallanInvoiceLineOption {
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unitSymbol: string;
  unitDecimalPlaces: number;
}

/** The prefill payload for "New Sales Invoice" when reached from a Delivery
 * Challan's "Create Invoice" action. */
export interface DeliveryChallanPrefill {
  deliveryChallanId: string;
  challanNumber: string;
  customerId: string;
  salesOrderId: string | null;
  lines: DeliveryChallanInvoiceLineOption[];
}
