import type {
  PurchaseCreditNote as PrismaPurchaseCreditNote,
  PurchaseCreditNoteItem as PrismaPurchaseCreditNoteItem,
} from "@prisma/client";

export type { CreditNoteStatus } from "@prisma/client";

type PurchaseCreditNoteItemDecimalField = "taxableAmount" | "ratePercent" | "cessPercent" | "cgst" | "sgst" | "igst" | "cess" | "totalAmount";

// Decimal -> number normalization at the repository boundary — the
// src/types/credit-note.ts convention this module mirrors.
export interface PurchaseCreditNoteItem
  extends Omit<PrismaPurchaseCreditNoteItem, PurchaseCreditNoteItemDecimalField>,
    Record<PurchaseCreditNoteItemDecimalField, number> {}

type PurchaseCreditNoteDecimalField = "taxableAmount" | "totalCgst" | "totalSgst" | "totalIgst" | "totalCess" | "grandTotal";

export interface PurchaseCreditNote
  extends Omit<PrismaPurchaseCreditNote, PurchaseCreditNoteDecimalField>,
    Record<PurchaseCreditNoteDecimalField, number> {}

export type PurchaseCreditNoteItemDetail = PurchaseCreditNoteItem;

export interface PurchaseCreditNoteSupplierSnapshot {
  id: string;
  name: string;
}

export interface PurchaseCreditNoteInvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
}

export interface PurchaseCreditNoteDetail extends PurchaseCreditNote {
  supplier: PurchaseCreditNoteSupplierSnapshot;
  purchaseInvoice: PurchaseCreditNoteInvoiceSnapshot | null;
  items: PurchaseCreditNoteItemDetail[];
}

export interface PurchaseCreditNoteListRow extends PurchaseCreditNote {
  supplier: PurchaseCreditNoteSupplierSnapshot;
  purchaseInvoice: PurchaseCreditNoteInvoiceSnapshot | null;
}

export type PurchaseCreditNoteStatusFilter = "DRAFT" | "POSTED" | "CANCELLED";

export interface PurchaseCreditNoteListFilters {
  search?: string;
  status?: PurchaseCreditNoteStatusFilter;
  supplierId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface PurchaseCreditNoteSupplierOption {
  id: string;
  name: string;
}

/** The optional invoice picker's options — POSTED purchase invoices only,
 * carrying enough to prefill the form on selection (mirrors
 * CreditNoteInvoiceOption's identical role on the sales side). */
export interface PurchaseCreditNoteInvoiceOption {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  supplierId: string;
  supplierName: string;
  placeOfSupplyStateCode: string;
}

/** The freeform line editor's optional "pick a GST Rate" prefill — mirrors
 * CreditNoteGstRateOption exactly. */
export interface PurchaseCreditNoteGstRateOption {
  id: string;
  name: string;
  ratePercent: number;
  cessPercent: number;
}

export interface PurchaseCreditNoteFormOptions {
  suppliers: PurchaseCreditNoteSupplierOption[];
  invoices: PurchaseCreditNoteInvoiceOption[];
  gstRates: PurchaseCreditNoteGstRateOption[];
  isLedgerMappingComplete: boolean;
}

export interface PurchaseCreditNoteTotals {
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}
