import type { PurchaseInvoiceListRow } from "@/types/purchase-invoice";
import type { PurchaseReturnListRow } from "@/types/purchase-return";

export type { PurchaseReturnStatus, RefundMode } from "@/types/purchase-return";

// 69-purchase-reports.md — the four Purchase Reports view-models, produced
// by src/engines/reporting/purchase-reports.ts. No new Prisma model anywhere
// in this file — every figure it displays is either read directly from an
// existing posted document or computed by summing/grouping already-stored,
// already-validated columns. Mirrors src/types/sales-report.ts exactly,
// minus the Party-wise view's synthetic-bucket handling (every Purchase
// Invoice has a required, non-null supplierId — see PartyWisePurchaseRow).

export interface PurchaseRegisterTotals {
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
}

/** The Purchase Register — `PurchaseInvoiceListRow[]` (unchanged shape,
 * `purchaseInvoiceService.listPurchaseInvoices`'s own row) plus a totals
 * footer, a plain sum for display (never re-derived business logic). */
export interface PurchaseRegisterReport {
  rows: PurchaseInvoiceListRow[];
  totals: PurchaseRegisterTotals;
}

/** One product's row, `cgst+sgst+igst+cess` combined into a single
 * presentation `totalTax` figure by the Reporting Engine. */
export interface ItemWisePurchaseRow {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  taxableAmount: number;
  totalTax: number;
  totalValue: number;
  invoiceCount: number;
}

export interface ItemWisePurchaseTotals {
  quantity: number;
  taxableAmount: number;
  totalTax: number;
  totalValue: number;
}

export interface ItemWisePurchaseReport {
  rows: ItemWisePurchaseRow[];
  totals: ItemWisePurchaseTotals;
}

/** Every Purchase Invoice has a required `supplierId` — no
 * Walk-in/Quick-equivalent concept exists on the purchase side (spec 44's
 * own Decisions), so unlike `PartyWiseSalesRow` there is no `groupType`
 * discriminator or synthetic bucket here. */
export interface PartyWisePurchaseRow {
  supplierId: string;
  supplierName: string;
  invoiceCount: number;
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
}

export interface PartyWisePurchaseTotals {
  invoiceCount: number;
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
}

export interface PartyWisePurchaseReport {
  rows: PartyWisePurchaseRow[];
  totals: PartyWisePurchaseTotals;
}

/** `PurchaseReturnListRow` already carries every field the Purchase Return
 * Summary needs (its `purchaseInvoice` snapshot resolves the supplier, per
 * 45-purchase-return.md's own repository shape), so no dedicated row type is
 * introduced — this alias documents the view's own name for it. */
export type PurchaseReturnSummaryRow = PurchaseReturnListRow;

export interface PurchaseReturnSummaryReport {
  rows: PurchaseReturnListRow[];
  /** Σ Grand Total across the filtered rows — a plain sum for display, not
   * a business-rule computation (Business Rules #4). */
  totalGrandTotal: number;
}
