import { SALES_INVOICE_STATUS_LABELS } from "@/modules/sales-invoices/components/sales-invoice-status-badge";
import { toPaise } from "@/modules/sales-invoices/utils/sales-invoice-calculations";
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
