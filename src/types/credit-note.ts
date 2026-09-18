import type {
  CreditNote as PrismaCreditNote,
  CreditNoteItem as PrismaCreditNoteItem,
} from "@prisma/client";

import type { PaymentModeOption } from "@/types/payment-mode";

export type { CreditNoteStatus, RefundMode } from "@prisma/client";

type CreditNoteItemDecimalField = "taxableAmount" | "ratePercent" | "cessPercent" | "cgst" | "sgst" | "igst" | "cess" | "totalAmount";

// Decimal -> number normalization at the repository boundary — the
// src/types/sales-return.ts convention.
export interface CreditNoteItem
  extends Omit<PrismaCreditNoteItem, CreditNoteItemDecimalField>,
    Record<CreditNoteItemDecimalField, number> {}

type CreditNoteDecimalField = "taxableAmount" | "totalCgst" | "totalSgst" | "totalIgst" | "totalCess" | "grandTotal";

export interface CreditNote
  extends Omit<PrismaCreditNote, CreditNoteDecimalField>,
    Record<CreditNoteDecimalField, number> {}

export type CreditNoteItemDetail = CreditNoteItem;

export interface CreditNoteCustomerSnapshot {
  id: string;
  name: string;
}

export interface CreditNoteInvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
}

export interface CreditNoteRefundLedgerSnapshot {
  id: string;
  name: string;
}

export interface CreditNotePaymentModeSnapshot {
  id: string;
  name: string;
}

export interface CreditNoteDetail extends CreditNote {
  customer: CreditNoteCustomerSnapshot;
  salesInvoice: CreditNoteInvoiceSnapshot | null;
  refundLedger: CreditNoteRefundLedgerSnapshot | null;
  paymentMode: CreditNotePaymentModeSnapshot | null;
  items: CreditNoteItemDetail[];
}

export interface CreditNoteListRow extends CreditNote {
  customer: CreditNoteCustomerSnapshot;
  salesInvoice: CreditNoteInvoiceSnapshot | null;
}

export type CreditNoteStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface CreditNoteListFilters {
  search?: string;
  status?: CreditNoteStatusFilter;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface CreditNoteCustomerOption {
  id: string;
  name: string;
}

/** The optional invoice picker's options — POSTED, non-WALK_IN invoices only
 * (a WALK_IN invoice is always rejected as a link target, 40-credit-note.md's
 * Data Model Decisions), carrying enough to prefill the form on selection. */
export interface CreditNoteInvoiceOption {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerId: string;
  customerName: string;
  placeOfSupplyStateCode: string;
}

/** `ledgerClass` (91-payment-mode-integration-sales.md) is this ledger's
 * three-way classification against the Payment Mode master — mirrors
 * SalesReturnRefundLedgerOption's identical field. */
export interface CreditNoteRefundLedgerOption {
  id: string;
  name: string;
  groupName: string;
  ledgerClass: "CASH" | "BANK" | "NEITHER";
}

/** The freeform line editor's optional "pick a GST Rate" prefill
 * (40-credit-note.md's Data Model: "entered or picked directly from a
 * GstRate"). */
export interface CreditNoteGstRateOption {
  id: string;
  name: string;
  ratePercent: number;
  cessPercent: number;
}

export interface CreditNoteFormOptions {
  customers: CreditNoteCustomerOption[];
  invoices: CreditNoteInvoiceOption[];
  refundLedgers: CreditNoteRefundLedgerOption[];
  paymentModes: PaymentModeOption[];
  gstRates: CreditNoteGstRateOption[];
  isLedgerMappingComplete: boolean;
}

export interface CreditNoteTotals {
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}
