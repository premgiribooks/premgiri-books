import type { BalanceType, VoucherType } from "@prisma/client";

import { buildPartyWisePurchaseReport } from "@/engines/reporting/purchase-reports";
import type { LedgerStatementResult, TrialBalanceResult } from "@/engines/voucher/types";
import type { PartyWisePurchaseAggregateRow } from "@/types/purchase-invoice";
import type { PartyWisePurchaseReport } from "@/types/purchase-report";
import type { ReportExportColumn, ReportExportTable } from "@/types/report-export";
import type {
  SupplierDirectoryReport,
  SupplierOutstandingReport,
  SupplierReportRow,
  SupplierStatementReport,
} from "@/types/supplier-report";

// 72-supplier-reports.md's Reporting Engine composition layer — pure
// functions only, no Prisma import anywhere in this file. Every balance
// figure here is read as-is from voucherEngine's own
// getTrialBalance/getLedgerStatement output — never re-summed or
// re-derived from Voucher/VoucherEntry rows directly (Invariant 9,
// "Accounting reports derive data only from vouchers"). Every data access
// happens in supplier-report-service.ts, which passes already-fetched
// supplier rows and query results in as plain arguments. Mirrors
// customer-reports.ts exactly, minus the Over Limit concept (Supplier has
// no creditLimit field).

/** `openingBalance`, signed debit-positive by `openingBalanceType` — duplicated locally rather than imported, matching this codebase's own per-module convention (see voucher-queries.ts's identical helper). */
function signedOpening(openingBalance: number, openingBalanceType: BalanceType): number {
  return openingBalanceType === "DEBIT" ? openingBalance : -openingBalance;
}

/** "PURCHASE" -> "Purchase Voucher", "DEBIT_NOTE" -> "Debit Note Voucher". */
function humanizeVoucherType(voucherType: VoucherType): string {
  const words = voucherType
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `${words.join(" ")} Voucher`;
}

/**
 * Business Rules #1 — joins `getTrialBalance`'s own per-ledger rows to each
 * Supplier's `ledgerId`. `getTrialBalance` already lists every ledger in the
 * company (its own documented contract), so every supplier is expected to
 * find a match; the `signedOpening` fallback below only guards the
 * defensive case where one somehow doesn't (never treated as zero, per the
 * spec's own "don't invent a default" posture). No Over Limit flag —
 * `Supplier` has no `creditLimit` field (see 72-supplier-reports.md's Goal).
 */
export function buildSupplierOutstandingReport(
  trialBalance: TrialBalanceResult,
  suppliers: readonly SupplierReportRow[]
): SupplierOutstandingReport {
  const trialBalanceRowByLedgerId = new Map(trialBalance.rows.map((row) => [row.ledgerId, row]));

  const rows = suppliers.map((supplier) => {
    const matchedRow = trialBalanceRowByLedgerId.get(supplier.ledgerId);
    const outstandingBalance = matchedRow
      ? matchedRow.closingBalance
      : signedOpening(supplier.openingBalance, supplier.openingBalanceType);

    return {
      supplierId: supplier.id,
      supplierName: supplier.displayName,
      outstandingBalance,
      creditDays: supplier.creditDays,
    };
  });

  return { rows };
}

/**
 * Business Rules #2 — `getLedgerStatement`'s own dated lines, split into
 * separate Debit/Credit columns for presentation (the engine's own
 * `LedgerStatementLine` carries a single signed `entryType`+`amount` pair).
 * `voucherNumber`/`voucherType` are already present on each line, so no
 * document-number lookup is needed here.
 */
export function buildSupplierStatement(
  supplier: { id: string; displayName: string },
  statement: LedgerStatementResult
): SupplierStatementReport {
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
    supplierId: supplier.id,
    supplierName: supplier.displayName,
    openingBalance: statement.openingBalance,
    lines,
    closingBalance: statement.closingBalance,
  };
}

/**
 * Business Rules #3 — reuses `purchaseInvoiceService.getPartyWisePurchaseReport`'s
 * (spec 69) raw aggregate rows and `purchase-reports.ts`'s own
 * `buildPartyWisePurchaseReport` unmodified. No synthetic-bucket filtering
 * needed, unlike buildCustomerSalesSummary — every Purchase Invoice has a
 * required, non-null `supplierId` (spec 44's own Decisions), so
 * `getPartyWisePurchaseReport`'s own output already contains no Walk-in/
 * Quick-equivalent rows to exclude. No new aggregation logic, no second
 * independent query.
 */
export function buildSupplierPurchaseSummary(rawRows: readonly PartyWisePurchaseAggregateRow[]): PartyWisePurchaseReport {
  return buildPartyWisePurchaseReport(rawRows);
}

/** Business Rules #4 — a straightforward presentation of the Supplier rows already fetched. */
export function buildSupplierDirectory(suppliers: readonly SupplierReportRow[]): SupplierDirectoryReport {
  const rows = suppliers.map((supplier) => ({
    id: supplier.id,
    displayName: supplier.displayName,
    mobileNumber: supplier.mobileNumber,
    gstin: supplier.gstin,
    city: supplier.city,
    state: supplier.state,
    creditDays: supplier.creditDays,
    isActive: supplier.isActive,
  }));

  return { rows };
}

type SupplierStatementExportRow = Record<string, string | number | Date | null>;

const SUPPLIER_STATEMENT_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "date", header: "Date", type: "date" },
  { key: "voucherType", header: "Voucher Type", type: "string" },
  { key: "voucherNumber", header: "Voucher Number", type: "string" },
  { key: "narration", header: "Narration", type: "string" },
  { key: "debit", header: "Debit", type: "currency" },
  { key: "credit", header: "Credit", type: "currency" },
  { key: "runningBalance", header: "Running Balance", type: "currency" },
];

/**
 * Flattens `buildSupplierStatement`'s output into the single-sheet shape
 * src/lib/excel-export.ts's shared contract understands, mirroring
 * trial-balance.ts's own toTrialBalanceExportTable/balance-sheet.ts's
 * toBalanceSheetExportTable pattern. An "Opening Balance" row is prepended
 * (mirroring the Statement screen's own render) and a synthetic "Closing
 * Balance" row is used as the sheet's totals footer — both figures copied
 * straight from `report.openingBalance`/`report.closingBalance`, never
 * re-derived from the lines below.
 */
export function toSupplierStatementExportTable(report: SupplierStatementReport): ReportExportTable[] {
  const openingRow: SupplierStatementExportRow = {
    date: null,
    voucherType: "",
    voucherNumber: "",
    narration: "Opening Balance",
    debit: null,
    credit: null,
    runningBalance: report.openingBalance,
  };

  const lineRows: SupplierStatementExportRow[] = report.lines.map((line) => ({
    date: line.voucherDate,
    voucherType: line.voucherTypeLabel,
    voucherNumber: line.voucherNumber,
    narration: line.narration ?? "",
    debit: line.debit,
    credit: line.credit,
    runningBalance: line.runningBalance,
  }));

  return [
    {
      sheetName: "Supplier Statement",
      title: report.supplierName,
      columns: SUPPLIER_STATEMENT_EXPORT_COLUMNS,
      rows: [openingRow, ...lineRows],
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

type SupplierOutstandingExportRow = Record<string, string | number | null>;

const SUPPLIER_OUTSTANDING_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "supplierName", header: "Supplier", type: "string" },
  { key: "outstandingBalance", header: "Outstanding Balance", type: "currency" },
  { key: "creditDays", header: "Credit Days", type: "number" },
];

/**
 * Flattens buildSupplierOutstandingReport's flat row list into the
 * single-sheet shape src/lib/excel-export.ts's shared contract understands,
 * mirroring the on-screen SupplierOutstandingTable's own column set exactly.
 * No totals footer — that table renders no footer row for this report.
 */
export function toSupplierOutstandingExportTable(report: SupplierOutstandingReport): ReportExportTable[] {
  const rows: SupplierOutstandingExportRow[] = report.rows.map((row) => ({
    supplierName: row.supplierName,
    outstandingBalance: row.outstandingBalance,
    creditDays: row.creditDays,
  }));

  return [
    {
      sheetName: "Supplier Outstanding",
      columns: SUPPLIER_OUTSTANDING_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type SupplierDirectoryExportRow = Record<string, string | number | null>;

const SUPPLIER_DIRECTORY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "displayName", header: "Name", type: "string" },
  { key: "mobileNumber", header: "Mobile", type: "string" },
  { key: "gstin", header: "GSTIN", type: "string" },
  { key: "creditDays", header: "Credit Days", type: "number" },
  { key: "cityState", header: "City / State", type: "string" },
  { key: "status", header: "Status", type: "string" },
];

/**
 * Flattens buildSupplierDirectory's flat row list into the single-sheet
 * shape src/lib/excel-export.ts's shared contract understands, mirroring the
 * on-screen SupplierDirectoryTable's own column set exactly — including its
 * combined "City / State" column and `isActive` -> Active/Inactive label
 * (SupplierStatusBadge's own text). No totals footer — that table renders no
 * footer row for this report.
 */
export function toSupplierDirectoryExportTable(report: SupplierDirectoryReport): ReportExportTable[] {
  const rows: SupplierDirectoryExportRow[] = report.rows.map((row) => ({
    displayName: row.displayName,
    mobileNumber: row.mobileNumber ?? "",
    gstin: row.gstin ?? "",
    creditDays: row.creditDays,
    cityState: [row.city, row.state].filter(Boolean).join(", "),
    status: row.isActive ? "Active" : "Inactive",
  }));

  return [
    {
      sheetName: "Supplier Directory",
      columns: SUPPLIER_DIRECTORY_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type SupplierPurchaseSummaryExportRow = Record<string, string | number | null>;

const SUPPLIER_PURCHASE_SUMMARY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "supplierName", header: "Supplier", type: "string" },
  { key: "invoiceCount", header: "Invoice Count", type: "number" },
  { key: "taxableAmount", header: "Taxable Value", type: "currency" },
  { key: "totalTax", header: "Total Tax", type: "currency" },
  { key: "grandTotal", header: "Grand Total", type: "currency" },
];

/**
 * Flattens buildSupplierPurchaseSummary's `PartyWisePurchaseReport` rows into
 * the single-sheet shape src/lib/excel-export.ts's shared contract
 * understands, mirroring the on-screen PartyWisePurchaseTable's own column
 * set exactly. `totals` is copied straight from `report.totals`, never
 * re-summed. Deliberately self-contained — does not import from
 * purchase-reports.ts, matching this codebase's own established
 * small-duplication convention (see signedOpening/humanizeVoucherType
 * above): the Purchase module's own Party-wise Purchase Report screen gets
 * its own, independently-added export function for this same
 * PartyWisePurchaseReport type.
 */
export function toSupplierPurchaseSummaryExportTable(report: PartyWisePurchaseReport): ReportExportTable[] {
  const rows: SupplierPurchaseSummaryExportRow[] = report.rows.map((row) => ({
    supplierName: row.supplierName,
    invoiceCount: row.invoiceCount,
    taxableAmount: row.taxableAmount,
    totalTax: row.totalTax,
    grandTotal: row.grandTotal,
  }));

  return [
    {
      sheetName: "Supplier Purchase Summary",
      columns: SUPPLIER_PURCHASE_SUMMARY_EXPORT_COLUMNS,
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
