import type { BalanceType, CustomerType, VoucherType } from "@prisma/client";

import { buildPartyWiseSalesReport } from "@/engines/reporting/sales-reports";
import type { LedgerStatementResult, TrialBalanceResult } from "@/engines/voucher/types";
import type { PartyWiseSalesAggregateRow } from "@/types/sales-invoice";
import type { PartyWiseSalesReport } from "@/types/sales-report";
import type {
  CustomerDirectoryReport,
  CustomerOutstandingReport,
  CustomerReportRow,
  CustomerStatementReport,
} from "@/types/customer-report";
import type { ReportExportColumn, ReportExportTable } from "@/types/report-export";

// 71-customer-reports.md's Reporting Engine composition layer — pure
// functions only, no Prisma import anywhere in this file. Every balance
// figure here is read as-is from voucherEngine's own
// getTrialBalance/getLedgerStatement output — never re-summed or
// re-derived from Voucher/VoucherEntry rows directly (Invariant 9,
// "Accounting reports derive data only from vouchers"). Every data access
// happens in customer-report-service.ts, which passes already-fetched
// customer rows and query results in as plain arguments.

/** `openingBalance`, signed debit-positive by `openingBalanceType` — duplicated locally rather than imported, matching this codebase's own per-module convention (see voucher-queries.ts's identical helper). */
function signedOpening(openingBalance: number, openingBalanceType: BalanceType): number {
  return openingBalanceType === "DEBIT" ? openingBalance : -openingBalance;
}

/** "SALES" -> "Sales Voucher", "CREDIT_NOTE" -> "Credit Note Voucher". */
function humanizeVoucherType(voucherType: VoucherType): string {
  const words = voucherType
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `${words.join(" ")} Voucher`;
}

/**
 * Business Rules #1 — joins `getTrialBalance`'s own per-ledger rows to each
 * Customer's `ledgerId`. `getTrialBalance` already lists every ledger in the
 * company (its own documented contract), so every customer is expected to
 * find a match; the `signedOpening` fallback below only guards the
 * defensive case where one somehow doesn't (never treated as zero, per the
 * spec's own "don't invent a default" posture). The Over Limit flag is
 * `null` (not applicable) rather than `false` when no `creditLimit` is set —
 * "nothing to compare against."
 */
export function buildCustomerOutstandingReport(
  trialBalance: TrialBalanceResult,
  customers: readonly CustomerReportRow[]
): CustomerOutstandingReport {
  const trialBalanceRowByLedgerId = new Map(trialBalance.rows.map((row) => [row.ledgerId, row]));

  const rows = customers.map((customer) => {
    const matchedRow = trialBalanceRowByLedgerId.get(customer.ledgerId);
    const outstandingBalance = matchedRow
      ? matchedRow.closingBalance
      : signedOpening(customer.openingBalance, customer.openingBalanceType);

    return {
      customerId: customer.id,
      customerName: customer.displayName,
      customerType: customer.customerType,
      outstandingBalance,
      creditLimit: customer.creditLimit,
      isOverLimit: customer.creditLimit === null ? null : outstandingBalance > customer.creditLimit,
    };
  });

  return { rows };
}

/**
 * Business Rules #2 — `getLedgerStatement`'s own dated lines, split into
 * separate Debit/Credit columns for presentation (the engine's own
 * `LedgerStatementLine` carries a single signed `entryType`+`amount` pair).
 * `voucherNumber`/`voucherType` are already present on each line (unlike
 * Stock Ledger's referenceType/referenceId shape), so no document-number
 * lookup is needed here.
 */
export function buildCustomerStatement(
  customer: { id: string; displayName: string },
  statement: LedgerStatementResult
): CustomerStatementReport {
  const lines = statement.lines.map((line) => ({
    voucherId: line.voucherId,
    voucherNumber: line.voucherNumber,
    voucherType: line.voucherType,
    voucherTypeLabel: humanizeVoucherType(line.voucherType),
    voucherDate: line.voucherDate,
    narration: line.narration,
    debit: line.entryType === "DEBIT" ? line.amount : 0,
    credit: line.entryType === "CREDIT" ? line.amount : 0,
    runningBalance: line.runningBalance,
  }));

  return {
    customerId: customer.id,
    customerName: customer.displayName,
    openingBalance: statement.openingBalance,
    lines,
    closingBalance: statement.closingBalance,
  };
}

/**
 * Business Rules #3 — reuses `salesInvoiceService.getPartyWiseSalesReport`'s
 * (spec 68) raw aggregate rows and `sales-reports.ts`'s own
 * `buildPartyWiseSalesReport` unmodified, only excluding the two synthetic
 * Walk-in/Quick-Customer buckets first (both have `customerId === null` and
 * no `Customer` master record to anchor a "Customer Reports" view to). No
 * new aggregation logic, no second independent query.
 */
export function buildCustomerSalesSummary(rawRows: readonly PartyWiseSalesAggregateRow[]): PartyWiseSalesReport {
  return buildPartyWiseSalesReport(rawRows.filter((row) => row.customerId !== null));
}

type CustomerStatementExportRow = Record<string, string | number | Date | null>;

const CUSTOMER_STATEMENT_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "date", header: "Date", type: "date" },
  { key: "voucherType", header: "Voucher Type", type: "string" },
  { key: "voucherNumber", header: "Voucher Number", type: "string" },
  { key: "narration", header: "Narration", type: "string" },
  { key: "debit", header: "Debit", type: "currency" },
  { key: "credit", header: "Credit", type: "currency" },
  { key: "runningBalance", header: "Running Balance", type: "currency" },
];

/**
 * Flattens buildCustomerStatement's dated lines into the flat rows-plus-
 * totals-footer shape src/lib/excel-export.ts's shared contract understands,
 * mirroring trial-balance.ts/balance-sheet.ts's own toXExportTable
 * flattening approach. The Opening Balance is prepended as a synthetic row
 * (no voucher fields, just its own running-balance figure) and the Closing
 * Balance is likewise a synthetic totals-footer row — both copied straight
 * from `report.openingBalance`/`report.closingBalance`, never re-derived
 * from `report.lines`.
 */
export function toCustomerStatementExportTable(report: CustomerStatementReport): ReportExportTable[] {
  const rows: CustomerStatementExportRow[] = [
    {
      date: null,
      voucherType: "",
      voucherNumber: "",
      narration: "Opening Balance",
      debit: null,
      credit: null,
      runningBalance: report.openingBalance,
    },
    ...report.lines.map((line) => ({
      date: line.voucherDate,
      voucherType: line.voucherTypeLabel,
      voucherNumber: line.voucherNumber,
      narration: line.narration ?? "",
      debit: line.debit,
      credit: line.credit,
      runningBalance: line.runningBalance,
    })),
  ];

  return [
    {
      sheetName: "Customer Statement",
      title: report.customerName,
      columns: CUSTOMER_STATEMENT_EXPORT_COLUMNS,
      rows,
      totals: {
        date: null,
        voucherType: "",
        voucherNumber: "",
        narration: "Closing Balance",
        debit: null,
        credit: null,
        runningBalance: report.closingBalance,
      },
    },
  ];
}

/** Business Rules #4 — a straightforward presentation of the Customer rows already fetched. */
export function buildCustomerDirectory(customers: readonly CustomerReportRow[]): CustomerDirectoryReport {
  const rows = customers.map((customer) => ({
    id: customer.id,
    displayName: customer.displayName,
    customerType: customer.customerType,
    mobileNumber: customer.mobileNumber,
    gstin: customer.gstin,
    city: customer.city,
    state: customer.state,
    isActive: customer.isActive,
  }));

  return { rows };
}

/**
 * "RETAIL" -> "Retail" — duplicated locally rather than imported from
 * customer-type-badge.tsx's own `CUSTOMER_TYPE_LABELS` (a UI component
 * module, out of reach for this pure-function engine layer with no
 * component/Prisma imports of its own), mirroring humanizeVoucherType's
 * identical per-file duplication convention above.
 */
function humanizeCustomerType(customerType: CustomerType): string {
  return customerType.charAt(0) + customerType.slice(1).toLowerCase();
}

type CustomerOutstandingExportRow = Record<string, string | number | Date | null>;

const CUSTOMER_OUTSTANDING_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "customerName", header: "Customer", type: "string" },
  { key: "customerType", header: "Type", type: "string" },
  { key: "outstandingBalance", header: "Outstanding Balance", type: "currency" },
  { key: "creditLimit", header: "Credit Limit", type: "currency" },
  { key: "overLimit", header: "Over Limit", type: "string" },
];

/** Mirrors customer-outstanding-table.tsx's own presentation exactly: `false` (not over limit) renders blank, `null` (no credit limit set, not applicable) renders "—", and only `true` prints a label. */
function overLimitLabel(isOverLimit: boolean | null): string {
  if (isOverLimit === null) {
    return "—";
  }
  return isOverLimit ? "Over Limit" : "";
}

/**
 * Flattens buildCustomerOutstandingReport's flat row list into the
 * rows-plus-optional-totals-footer shape src/lib/excel-export.ts's shared
 * contract understands, mirroring customer-outstanding-table.tsx's own
 * column set exactly. No totals footer — the on-screen table has none (an
 * Outstanding Balance total across customers isn't a figure that table
 * surfaces), so none is invented here either.
 */
export function toCustomerOutstandingExportTable(report: CustomerOutstandingReport): ReportExportTable[] {
  const rows: CustomerOutstandingExportRow[] = report.rows.map((row) => ({
    customerName: row.customerName,
    customerType: humanizeCustomerType(row.customerType),
    outstandingBalance: row.outstandingBalance,
    creditLimit: row.creditLimit,
    overLimit: overLimitLabel(row.isOverLimit),
  }));

  return [
    {
      sheetName: "Customer Outstanding",
      columns: CUSTOMER_OUTSTANDING_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type CustomerDirectoryExportRow = Record<string, string | number | Date | null>;

const CUSTOMER_DIRECTORY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "displayName", header: "Name", type: "string" },
  { key: "customerType", header: "Type", type: "string" },
  { key: "mobileNumber", header: "Mobile", type: "string" },
  { key: "gstin", header: "GSTIN", type: "string" },
  { key: "cityState", header: "City / State", type: "string" },
  { key: "status", header: "Status", type: "string" },
];

/**
 * Flattens buildCustomerDirectory's flat row list into
 * src/lib/excel-export.ts's shared contract, mirroring
 * customer-directory-table.tsx's own column set exactly — City and State
 * combined into a single "City / State" column, matching the on-screen
 * table's own presentation. No totals footer — a contact directory has
 * nothing to sum.
 */
export function toCustomerDirectoryExportTable(report: CustomerDirectoryReport): ReportExportTable[] {
  const rows: CustomerDirectoryExportRow[] = report.rows.map((row) => ({
    displayName: row.displayName,
    customerType: humanizeCustomerType(row.customerType),
    mobileNumber: row.mobileNumber ?? "",
    gstin: row.gstin ?? "",
    cityState: [row.city, row.state].filter(Boolean).join(", "),
    status: row.isActive ? "Active" : "Inactive",
  }));

  return [
    {
      sheetName: "Customer Directory",
      columns: CUSTOMER_DIRECTORY_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type CustomerSalesSummaryExportRow = Record<string, string | number | Date | null>;

const CUSTOMER_SALES_SUMMARY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "customerName", header: "Customer", type: "string" },
  { key: "invoiceCount", header: "Invoice Count", type: "number" },
  { key: "taxableAmount", header: "Taxable Value", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
];

/**
 * Flattens buildCustomerSalesSummary's own `PartyWiseSalesReport` into
 * src/lib/excel-export.ts's shared contract, mirroring
 * party-wise-sales-table.tsx's own column set exactly. `buildCustomerSalesSummary`
 * already excludes the Walk-in/Quick-Customer synthetic buckets before this
 * point (Business Rules #3 above), so every row reaching this function is a
 * real Customer — no groupType badge column is needed here, unlike the
 * on-screen table's own conditional badge (which only ever renders for the
 * buckets this report never contains). Self-contained on purpose: this
 * duplicates the Sales module's own identical `PartyWiseSalesReport` ->
 * export-table flattening in sales-reports.ts rather than importing it,
 * matching this file's own established small-duplication convention (see
 * signedOpening/humanizeVoucherType above). The totals footer is copied
 * straight from `report.totals`, never re-summed.
 */
export function toCustomerSalesSummaryExportTable(report: PartyWiseSalesReport): ReportExportTable[] {
  const rows: CustomerSalesSummaryExportRow[] = report.rows.map((row) => ({
    customerName: row.customerName,
    invoiceCount: row.invoiceCount,
    taxableAmount: row.taxableAmount,
    totalTax: row.totalTax,
    grandTotal: row.grandTotal,
  }));

  return [
    {
      sheetName: "Customer Sales Summary",
      columns: CUSTOMER_SALES_SUMMARY_EXPORT_COLUMNS,
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
