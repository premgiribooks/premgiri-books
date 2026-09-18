import type {
  PurchaseReturn as PrismaPurchaseReturn,
  PurchaseReturnItem as PrismaPurchaseReturnItem,
} from "@prisma/client";

import type { PaymentModeOption } from "@/types/payment-mode";

export type { PurchaseReturnStatus, RefundMode } from "@prisma/client";

type PurchaseReturnItemDecimalField = "quantity" | "taxableAmount" | "cgst" | "sgst" | "igst" | "cess" | "totalAmount";

// Decimal -> number normalization at the repository boundary — the
// src/types/purchase-invoice.ts convention.
export interface PurchaseReturnItem
  extends Omit<PrismaPurchaseReturnItem, PurchaseReturnItemDecimalField>,
    Record<PurchaseReturnItemDecimalField, number> {}

type PurchaseReturnDecimalField = "taxableAmount" | "totalCgst" | "totalSgst" | "totalIgst" | "totalCess" | "grandTotal";

export interface PurchaseReturn
  extends Omit<PrismaPurchaseReturn, PurchaseReturnDecimalField>,
    Record<PurchaseReturnDecimalField, number> {}

/** The slice of the source PurchaseInvoiceItem a return line's read-model
 * needs for display — product/warehouse names, never a re-enterable price.
 * Mirrors SalesReturnInvoiceItemSnapshot. */
export interface PurchaseReturnInvoiceItemSnapshot {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
}

export interface PurchaseReturnItemDetail extends PurchaseReturnItem {
  purchaseInvoiceItem: PurchaseReturnInvoiceItemSnapshot;
}

export interface PurchaseReturnInvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  supplierId: string;
  supplierName: string;
}

export interface PurchaseReturnRefundLedgerSnapshot {
  id: string;
  name: string;
}

export interface PurchaseReturnPaymentModeSnapshot {
  id: string;
  name: string;
}

export interface PurchaseReturnDetail extends PurchaseReturn {
  purchaseInvoice: PurchaseReturnInvoiceSnapshot;
  refundLedger: PurchaseReturnRefundLedgerSnapshot | null;
  paymentMode: PurchaseReturnPaymentModeSnapshot | null;
  items: PurchaseReturnItemDetail[];
}

export interface PurchaseReturnListRow extends PurchaseReturn {
  purchaseInvoice: PurchaseReturnInvoiceSnapshot;
}

export type PurchaseReturnStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface PurchaseReturnListFilters {
  search?: string;
  status?: PurchaseReturnStatusFilter;
  fromDate?: Date;
  toDate?: Date;
}

/** One returnable line of a POSTED Purchase Invoice — the create form's line
 * editor reads from this. `returnableQuantity` is server-computed
 * (originalQuantity minus the sum of prior POSTED PurchaseReturnItems against
 * this same invoice item, excluding DRAFT/CANCELLED returns entirely). */
export interface ReturnablePurchaseInvoiceLine {
  purchaseInvoiceItemId: string;
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
  unitSymbol: string;
  unitDecimalPlaces: number;
  originalQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
}

/** The "New Purchase Return" invoice-picker + line-editor lookup — the read
 * model `getReturnableInvoice` returns once a POSTED invoice is selected. */
export interface ReturnablePurchaseInvoiceDetail {
  purchaseInvoiceId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  supplierId: string;
  supplierName: string;
  lines: ReturnablePurchaseInvoiceLine[];
}

/** The posted-invoice picker's search-result rows for "New Purchase Return". */
export interface ReturnablePurchaseInvoiceOption {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  supplierName: string;
}

/** `ledgerClass` (92-payment-mode-integration-purchase.md) is this ledger's
 * three-way classification against the Payment Mode master — lets the form
 * auto-select the closest-matching active Payment Mode when the refund
 * ledger changes, without a server round trip (mirrors
 * SalesReturnRefundLedgerOption). */
export interface PurchaseReturnRefundLedgerOption {
  id: string;
  name: string;
  groupName: string;
  ledgerClass: "CASH" | "BANK" | "NEITHER";
}

/** Everything the Purchase Return Form needs beyond the picked invoice's own
 * returnable-lines lookup — mirrors PurchaseInvoiceFormOptions/
 * SalesReturnFormOptions. No "next number" preview: `returnNumber` is only
 * assigned at posting (45-purchase-return.md's Decisions), so a draft-time
 * preview would be misleading with multiple concurrent drafts in flight. */
export interface PurchaseReturnFormOptions {
  refundLedgers: PurchaseReturnRefundLedgerOption[];
  paymentModes: PaymentModeOption[];
  isLedgerMappingComplete: boolean;
}

export interface PurchaseReturnTotals {
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}
