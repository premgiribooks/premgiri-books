import type {
  CustomerMode,
  SalesInvoice as PrismaSalesInvoice,
  SalesInvoiceItem as PrismaSalesInvoiceItem,
  SalesInvoicePayment as PrismaSalesInvoicePayment,
} from "@prisma/client";

import type { PriceSource } from "@/engines/pricing/types";
import type { DocumentGroupResult } from "@/engines/gst/types";
import type { PaymentModeOption } from "@/types/payment-mode";

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
 * SalesOrderProductSnapshot, extended with `hsnCode`/`unitSymbol` for the
 * printed PDF's standard tax-invoice item table (a Tax Invoice must show
 * each line's HSN/SAC code and unit, per GST invoicing convention). */
export interface SalesInvoiceProductSnapshot {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
  hsnCode: string | null;
  unitSymbol: string;
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
  paymentMode: { id: string; name: string };
}

/** The slice of Customer a sales invoice's read-model needs — null for
 * QUICK/WALK_IN invoices (no Customer row). `gstin`/address fields are
 * extended here (beyond what the Create/Edit form's own picker needs) for
 * the printed PDF's "Bill To" block — a permanent customer's own stored
 * GSTIN/address, mirroring the `quickCustomer*` fields already carried on
 * `SalesInvoiceDetail` for a QUICK/WALK_IN sale. */
export interface SalesInvoiceCustomerOption {
  id: string;
  name: string;
  isActive: boolean;
  creditLimit: number | null;
  /** The Customer's own 1:1 Ledger id — lets the Create/Edit form look up
   * this customer's current outstanding balance (voucherQueries.getLedgerBalance)
   * without a second customer-id-keyed lookup. */
  ledgerId: string;
  gstin: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
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
 * per this spec's "no new mapping needed for cash/bank" decision.
 * `ledgerClass` (91-payment-mode-integration-sales.md) is this ledger's
 * three-way classification against the Payment Mode master — lets the form
 * auto-select the closest-matching active Payment Mode when the ledger
 * changes, without a server round trip. */
export interface SalesInvoicePaymentLedgerOption {
  id: string;
  name: string;
  groupName: string;
  ledgerClass: "CASH" | "BANK" | "NEITHER";
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
  paymentModes: PaymentModeOption[];
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

// --- Sales Reports (68-sales-reports.md) — Item-wise and Party-wise
// aggregate queries, amended onto this module per that spec's own Service /
// Repository section. Both are always POSTED-only (no status override, unlike
// the Sales Register/Sales Return Summary views) and always scoped to the
// caller's own company + the active financial year — this module has no
// caller-selectable financial year anywhere else, so the report layer
// doesn't introduce one either (see sales-report-schema.ts's own note).

export interface ItemWiseSalesFilters {
  fromDate: Date;
  toDate: Date;
  productId?: string;
  warehouseId?: string;
  customerId?: string;
}

/** One product's summed figures across every matching POSTED invoice line —
 * `cgst`/`sgst`/`igst`/`cess` are kept separate here (already-stored, already-
 * summed values); combining them into a single "Total Tax" display figure is
 * the Reporting Engine's job (src/engines/reporting/sales-reports.ts), never
 * this repository's. */
export interface ItemWiseSalesAggregateRow {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  /** Count of DISTINCT invoices this product appeared on within the filter —
   * never a raw line-row count, which would over-count a product billed
   * twice on the same invoice. */
  invoiceCount: number;
}

export interface PartyWiseSalesFilters {
  fromDate: Date;
  toDate: Date;
}

/** One customer-or-synthetic-bucket's summed figures across every matching
 * POSTED invoice. `customerName` is resolved here only for a real Customer
 * (non-null `customerId`) — the two synthetic buckets' own display labels
 * ("Walk-in Sales" / "Quick Customer Sales (unconverted)") are assigned by
 * the Reporting Engine, not this repository. */
export interface PartyWiseSalesAggregateRow {
  customerId: string | null;
  customerMode: CustomerMode;
  customerName: string | null;
  invoiceCount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  grandTotal: number;
}
