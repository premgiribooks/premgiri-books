import type { GstFilingRecord } from "@prisma/client";

import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import type { GstDashboardFilingOverlay, GstDashboardMonth, GstDashboardReport, GstDashboardTrend } from "@/types/gst-dashboard";
import type { ReportExportColumn, ReportExportTable } from "@/types/report-export";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `YYYY-MM` for a line's `documentDate`, using the date's own UTC calendar fields (every source column is stored `@db.Date`, UTC-midnight). */
function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function sumTax(line: GstSupplyLine): number {
  return line.cgst + line.sgst + line.igst + line.cess;
}

function bucketByMonth(lines: readonly GstSupplyLine[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const line of lines) {
    const key = monthKey(line.documentDate);
    byMonth.set(key, (byMonth.get(key) ?? 0) + sumTax(line));
  }
  return byMonth;
}

/**
 * Pure month-bucketing over already-computed GST Engine output — 74-gst-
 * reports.md's only new logic. Sums each month's Output Tax (outward lines)
 * and Input Tax (inward lines), never re-deriving any GST figure; a month
 * with input exceeding output surfaces a negative `netLiability`, never
 * clamped to zero. A month with no lines in either array is omitted, not
 * zero-filled — no I/O, no permission checks (Reporting Engine convention).
 */
export function buildGstDashboardReport(
  outwardLines: readonly GstSupplyLine[],
  inwardLines: readonly GstSupplyLine[]
): GstDashboardTrend {
  const outputByMonth = bucketByMonth(outwardLines);
  const inputByMonth = bucketByMonth(inwardLines);

  const allMonths = new Set([...outputByMonth.keys(), ...inputByMonth.keys()]);

  const months: GstDashboardMonth[] = [...allMonths]
    .map((month) => {
      const outputTax = round2(outputByMonth.get(month) ?? 0);
      const inputTax = round2(inputByMonth.get(month) ?? 0);
      return { month, outputTax, inputTax, netLiability: round2(outputTax - inputTax) };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  return { months };
}

/** UTC month-start/month-end `Date` bounds for a `YYYY-MM` key, matching every source column's `@db.Date` (UTC-midnight) convention. */
function monthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return { start, end };
}

/**
 * Resolves each bucketed month's read-only Filed/Open overlay from the
 * period's `GstFilingRecord`s (58-gstr-1.md, read-only here) — finds the
 * record whose `[periodStart, periodEnd]` range contains the month. A
 * quarterly filer's single record spans 3 calendar months, so every month
 * inside that span resolves to the exact same record (same status/period),
 * never 3 independent flags. No matching record resolves to `status: null`
 * (not tracked), never a forced default.
 */
export function resolveMonthlyFilingStatus(
  months: readonly string[],
  filingRecords: readonly GstFilingRecord[]
): Map<string, GstDashboardFilingOverlay> {
  const overlay = new Map<string, GstDashboardFilingOverlay>();

  for (const month of months) {
    const { start, end } = monthBounds(month);
    const match = filingRecords.find(
      (record) => record.periodStart.getTime() <= start.getTime() && record.periodEnd.getTime() >= end.getTime()
    );
    overlay.set(
      month,
      match
        ? { status: match.status, periodStart: match.periodStart, periodEnd: match.periodEnd }
        : { status: null, periodStart: null, periodEnd: null }
    );
  }

  return overlay;
}

type GstTrendExportRow = Record<string, string | number | null>;
type HsnSummaryExportRow = Record<string, string | number | null>;

const GST_TREND_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "month", header: "Month", type: "string" },
  { key: "outputTax", header: "Output Tax", type: "currency" },
  { key: "inputTax", header: "Input Tax", type: "currency" },
  { key: "netLiability", header: "Net Liability", type: "currency" },
  { key: "filingStatus", header: "Filing Status", type: "string" },
];

const HSN_SUMMARY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "hsnCode", header: "HSN/SAC Code", type: "string" },
  { key: "codeType", header: "Type", type: "string" },
  { key: "description", header: "Description", type: "string" },
  { key: "ratePercent", header: "Rate %", type: "percent" },
  { key: "uqcCode", header: "UQC", type: "string" },
  { key: "quantity", header: "Total Quantity", type: "number" },
  { key: "taxableAmount", header: "Taxable Value", type: "currency" },
  { key: "cgst", header: "CGST", type: "currency" },
  { key: "sgst", header: "SGST", type: "currency" },
  { key: "igst", header: "IGST", type: "currency" },
  { key: "cess", header: "CESS", type: "currency" },
  { key: "totalAmount", header: "Total Value", type: "currency" },
];

/** Mirrors gst-trend-table.tsx's own Badge text exactly. */
function filingStatusLabel(status: GstDashboardFilingOverlay["status"]): string {
  return status === "FILED" ? "Filed" : status === "OPEN" ? "Open" : "Not tracked";
}

/**
 * Flattens the GST Dashboard's two independent views — the month-bucketed
 * trend (with its Filed/Open overlay) and the embedded HSN Summary — into
 * two sheets matching src/lib/excel-export.ts's shared contract, mirroring
 * gst-trend-table.tsx/hsn-summary-table.tsx's own column sets exactly. Both
 * totals footers are copied straight from `report.totals`/
 * `report.hsnSummary.totals`, never re-summed.
 */
export function toGstDashboardExportTable(report: GstDashboardReport): ReportExportTable[] {
  const trendRows: GstTrendExportRow[] = report.months.map((month) => ({
    month: month.month,
    outputTax: month.outputTax,
    inputTax: month.inputTax,
    netLiability: month.netLiability,
    filingStatus: filingStatusLabel(month.status),
  }));

  const hsnRows: HsnSummaryExportRow[] = report.hsnSummary.rows.map((row) => ({
    hsnCode: row.hsnCode ?? "No HSN Assigned",
    codeType: row.codeType ?? "",
    description: row.description ?? "",
    ratePercent: row.ratePercent,
    uqcCode: row.uqcCode ?? "",
    quantity: row.quantity,
    taxableAmount: row.taxableAmount,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    cess: row.cess,
    totalAmount: row.totalAmount,
  }));

  return [
    {
      sheetName: "GST Trend",
      columns: GST_TREND_EXPORT_COLUMNS,
      rows: trendRows,
      totals: {
        month: "Period Total",
        outputTax: report.totals.outputTax,
        inputTax: report.totals.inputTax,
        netLiability: report.totals.netLiability,
        filingStatus: "",
      },
    },
    {
      sheetName: "HSN Summary",
      columns: HSN_SUMMARY_EXPORT_COLUMNS,
      rows: hsnRows,
      totals: {
        hsnCode: "Period Total",
        codeType: "",
        description: "",
        ratePercent: null,
        uqcCode: "",
        quantity: null,
        taxableAmount: report.hsnSummary.totals.taxableAmount,
        cgst: report.hsnSummary.totals.cgst,
        sgst: report.hsnSummary.totals.sgst,
        igst: report.hsnSummary.totals.igst,
        cess: report.hsnSummary.totals.cess,
        totalAmount: report.hsnSummary.totals.totalAmount,
      },
    },
  ];
}
