import type {
  SalesReturn as PrismaSalesReturn,
  SalesReturnItem as PrismaSalesReturnItem,
} from "@prisma/client";

export type { SalesReturnStatus, RefundMode, CustomerMode } from "@prisma/client";

type SalesReturnItemDecimalField = "quantity" | "taxableAmount" | "cgst" | "sgst" | "igst" | "cess" | "totalAmount";

// Decimal -> number normalization at the repository boundary — the
// src/types/sales-invoice.ts convention.
export interface SalesReturnItem
  extends Omit<PrismaSalesReturnItem, SalesReturnItemDecimalField>,
    Record<SalesReturnItemDecimalField, number> {}

type SalesReturnDecimalField = "taxableAmount" | "totalCgst" | "totalSgst" | "totalIgst" | "totalCess" | "grandTotal";

export interface SalesReturn
  extends Omit<PrismaSalesReturn, SalesReturnDecimalField>,
    Record<SalesReturnDecimalField, number> {}

/** The slice of the source SalesInvoiceItem a return line's read-model needs
 * for display — product/warehouse names, never a re-enterable price. */
export interface SalesReturnInvoiceItemSnapshot {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
}

export interface SalesReturnItemDetail extends SalesReturnItem {
  salesInvoiceItem: SalesReturnInvoiceItemSnapshot;
}

export interface SalesReturnInvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerMode: "PERMANENT" | "QUICK" | "WALK_IN";
  customerId: string | null;
  customerName: string | null;
}

export interface SalesReturnRefundLedgerSnapshot {
  id: string;
  name: string;
}

export interface SalesReturnDetail extends SalesReturn {
  salesInvoice: SalesReturnInvoiceSnapshot;
  refundLedger: SalesReturnRefundLedgerSnapshot | null;
  items: SalesReturnItemDetail[];
}

export interface SalesReturnListRow extends SalesReturn {
  salesInvoice: SalesReturnInvoiceSnapshot;
}

export type SalesReturnStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface SalesReturnListFilters {
  search?: string;
  status?: SalesReturnStatusFilter;
  fromDate?: Date;
  toDate?: Date;
}

/** One returnable line of a POSTED Sales Invoice — the create form's line
 * editor reads from this. `returnableQuantity` is server-computed
 * (originalQuantity minus the sum of prior POSTED SalesReturnItems against
 * this same invoice item, excluding DRAFT/CANCELLED returns entirely). */
export interface ReturnableInvoiceLine {
  salesInvoiceItemId: string;
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

/** The "New Sales Return" invoice-picker + line-editor lookup — the read
 * model `getReturnableInvoice` returns once a POSTED invoice is selected. */
export interface ReturnableInvoiceDetail {
  salesInvoiceId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerMode: "PERMANENT" | "QUICK" | "WALK_IN";
  customerId: string | null;
  customerName: string | null;
  lines: ReturnableInvoiceLine[];
}

/** The posted-invoice picker's search-result rows for "New Sales Return". */
export interface ReturnableInvoiceOption {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerName: string | null;
}

export interface SalesReturnRefundLedgerOption {
  id: string;
  name: string;
  groupName: string;
}

/** Everything the Sales Return Form needs beyond the picked invoice's own
 * returnable-lines lookup — mirrors SalesInvoiceFormOptions. No "next
 * number" preview: unlike Sales Invoice, `returnNumber` is only assigned at
 * posting (39-sales-return.md's Decisions), so a draft-time preview would be
 * misleading with multiple concurrent drafts in flight. */
export interface SalesReturnFormOptions {
  refundLedgers: SalesReturnRefundLedgerOption[];
  isLedgerMappingComplete: boolean;
}

export interface SalesReturnTotals {
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}
