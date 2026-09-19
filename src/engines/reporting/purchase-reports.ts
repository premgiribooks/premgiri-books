import { PURCHASE_INVOICE_STATUS_LABELS } from "@/modules/purchase-invoices/components/purchase-invoice-status-badge";
import { toPaise } from "@/modules/purchase-invoices/utils/purchase-invoice-calculations";
import { PURCHASE_RETURN_STATUS_LABELS } from "@/modules/purchase-returns/components/purchase-return-status-badge";
import type {
  ItemWisePurchaseAggregateRow,
  PartyWisePurchaseAggregateRow,
  PurchaseInvoiceListRow,
} from "@/types/purchase-invoice";
import type { PurchaseReturnListRow, RefundMode } from "@/types/purchase-return";
import type {
  ItemWisePurchaseReport,
  ItemWisePurchaseRow,
  PartyWisePurchaseReport,
  PartyWisePurchaseRow,
  PurchaseRegisterReport,
  PurchaseRegisterTotals,
  PurchaseReturnSummaryReport,
} from "@/types/purchase-report";
import type { ReportExportColumn, ReportExportTable } from "@/types/report-export";

// 69-purchase-reports.md's Reporting Engine composition layer — pure
// functions only, no Prisma import anywhere in this file. Mirrors
// src/engines/reporting/sales-reports.ts exactly; each function here shapes
// data already fetched by the owning module's own service
// (purchaseInvoiceService/purchaseReturnService) into this spec's
// view-model types; no GST/pricing/stock recalculation, only
// summing/grouping of already-computed, already-stored figures (Invariant
// 3, "Reports are read-only").

const ZERO_PURCHASE_REGISTER_TOTALS: PurchaseRegisterTotals = {
  taxableAmount: 0,
  totalTax: 0,
  grandTotal: 0,
  amountPaid: 0,
};

/** The Purchase Register — attaches a totals footer to the invoice rows
 * `purchaseInvoiceService.listPurchaseInvoices` already returns (Business
 * Rules #1). */
export function buildPurchaseRegister(rows: readonly PurchaseInvoiceListRow[]): PurchaseRegisterReport {
  let taxableAmountPaise = 0;
  let totalTaxPaise = 0;
  let grandTotalPaise = 0;
  let amountPaidPaise = 0;

  for (const row of rows) {
    taxableAmountPaise += toPaise(row.taxableAmount);
    totalTaxPaise += toPaise(row.totalCgst) + toPaise(row.totalSgst) + toPaise(row.totalIgst) + toPaise(row.totalCess);
    grandTotalPaise += toPaise(row.grandTotal);
    amountPaidPaise += toPaise(row.amountPaid);
  }

  return {
    rows: [...rows],
    totals:
      rows.length === 0
        ? ZERO_PURCHASE_REGISTER_TOTALS
        : {
            taxableAmount: taxableAmountPaise / 100,
            totalTax: totalTaxPaise / 100,
            grandTotal: grandTotalPaise / 100,
            amountPaid: amountPaidPaise / 100,
          },
  };
}

/** The Item-wise Purchase Report — combines each row's separate `cgst`/
 * `sgst`/`igst`/`cess` into one presentation `totalTax` figure (Business
 * Rules #2) and computes the totals footer. `invoiceCount` is deliberately
 * excluded from the footer — summing per-product invoice counts would
 * double-count an invoice carrying more than one product line, a
 * meaningless figure no part of this spec asks for. */
export function buildItemWisePurchaseReport(rawRows: readonly ItemWisePurchaseAggregateRow[]): ItemWisePurchaseReport {
  const rows: ItemWisePurchaseRow[] = rawRows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    productCode: row.productCode,
    quantity: row.quantity,
    taxableAmount: row.taxableAmount,
    totalTax: (toPaise(row.cgst) + toPaise(row.sgst) + toPaise(row.igst) + toPaise(row.cess)) / 100,
    totalValue: row.totalAmount,
    invoiceCount: row.invoiceCount,
  }));

  let quantity = 0;
  let taxableAmountPaise = 0;
  let totalTaxPaise = 0;
  let totalValuePaise = 0;
  for (const row of rows) {
    quantity += row.quantity;
    taxableAmountPaise += toPaise(row.taxableAmount);
    totalTaxPaise += toPaise(row.totalTax);
    totalValuePaise += toPaise(row.totalValue);
  }

  return {
    rows,
    totals: {
      quantity,
      taxableAmount: taxableAmountPaise / 100,
      totalTax: totalTaxPaise / 100,
      totalValue: totalValuePaise / 100,
    },
  };
}

function toPartyWisePurchaseRow(row: PartyWisePurchaseAggregateRow): PartyWisePurchaseRow {
  return {
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    invoiceCount: row.invoiceCount,
    taxableAmount: row.taxableAmount,
    totalTax: (toPaise(row.cgst) + toPaise(row.sgst) + toPaise(row.igst) + toPaise(row.cess)) / 100,
    grandTotal: row.grandTotal,
  };
}

/** The Party-wise Purchase Summary — computes the totals footer.
 * `invoiceCount` IS summed here: every POSTED invoice belongs to exactly one
 * supplier (a document-level, not line-level, aggregation), so the sum
 * across groups is the true total invoice count for the period. No
 * synthetic-bucket labeling needed (Business Rules #3), unlike
 * buildPartyWiseSalesReport. */
export function buildPartyWisePurchaseReport(rawRows: readonly PartyWisePurchaseAggregateRow[]): PartyWisePurchaseReport {
  const rows = rawRows.map(toPartyWisePurchaseRow);

  let invoiceCount = 0;
  let taxableAmountPaise = 0;
  let totalTaxPaise = 0;
  let grandTotalPaise = 0;
  for (const row of rows) {
    invoiceCount += row.invoiceCount;
    taxableAmountPaise += toPaise(row.taxableAmount);
    totalTaxPaise += toPaise(row.totalTax);
    grandTotalPaise += toPaise(row.grandTotal);
  }

  return {
    rows,
    totals: {
      invoiceCount,
      taxableAmount: taxableAmountPaise / 100,
      totalTax: totalTaxPaise / 100,
      grandTotal: grandTotalPaise / 100,
    },
  };
}

/** The Purchase Return Summary — applies the optional supplierId filter
 * in-memory (resolved via each return's parent invoice's supplier, since
 * `PurchaseReturn` itself has no direct `supplierId` column — Business
 * Rules #4) against the rows `purchaseReturnService.listPurchaseReturns`
 * already returns, joined to each return's own invoice/supplier snapshot,
 * then computes the totals footer. A cross-company `supplierId` naturally
 * matches nothing here, since `rows` is already scoped to the caller's own
 * company by `listPurchaseReturns` itself. */
export function buildPurchaseReturnSummary(
  rows: readonly PurchaseReturnListRow[],
  supplierId?: string
): PurchaseReturnSummaryReport {
  const filtered = supplierId ? rows.filter((row) => row.purchaseInvoice.supplierId === supplierId) : rows;

  let totalGrandTotalPaise = 0;
  for (const row of filtered) {
    totalGrandTotalPaise += toPaise(row.grandTotal);
  }

  return { rows: [...filtered], totalGrandTotal: totalGrandTotalPaise / 100 };
}

type PurchaseRegisterExportRow = Record<string, string | number | Date | null>;

const PURCHASE_REGISTER_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "invoiceNumber", header: "Invoice Number", type: "string" },
  { key: "supplierInvoiceNumber", header: "Supplier Invoice No.", type: "string" },
  { key: "supplierName", header: "Supplier", type: "string" },
  { key: "invoiceDate", header: "Date", type: "date" },
  { key: "taxableAmount", header: "Taxable Amount", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
  { key: "amountPaid", header: "Amount Paid", type: "currency" },
  { key: "status", header: "Status", type: "string" },
];

/**
 * Flattens buildPurchaseRegister's report into the single-sheet shape
 * src/lib/excel-export.ts's shared contract understands — mirrors
 * trial-balance.ts's toTrialBalanceExportTable/balance-sheet.ts's
 * toBalanceSheetExportTable. Row shape mirrors purchase-register-table.tsx's
 * own on-screen render exactly: cgst+sgst+igst+cess combined into one Total
 * Tax column, status shown via its display label (never the raw enum). The
 * totals footer is copied straight from `report.totals`, never re-summed.
 */
export function toPurchaseRegisterExportTable(report: PurchaseRegisterReport): ReportExportTable[] {
  const rows: PurchaseRegisterExportRow[] = report.rows.map((row) => ({
    invoiceNumber: row.invoiceNumber ?? "—",
    supplierInvoiceNumber: row.supplierInvoiceNumber,
    supplierName: row.supplier.name,
    invoiceDate: row.invoiceDate,
    taxableAmount: row.taxableAmount,
    totalTax: row.totalCgst + row.totalSgst + row.totalIgst + row.totalCess,
    grandTotal: row.grandTotal,
    amountPaid: row.amountPaid,
    status: PURCHASE_INVOICE_STATUS_LABELS[row.status],
  }));

  return [
    {
      sheetName: "Purchase Register",
      columns: PURCHASE_REGISTER_EXPORT_COLUMNS,
      rows,
      totals: {
        invoiceNumber: "Period Total",
        supplierInvoiceNumber: null,
        supplierName: null,
        invoiceDate: null,
        taxableAmount: report.totals.taxableAmount,
        totalTax: report.totals.totalTax,
        grandTotal: report.totals.grandTotal,
        amountPaid: report.totals.amountPaid,
        status: null,
      },
    },
  ];
}

type ItemWisePurchaseExportRow = Record<string, string | number | null>;

const ITEM_WISE_PURCHASE_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "productName", header: "Product", type: "string" },
  { key: "productCode", header: "Product Code", type: "string" },
  { key: "quantity", header: "Quantity Purchased", type: "number" },
  { key: "taxableAmount", header: "Taxable Value", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "totalValue", header: "Total Value", type: "currency" },
  { key: "invoiceCount", header: "Invoice Count", type: "number" },
];

/**
 * Flattens buildItemWisePurchaseReport's report into the single-sheet shape
 * src/lib/excel-export.ts's shared contract understands — mirrors
 * toPurchaseRegisterExportTable above. Row shape mirrors
 * item-wise-purchase-table.tsx's own on-screen render exactly, splitting its
 * two-line Product cell (name + code) into two columns. `invoiceCount` is
 * included per row but excluded from the totals footer, same as
 * buildItemWisePurchaseReport's own totals (Business Rules #2 — summing
 * per-product invoice counts would double-count an invoice carrying more
 * than one product line). The totals footer is otherwise copied straight
 * from `report.totals`, never re-summed.
 */
export function toItemWisePurchaseExportTable(report: ItemWisePurchaseReport): ReportExportTable[] {
  const rows: ItemWisePurchaseExportRow[] = report.rows.map((row) => ({
    productName: row.productName,
    productCode: row.productCode,
    quantity: row.quantity,
    taxableAmount: row.taxableAmount,
    totalTax: row.totalTax,
    totalValue: row.totalValue,
    invoiceCount: row.invoiceCount,
  }));

  return [
    {
      sheetName: "Item-wise Purchases",
      columns: ITEM_WISE_PURCHASE_EXPORT_COLUMNS,
      rows,
      totals: {
        productName: "Period Total",
        productCode: null,
        quantity: report.totals.quantity,
        taxableAmount: report.totals.taxableAmount,
        totalTax: report.totals.totalTax,
        totalValue: report.totals.totalValue,
        invoiceCount: null,
      },
    },
  ];
}

type PartyWisePurchaseExportRow = Record<string, string | number | null>;

const PARTY_WISE_PURCHASE_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "supplierName", header: "Supplier", type: "string" },
  { key: "invoiceCount", header: "Invoice Count", type: "number" },
  { key: "taxableAmount", header: "Taxable Value", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
];

/**
 * Flattens buildPartyWisePurchaseReport's report into the single-sheet shape
 * src/lib/excel-export.ts's shared contract understands. Row shape mirrors
 * party-wise-purchase-table.tsx's own on-screen render exactly. Unlike the
 * Item-wise export, `invoiceCount` IS summed in the totals footer here — it
 * is copied straight from `report.totals.invoiceCount`, which
 * buildPartyWisePurchaseReport itself sums (every POSTED invoice belongs to
 * exactly one supplier).
 */
export function toPartyWisePurchaseExportTable(report: PartyWisePurchaseReport): ReportExportTable[] {
  const rows: PartyWisePurchaseExportRow[] = report.rows.map((row) => ({
    supplierName: row.supplierName,
    invoiceCount: row.invoiceCount,
    taxableAmount: row.taxableAmount,
    totalTax: row.totalTax,
    grandTotal: row.grandTotal,
  }));

  return [
    {
      sheetName: "Party-wise Purchases",
      columns: PARTY_WISE_PURCHASE_EXPORT_COLUMNS,
      rows,
      totals: {
        supplierName: "Period Total",
        invoiceCount: report.totals.invoiceCount,
        taxableAmount: report.totals.taxableAmount,
        totalTax: report.totals.totalTax,
        grandTotal: report.totals.grandTotal,
      },
    },
  ];
}

type PurchaseReturnSummaryExportRow = Record<string, string | number | Date | null>;

const REFUND_MODE_EXPORT_LABELS: Record<RefundMode, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

const PURCHASE_RETURN_SUMMARY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "returnNumber", header: "Return Number", type: "string" },
  { key: "sourceInvoiceNumber", header: "Source Invoice", type: "string" },
  { key: "returnDate", header: "Date", type: "date" },
  { key: "supplierName", header: "Supplier", type: "string" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
  { key: "refundMode", header: "Refund Mode", type: "string" },
  { key: "status", header: "Status", type: "string" },
];

/**
 * Flattens buildPurchaseReturnSummary's report into the single-sheet shape
 * src/lib/excel-export.ts's shared contract understands. Row shape mirrors
 * purchase-return-summary-table.tsx's own on-screen render exactly: a null
 * `returnNumber` (a DRAFT return not yet numbered) shows as "Draft", refund
 * mode and status both render via their own display labels (never the raw
 * enum). The totals footer's only real figure is `totalGrandTotal`, copied
 * straight from `report.totalGrandTotal`, matching this report's own
 * type — no per-column totals exist beyond it (PurchaseReturnSummaryReport
 * has no `totals` object, only a single running total).
 */
export function toPurchaseReturnSummaryExportTable(report: PurchaseReturnSummaryReport): ReportExportTable[] {
  const rows: PurchaseReturnSummaryExportRow[] = report.rows.map((row) => ({
    returnNumber: row.returnNumber ?? "Draft",
    sourceInvoiceNumber: row.purchaseInvoice.invoiceNumber,
    returnDate: row.returnDate,
    supplierName: row.purchaseInvoice.supplierName,
    grandTotal: row.grandTotal,
    refundMode: REFUND_MODE_EXPORT_LABELS[row.refundMode] ?? row.refundMode,
    status: PURCHASE_RETURN_STATUS_LABELS[row.status],
  }));

  return [
    {
      sheetName: "Purchase Return Summary",
      columns: PURCHASE_RETURN_SUMMARY_EXPORT_COLUMNS,
      rows,
      totals: {
        returnNumber: "Period Total",
        sourceInvoiceNumber: null,
        returnDate: null,
        supplierName: null,
        grandTotal: report.totalGrandTotal,
        refundMode: null,
        status: null,
      },
    },
  ];
}
