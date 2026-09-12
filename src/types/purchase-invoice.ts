import type {
  PurchaseInvoice as PrismaPurchaseInvoice,
  PurchaseInvoiceItem as PrismaPurchaseInvoiceItem,
  PurchaseInvoicePayment as PrismaPurchaseInvoicePayment,
} from "@prisma/client";

import type { DocumentGroupResult } from "@/engines/gst/types";

export type { PurchaseInvoiceStatus } from "@prisma/client";

type PurchaseInvoiceItemDecimalField =
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

type PurchaseInvoiceItemNullableDecimalField =
  | "overriddenCgst"
  | "overriddenSgst"
  | "overriddenIgst"
  | "overriddenCess";

// Decimal -> number normalization at the repository boundary — the
// src/types/sales-invoice.ts convention, extended here identically.
export interface PurchaseInvoiceItem
  extends Omit<PrismaPurchaseInvoiceItem, PurchaseInvoiceItemDecimalField | PurchaseInvoiceItemNullableDecimalField>,
    Record<PurchaseInvoiceItemDecimalField, number>,
    Record<PurchaseInvoiceItemNullableDecimalField, number | null> {}

type PurchaseInvoiceDecimalField =
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

export interface PurchaseInvoice
  extends Omit<PrismaPurchaseInvoice, PurchaseInvoiceDecimalField>,
    Record<PurchaseInvoiceDecimalField, number> {}

export interface PurchaseInvoicePayment extends Omit<PrismaPurchaseInvoicePayment, "amount"> {
  amount: number;
}

/** The slice of Product a purchase invoice line's read-model needs — mirrors
 * SalesInvoiceProductSnapshot. */
export interface PurchaseInvoiceProductSnapshot {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
}

/** The slice of Warehouse a purchase invoice line's read-model needs. */
export interface PurchaseInvoiceWarehouseSnapshot {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface PurchaseInvoiceItemDetail extends PurchaseInvoiceItem {
  product: PurchaseInvoiceProductSnapshot;
  warehouse: PurchaseInvoiceWarehouseSnapshot;
}

export interface PurchaseInvoicePaymentDetail extends PurchaseInvoicePayment {
  ledger: { id: string; name: string };
}

/** The slice of Supplier a purchase invoice's read-model needs — every
 * Purchase Invoice has one (no Quick/Walk-in equivalent, spec 44). */
export interface PurchaseInvoiceSupplierOption {
  id: string;
  name: string;
  isActive: boolean;
  creditDays: number | null;
}

export interface PurchaseInvoicePurchaseOrderSnapshot {
  id: string;
  orderNumber: string;
}

export interface PurchaseInvoiceGoodsReceiptNoteSnapshot {
  id: string;
  grnNumber: string;
}

export interface PurchaseInvoiceListRow extends PurchaseInvoice {
  supplier: PurchaseInvoiceSupplierOption;
  purchaseOrder: PurchaseInvoicePurchaseOrderSnapshot | null;
  goodsReceiptNote: PurchaseInvoiceGoodsReceiptNoteSnapshot | null;
}

export interface PurchaseInvoiceDetail extends PurchaseInvoice {
  supplier: PurchaseInvoiceSupplierOption;
  purchaseOrder: PurchaseInvoicePurchaseOrderSnapshot | null;
  goodsReceiptNote: PurchaseInvoiceGoodsReceiptNoteSnapshot | null;
  items: PurchaseInvoiceItemDetail[];
  payments: PurchaseInvoicePaymentDetail[];
}

export type PurchaseInvoiceStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface PurchaseInvoiceListFilters {
  search?: string;
  status?: PurchaseInvoiceStatusFilter;
  supplierId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** The product picker's options — mirrors PurchaseOrderProductOption, plus
 * `hsnCode`/`hasGstRate` (this document enforces the HSN hard block Purchase
 * Order never did). */
export interface PurchaseInvoiceProductOption {
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
  purchasePrice: number | null;
}

export interface PurchaseInvoiceWarehouseOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/** The payment line's ledger picker options — restricted, server-side, to
 * the Cash-in-Hand group or a BankAccount-linked ledger (44-purchase-invoice.md's
 * Ledger Posting rule) — stricter than Sales Invoice's "any active ledger". */
export interface PurchaseInvoicePaymentLedgerOption {
  id: string;
  name: string;
  groupName: string;
}

/** Everything the Purchase Invoice Form needs to render its pickers and the
 * "next number" preview, loaded once up front — mirrors
 * SalesInvoiceFormOptions. `isLedgerMappingComplete` drives a form-level
 * warning banner when posting would be blocked for a missing mapping (the
 * authoritative active/group check still runs server-side at posting time). */
export interface PurchaseInvoiceFormOptions {
  suppliers: PurchaseInvoiceSupplierOption[];
  products: PurchaseInvoiceProductOption[];
  warehouses: PurchaseInvoiceWarehouseOption[];
  paymentLedgers: PurchaseInvoicePaymentLedgerOption[];
  companyStateCode: string | null;
  nextInvoiceNumber: string;
  isLedgerMappingComplete: boolean;
}

/** A resolved-or-warned line, returned by the live-preview Server Action —
 * mirrors SalesInvoiceLineComputation, minus `isBelowCost` (a selling-side-only
 * concept, not applicable to what the company pays). */
export interface PurchaseInvoiceLineComputation {
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

export interface PurchaseInvoiceTotals {
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

/** The live-editing preview — mirrors SalesInvoicePreview. */
export interface PurchaseInvoicePreview {
  lines: PurchaseInvoiceLineComputation[];
  totals: PurchaseInvoiceTotals;
  groups: DocumentGroupResult[];
}

/**
 * One line of a `RECEIVED`, not-yet-invoiced Goods Receipt Note — the shape
 * "New Purchase Invoice" pre-fills its lines from when navigated with
 * `?goodsReceiptNoteId=`. Read-only lookup data, mirrors
 * DeliveryChallanInvoiceLineOption's role in the Sales Invoice module.
 */
export interface GoodsReceiptNoteInvoiceLineOption {
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unitSymbol: string;
  unitDecimalPlaces: number;
}

/** The prefill payload for "New Purchase Invoice" when reached from a Goods
 * Receipt Note's "Create Invoice" action. */
export interface GoodsReceiptNotePrefill {
  goodsReceiptNoteId: string;
  grnNumber: string;
  supplierId: string;
  purchaseOrderId: string | null;
  lines: GoodsReceiptNoteInvoiceLineOption[];
}

// --- Purchase Reports (69-purchase-reports.md) — Item-wise and Party-wise
// aggregate queries, amended onto this module per that spec's own Service /
// Repository section. Mirrors src/types/sales-invoice.ts's identical
// addition for 68-sales-reports.md. Both are always POSTED-only (no status
// override, unlike the Purchase Register) and always scoped to the caller's
// own company + the active financial year.

export interface ItemWisePurchaseFilters {
  fromDate: Date;
  toDate: Date;
  productId?: string;
  warehouseId?: string;
  supplierId?: string;
}

/** One product's summed figures across every matching POSTED invoice line —
 * `cgst`/`sgst`/`igst`/`cess` are kept separate here (already-stored,
 * already-summed values); combining them into a single "Total Tax" display
 * figure is the Reporting Engine's job (src/engines/reporting/
 * purchase-reports.ts), never this repository's. */
export interface ItemWisePurchaseAggregateRow {
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

export interface PartyWisePurchaseFilters {
  fromDate: Date;
  toDate: Date;
}

/** One supplier's summed figures across every matching POSTED invoice. Unlike
 * `PartyWiseSalesAggregateRow`, `supplierId` is never null — every Purchase
 * Invoice has a required `supplierId` (no Quick/Walk-in equivalent, spec 44),
 * so no synthetic-bucket handling is needed here. */
export interface PartyWisePurchaseAggregateRow {
  supplierId: string;
  supplierName: string;
  invoiceCount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  grandTotal: number;
}
