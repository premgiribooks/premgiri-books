import type {
  DebitNote as PrismaDebitNote,
  DebitNoteItem as PrismaDebitNoteItem,
} from "@prisma/client";

export type { DebitNoteStatus } from "@prisma/client";

type DebitNoteItemDecimalField = "taxableAmount" | "ratePercent" | "cessPercent" | "cgst" | "sgst" | "igst" | "cess" | "totalAmount";

// Decimal -> number normalization at the repository boundary — the
// src/types/credit-note.ts convention.
export interface DebitNoteItem
  extends Omit<PrismaDebitNoteItem, DebitNoteItemDecimalField>,
    Record<DebitNoteItemDecimalField, number> {}

type DebitNoteDecimalField = "taxableAmount" | "totalCgst" | "totalSgst" | "totalIgst" | "totalCess" | "grandTotal";

export interface DebitNote
  extends Omit<PrismaDebitNote, DebitNoteDecimalField>,
    Record<DebitNoteDecimalField, number> {}

export type DebitNoteItemDetail = DebitNoteItem;

export interface DebitNoteCustomerSnapshot {
  id: string;
  name: string;
}

export interface DebitNoteInvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
}

export interface DebitNoteDetail extends DebitNote {
  customer: DebitNoteCustomerSnapshot;
  salesInvoice: DebitNoteInvoiceSnapshot | null;
  items: DebitNoteItemDetail[];
}

export interface DebitNoteListRow extends DebitNote {
  customer: DebitNoteCustomerSnapshot;
  salesInvoice: DebitNoteInvoiceSnapshot | null;
}

export type DebitNoteStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface DebitNoteListFilters {
  search?: string;
  status?: DebitNoteStatusFilter;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface DebitNoteCustomerOption {
  id: string;
  name: string;
}

/** The optional invoice picker's options — POSTED, non-WALK_IN invoices only
 * (a WALK_IN invoice is always rejected as a link target, 41-debit-note.md's
 * Data Model Decisions), carrying enough to prefill the form on selection. */
export interface DebitNoteInvoiceOption {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerId: string;
  customerName: string;
  placeOfSupplyStateCode: string;
}

/** The freeform line editor's optional "pick a GST Rate" prefill
 * (41-debit-note.md's Data Model: mirrors 40-credit-note.md's identical
 * concept). */
export interface DebitNoteGstRateOption {
  id: string;
  name: string;
  ratePercent: number;
  cessPercent: number;
}

export interface DebitNoteFormOptions {
  customers: DebitNoteCustomerOption[];
  invoices: DebitNoteInvoiceOption[];
  gstRates: DebitNoteGstRateOption[];
  isLedgerMappingComplete: boolean;
}

export interface DebitNoteTotals {
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}
