import type { CustomerMode, RefundMode, SalesReturnStatus } from "@prisma/client";
import type { SalesInvoiceListRow } from "@/types/sales-invoice";
import type { SalesReturnListRow } from "@/types/sales-return";

export type { RefundMode, SalesReturnStatus };

// 68-sales-reports.md — the four Sales Reports view-models, produced by
// src/engines/reporting/sales-reports.ts. No new Prisma model anywhere in
// this file (Data Model: "every figure it displays is either read directly
// from an existing posted document or computed by summing/grouping
// already-stored, already-validated columns").

export interface SalesRegisterTotals {
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
}

/** The Sales Register — `SalesInvoiceListRow[]` (unchanged shape,
 * `salesInvoiceService.listSalesInvoices`'s own row) plus a totals footer,
 * a plain sum for display (never re-derived business logic). */
export interface SalesRegisterReport {
  rows: SalesInvoiceListRow[];
  totals: SalesRegisterTotals;
}

/** One product's row, `cgst+sgst+igst+cess` combined into a single
 * presentation `totalTax` figure by the Reporting Engine. */
export interface ItemWiseSalesRow {
  productId: string;
  productName: string;
  productCode: string | null;
  quantity: number;
  taxableAmount: number;
  totalTax: number;
  totalValue: number;
  invoiceCount: number;
}

export interface ItemWiseSalesTotals {
  quantity: number;
  taxableAmount: number;
  totalTax: number;
  totalValue: number;
}

export interface ItemWiseSalesReport {
  rows: ItemWiseSalesRow[];
  totals: ItemWiseSalesTotals;
}

/** `CUSTOMER` is a real, permanent (or converted-Quick) Customer;
 * `WALK_IN`/`QUICK_UNCONVERTED` are the two synthetic buckets Business
 * Rules requires rather than an "Other"/dropped bucket. */
export type PartyWiseSalesGroupType = "CUSTOMER" | "WALK_IN" | "QUICK_UNCONVERTED";

export interface PartyWiseSalesRow {
  groupType: PartyWiseSalesGroupType;
  customerId: string | null;
  customerMode: CustomerMode;
  customerName: string;
  invoiceCount: number;
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
}

export interface PartyWiseSalesTotals {
  invoiceCount: number;
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
}

export interface PartyWiseSalesReport {
  rows: PartyWiseSalesRow[];
  totals: PartyWiseSalesTotals;
}

/** `SalesReturnListRow` already carries every field the Sales Return
 * Summary needs (its `salesInvoice` snapshot resolves the customer, per
 * 39-sales-return.md's own repository shape), so no dedicated row type is
 * introduced — this alias documents the view's own name for it. */
export type SalesReturnSummaryRow = SalesReturnListRow;

export interface SalesReturnSummaryReport {
  rows: SalesReturnListRow[];
  /** Σ Grand Total across the filtered rows — a plain sum for display, not
   * a business-rule computation (Business Rules #4). */
  totalGrandTotal: number;
}
