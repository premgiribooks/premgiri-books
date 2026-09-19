import { PassThrough } from "node:stream";

import ExcelJS from "exceljs";

import type { ReportExportColumn, ReportExportColumnType, ReportExportInput, ReportExportTable } from "@/types/report-export";

// 77-excel-export.md: a pure(ish — I/O-bound but domain-agnostic) format
// utility. It never imports from src/modules/** or @prisma/client, performs
// no permission check, and receives no companyId — every caller re-checks
// its own permission and supplies already-computed, already display-ready
// rows before this file is ever reached.

const MAX_SHEET_NAME_LENGTH = 31;
const FORBIDDEN_SHEET_NAME_CHARS = /[:\\/?*[\]]/g;
const MIN_AUTO_COLUMN_WIDTH = 8;
const MAX_AUTO_COLUMN_WIDTH = 60;
const AUTO_COLUMN_WIDTH_PADDING = 2;
/** Above this row count (in a single table), the streaming WorkbookWriter is used instead of the in-memory Workbook. */
const STREAMING_ROW_THRESHOLD = 5000;

const CURRENCY_NUMBER_FORMAT = "#,##0.00";
/** This codebase's existing on-screen date display convention (app-settings.ts's DD/MM/YYYY sibling, spelled out here per the spec). */
const DATE_NUMBER_FORMAT = "DD-MMM-YYYY";
/**
 * A caller's `percent` value is already the display number (e.g. 18 for
 * "18%" — this codebase's own ratePercent convention, never a 0-1 fraction),
 * so this is a literal-`%`-suffix format, not Excel's native `0.00%` (which
 * would additionally multiply the stored value by 100 and produce
 * "1800.00%" for the same input).
 */
const PERCENT_NUMBER_FORMAT = '0.00"%"';

function sanitizeSheetName(name: string): string {
  const stripped = name.replace(FORBIDDEN_SHEET_NAME_CHARS, "").trim();
  const withFallback = stripped.length > 0 ? stripped : "Sheet";
  return withFallback.slice(0, MAX_SHEET_NAME_LENGTH);
}

function defaultAlign(type: ReportExportColumnType): "left" | "right" | "center" {
  return type === "currency" || type === "number" || type === "percent" ? "right" : "left";
}

function numberFormatFor(type: ReportExportColumnType): string | undefined {
  if (type === "currency") return CURRENCY_NUMBER_FORMAT;
  if (type === "date") return DATE_NUMBER_FORMAT;
  if (type === "percent") return PERCENT_NUMBER_FORMAT;
  return undefined;
}

function cellDisplayLength(value: string | number | Date | null): number {
  if (value === null) return 0;
  if (value instanceof Date) return DATE_NUMBER_FORMAT.length;
  return String(value).length;
}

// OWASP CSV/Formula Injection: a string cell value beginning with one of
// these characters can be interpreted as a live formula (or, historically,
// a DDE payload) by Excel/LibreOffice/Sheets once the file is opened —
// exploitable here because a "string" column's values can come straight
// from user-entered data (e.g. a Ledger/LedgerGroup name, unrestricted by
// character beyond length, per security review). Prefixing with a leading
// apostrophe forces the cell to be read back as literal text.
const FORMULA_INJECTION_LEADING_CHARS = /^[=+\-@\t\r]/;

function sanitizeCellText(value: string): string {
  return FORMULA_INJECTION_LEADING_CHARS.test(value) ? `'${value}` : value;
}

function sanitizeCellValue<T extends string | number | Date | null>(value: T): T {
  return typeof value === "string" ? (sanitizeCellText(value) as T) : value;
}

function sanitizeRow<T extends Record<string, string | number | Date | null>>(row: T): T {
  const sanitized = {} as T;
  for (const key of Object.keys(row) as (keyof T)[]) {
    sanitized[key] = sanitizeCellValue(row[key]);
  }
  return sanitized;
}

function computeColumnWidth(column: ReportExportColumn, rows: ReportExportTable["rows"]): number {
  if (column.width) {
    return column.width;
  }
  const widestSample = rows.reduce((max, row) => Math.max(max, cellDisplayLength(row[column.key] ?? null)), 0);
  const computed = Math.max(column.header.length, widestSample) + AUTO_COLUMN_WIDTH_PADDING;
  return Math.min(Math.max(computed, MIN_AUTO_COLUMN_WIDTH), MAX_AUTO_COLUMN_WIDTH);
}

interface WriteTableOptions {
  /** Only true for the streaming WorkbookWriter path — each row must be explicitly flushed once written. */
  commitRows: boolean;
}

function writeTable(workbook: ExcelJS.Workbook, table: ReportExportTable, options: WriteTableOptions): void {
  const headerRowNumber = table.title ? 2 : 1;

  const worksheet = workbook.addWorksheet(sanitizeSheetName(table.sheetName), {
    views: [{ state: "frozen", ySplit: headerRowNumber }],
  });

  worksheet.columns = table.columns.map((column) => ({
    key: column.key,
    width: computeColumnWidth(column, table.rows),
    style: {
      numFmt: numberFormatFor(column.type),
      alignment: { horizontal: column.align ?? defaultAlign(column.type) },
    },
  }));

  if (table.title) {
    const titleRow = worksheet.addRow([sanitizeCellText(table.title)]);
    titleRow.font = { bold: true, size: 12 };
    if (options.commitRows) titleRow.commit();
  }

  const headerRow = worksheet.addRow(table.columns.map((column) => column.header));
  headerRow.font = { bold: true };
  if (options.commitRows) headerRow.commit();

  for (const row of table.rows) {
    const dataRow = worksheet.addRow(sanitizeRow(row));
    if (options.commitRows) dataRow.commit();
  }

  if (table.totals) {
    const totalsRow = worksheet.addRow(sanitizeRow(table.totals));
    totalsRow.font = { bold: true };
    if (options.commitRows) totalsRow.commit();
  }
}

async function buildInMemoryBuffer(tables: ReportExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const table of tables) {
    writeTable(workbook, table, { commitRows: false });
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function buildStreamingBuffer(tables: ReportExportInput): Promise<Buffer> {
  const passThrough = new PassThrough();
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);
  });

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passThrough, useStyles: true });
  for (const table of tables) {
    writeTable(workbook, table, { commitRows: true });
  }
  await workbook.commit();
  return finished;
}

/**
 * Builds an `.xlsx` file from already-computed, already display-ready
 * tabular data — one worksheet per `ReportExportTable`, in the given order.
 * No permission check, no companyId, no Prisma import: every caller
 * re-checks its own permission before invoking this (77-excel-export.md's
 * Security section).
 */
export function exportToExcelBuffer(tables: ReportExportInput): Promise<Buffer> {
  const useStreaming = tables.some((table) => table.rows.length > STREAMING_ROW_THRESHOLD);
  return useStreaming ? buildStreamingBuffer(tables) : buildInMemoryBuffer(tables);
}
