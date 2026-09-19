import { SALES_INVOICE_STATUS_LABELS } from "@/modules/sales-invoices/components/sales-invoice-status-badge";
import { toPaise } from "@/modules/sales-invoices/utils/sales-invoice-calculations";
import { SALES_RETURN_STATUS_LABELS } from "@/modules/sales-returns/components/sales-return-status-badge";
import type {
  ItemWiseSalesAggregateRow,
  PartyWiseSalesAggregateRow,
  SalesInvoiceListRow,
} from "@/types/sales-invoice";
import type { SalesReturnListRow } from "@/types/sales-return";
import type {
  ItemWiseSalesReport,
  ItemWiseSalesRow,
  PartyWiseSalesReport,
  PartyWiseSalesRow,
  SalesRegisterReport,
  SalesRegisterTotals,
  SalesReturnSummaryReport,
} from "@/types/sales-report";
import type { ReportExportColumn, ReportExportTable } from "@/types/report-export";

// 68-sales-reports.md's Reporting Engine composition layer — pure functions
// only, no Prisma import anywhere in this file. Each function here shapes
// data already fetched by the owning module's own service
// (salesInvoiceService/salesReturnService) into this spec's view-model
// types; no GST/pricing/stock recalculation, only summing/grouping of
// already-computed, already-stored figures (Invariant 3, "Reports are
// read-only").

const ZERO_SALES_REGISTER_TOTALS: SalesRegisterTotals = {
  taxableAmount: 0,
  totalTax: 0,
  grandTotal: 0,
  amountPaid: 0,
};

/** The Sales Register — attaches a totals footer to the invoice rows
 * `salesInvoiceService.listSalesInvoices` already returns (Business Rules
 * #1). */
export function buildSalesRegister(rows: readonly SalesInvoiceListRow[]): SalesRegisterReport {
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
        ? ZERO_SALES_REGISTER_TOTALS
        : {
            taxableAmount: taxableAmountPaise / 100,
            totalTax: totalTaxPaise / 100,
            grandTotal: grandTotalPaise / 100,
            amountPaid: amountPaidPaise / 100,
          },
  };
}

/** The Item-wise Sales Report — combines each row's separate `cgst`/`sgst`/
 * `igst`/`cess` into one presentation `totalTax` figure (Business Rules #2)
 * and computes the totals footer. `invoiceCount` is deliberately excluded
 * from the footer — summing per-product invoice counts would double-count
 * an invoice carrying more than one product line, a meaningless figure no
 * part of this spec asks for. */
export function buildItemWiseSalesReport(rawRows: readonly ItemWiseSalesAggregateRow[]): ItemWiseSalesReport {
  const rows: ItemWiseSalesRow[] = rawRows.map((row) => ({
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

/** Assigns the two synthetic buckets' own display labels (Business Rules
 * #3) — a real Customer's name is already resolved by the repository. */
function toPartyWiseSalesRow(row: PartyWiseSalesAggregateRow): PartyWiseSalesRow {
  const groupType = row.customerId !== null ? "CUSTOMER" : row.customerMode === "WALK_IN" ? "WALK_IN" : "QUICK_UNCONVERTED";
  const customerName =
    row.customerId !== null
      ? (row.customerName ?? "Unknown customer")
      : groupType === "WALK_IN"
        ? "Walk-in Sales"
        : "Quick Customer Sales (unconverted)";

  return {
    groupType,
    customerId: row.customerId,
    customerMode: row.customerMode,
    customerName,
    invoiceCount: row.invoiceCount,
    taxableAmount: row.taxableAmount,
    totalTax: (toPaise(row.cgst) + toPaise(row.sgst) + toPaise(row.igst) + toPaise(row.cess)) / 100,
    grandTotal: row.grandTotal,
  };
}

/** The Party-wise Sales Summary — labels the synthetic Walk-in/Quick
 * buckets and computes the totals footer. Unlike Item-wise's own footer,
 * `invoiceCount` IS summed here: every POSTED invoice belongs to exactly
 * one group (a document-level, not line-level, aggregation), so the sum
 * across groups is the true total invoice count for the period. */
export function buildPartyWiseSalesReport(rawRows: readonly PartyWiseSalesAggregateRow[]): PartyWiseSalesReport {
  const rows = rawRows.map(toPartyWiseSalesRow);

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

/** The Sales Return Summary — applies the optional customerId filter
 * in-memory (resolved via each return's parent invoice's customer, since
 * `SalesReturn` itself has no direct `customerId` column — Business Rules
 * #4) against the rows `salesReturnService.listSalesReturns` already
 * returns, joined to each return's own invoice/customer snapshot, then
 * computes the totals footer. A cross-company `customerId` naturally
 * matches nothing here, since `rows` is already scoped to the caller's own
 * company by `listSalesReturns` itself. */
export function buildSalesReturnSummary(rows: readonly SalesReturnListRow[], customerId?: string): SalesReturnSummaryReport {
  const filtered = customerId ? rows.filter((row) => row.salesInvoice.customerId === customerId) : rows;

  let totalGrandTotalPaise = 0;
  for (const row of filtered) {
    totalGrandTotalPaise += toPaise(row.grandTotal);
  }

  return { rows: [...filtered], totalGrandTotal: totalGrandTotalPaise / 100 };
}

type SalesRegisterExportRow = Record<string, string | number | Date | null>;

const SALES_REGISTER_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "invoiceNumber", header: "Invoice Number", type: "string" },
  { key: "invoiceDate", header: "Date", type: "date" },
  { key: "customerName", header: "Customer", type: "string" },
  { key: "taxableAmount", header: "Taxable Amount", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
  { key: "amountPaid", header: "Amount Paid", type: "currency" },
  { key: "status", header: "Status", type: "string" },
];

/** Resolved display name per Business Rules #1 — duplicated here rather than
 * imported, mirroring sales-register-table.tsx's own `customerLabel`
 * exactly (customer-reports.ts's signedOpening/humanizeVoucherType is this
 * codebase's established precedent for duplicating small per-module
 * helpers). */
function customerLabel(invoice: SalesInvoiceListRow): string {
  if (invoice.customer) {
    return invoice.customer.name;
  }
  if (invoice.customerMode === "QUICK") {
    return invoice.quickCustomerName ?? "Quick Customer";
  }
  return invoice.quickCustomerName ? `Walk-in — ${invoice.quickCustomerName}` : "Walk-in";
}

/**
 * Flattens the Sales Register's invoice rows into the flat rows-plus-
 * totals-footer shape src/lib/excel-export.ts's shared contract understands,
 * mirroring trial-balance.ts/balance-sheet.ts's own toXExportTable
 * flattening approach. Column set, the customer-label fallback, and the
 * cgst+sgst+igst+cess -> single "Total Tax" combination all mirror
 * sales-register-table.tsx's on-screen rendering exactly, so the export
 * shows the same data as the screen. The totals footer is copied straight
 * from `report.totals`, never re-summed.
 */
export function toSalesRegisterExportTable(report: SalesRegisterReport): ReportExportTable[] {
  const rows: SalesRegisterExportRow[] = report.rows.map((row) => ({
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    customerName: customerLabel(row),
    taxableAmount: row.taxableAmount,
    totalTax: row.totalCgst + row.totalSgst + row.totalIgst + row.totalCess,
    grandTotal: row.grandTotal,
    amountPaid: row.amountPaid,
    status: SALES_INVOICE_STATUS_LABELS[row.status],
  }));

  return [
    {
      sheetName: "Sales Register",
      columns: SALES_REGISTER_EXPORT_COLUMNS,
      rows,
      totals: {
        invoiceNumber: "Total",
        invoiceDate: null,
        customerName: "",
        taxableAmount: report.totals.taxableAmount,
        totalTax: report.totals.totalTax,
        grandTotal: report.totals.grandTotal,
        amountPaid: report.totals.amountPaid,
        status: "",
      },
    },
  ];
}

type ItemWiseSalesExportRow = Record<string, string | number | null>;

const ITEM_WISE_SALES_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "productName", header: "Product Name", type: "string" },
  { key: "productCode", header: "Product Code", type: "string" },
  { key: "quantity", header: "Quantity Sold", type: "number" },
  { key: "taxableAmount", header: "Taxable Value", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "totalValue", header: "Total Value", type: "currency" },
  { key: "invoiceCount", header: "Invoice Count", type: "number" },
];

/**
 * Flattens the Item-wise Sales Report into the flat rows-plus-totals-footer
 * shape, mirroring item-wise-sales-table.tsx's exact column set —
 * `productName`/`productCode` split into their own columns (a flat sheet has
 * no room for the screen's stacked two-line product cell). `invoiceCount` is
 * carried per-row exactly as shown on screen, but left blank in the totals
 * footer (mirroring the on-screen footer's own empty `<TableCell />`),
 * matching buildItemWiseSalesReport's own deliberate exclusion of a summed
 * invoiceCount from `report.totals`.
 */
export function toItemWiseSalesExportTable(report: ItemWiseSalesReport): ReportExportTable[] {
  const rows: ItemWiseSalesExportRow[] = report.rows.map((row) => ({
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
      sheetName: "Item-wise Sales",
      columns: ITEM_WISE_SALES_EXPORT_COLUMNS,
      rows,
      totals: {
        productName: "Period Total",
        productCode: "",
        quantity: report.totals.quantity,
        taxableAmount: report.totals.taxableAmount,
        totalTax: report.totals.totalTax,
        totalValue: report.totals.totalValue,
        invoiceCount: null,
      },
    },
  ];
}

type PartyWiseSalesExportRow = Record<string, string | number>;

const PARTY_WISE_SALES_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "customerName", header: "Customer", type: "string" },
  { key: "invoiceCount", header: "Invoice Count", type: "number" },
  { key: "taxableAmount", header: "Taxable Value", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
];

/**
 * Flattens the Party-wise Sales Summary into the flat rows-plus-totals-footer
 * shape, mirroring party-wise-sales-table.tsx's own column set. The screen's
 * "Walk-in"/"Unconverted" `Badge` next to a synthetic bucket's name is
 * dropped here — `row.customerName` already reads "Walk-in Sales"/"Quick
 * Customer Sales (unconverted)" for those two buckets (toPartyWiseSalesRow's
 * own labeling), so the badge would only repeat information the name column
 * already carries, and a flat export sheet has no separate badge slot
 * anyway. `invoiceCount` IS summed in the footer here, unlike Item-wise —
 * matching buildPartyWiseSalesReport's own totals (every POSTED invoice
 * belongs to exactly one group).
 */
export function toPartyWiseSalesExportTable(report: PartyWiseSalesReport): ReportExportTable[] {
  const rows: PartyWiseSalesExportRow[] = report.rows.map((row) => ({
    customerName: row.customerName,
    invoiceCount: row.invoiceCount,
    taxableAmount: row.taxableAmount,
    totalTax: row.totalTax,
    grandTotal: row.grandTotal,
  }));

  return [
    {
      sheetName: "Party-wise Sales",
      columns: PARTY_WISE_SALES_EXPORT_COLUMNS,
      rows,
      totals: {
        customerName: "Period Total",
        invoiceCount: report.totals.invoiceCount,
        taxableAmount: report.totals.taxableAmount,
        totalTax: report.totals.totalTax,
        grandTotal: report.totals.grandTotal,
      },
    },
  ];
}

type SalesReturnSummaryExportRow = Record<string, string | number | Date | null>;

const SALES_RETURN_SUMMARY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "returnNumber", header: "Return Number", type: "string" },
  { key: "invoiceNumber", header: "Source Invoice", type: "string" },
  { key: "returnDate", header: "Date", type: "date" },
  { key: "customerName", header: "Customer", type: "string" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
  { key: "refundMode", header: "Refund Mode", type: "string" },
  { key: "status", header: "Status", type: "string" },
];

/** Mirrors sales-return-summary-table.tsx's own local `REFUND_MODE_LABEL` —
 * duplicated here rather than imported, since that map is a private
 * (non-exported) constant of the table component, the same posture this
 * file's own `customerLabel` takes on sales-register-table.tsx's identical
 * helper. */
const REFUND_MODE_LABEL: Record<string, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

/**
 * Flattens the Sales Return Summary into the flat rows-plus-totals-footer
 * shape, mirroring sales-return-summary-table.tsx's exact column set —
 * including its `returnNumber ?? "Draft"` fallback, its refund-mode label
 * map, and its `SalesReturnStatusBadge`'s own status text (imported from
 * sales-return-status-badge.tsx, exported there unlike its sibling
 * `REFUND_MODE_LABEL`). `returnDate` is passed as the raw `Date` (its
 * "date" column type lets src/lib/excel-export.ts format it), not the
 * screen's pre-formatted `formatSalesReturnDate` string. The totals footer
 * is copied straight from `report.totalGrandTotal`, never re-summed.
 */
export function toSalesReturnSummaryExportTable(report: SalesReturnSummaryReport): ReportExportTable[] {
  const rows: SalesReturnSummaryExportRow[] = report.rows.map((row) => ({
    returnNumber: row.returnNumber ?? "Draft",
    invoiceNumber: row.salesInvoice.invoiceNumber,
    returnDate: row.returnDate,
    customerName: row.salesInvoice.customerName ?? "—",
    grandTotal: row.grandTotal,
    refundMode: REFUND_MODE_LABEL[row.refundMode] ?? row.refundMode,
    status: SALES_RETURN_STATUS_LABELS[row.status],
  }));

  return [
    {
      sheetName: "Sales Return Summary",
      columns: SALES_RETURN_SUMMARY_EXPORT_COLUMNS,
      rows,
      totals: {
        returnNumber: "Total",
        invoiceNumber: "",
        returnDate: null,
        customerName: "",
        grandTotal: report.totalGrandTotal,
        refundMode: "",
        status: "",
      },
    },
  ];
}
