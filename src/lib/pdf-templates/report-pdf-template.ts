import { escapeHtml } from "@/lib/html-escape";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import type { ReportExportColumn, ReportExportColumnType, ReportExportInput, ReportExportTable } from "@/types/report-export";

// 78-pdf-generation.md's Report PDFs rule: a pure(ish) formatter of
// already-shaped ReportExportTable[] data (the exact contract
// 77-excel-export.md's exportToExcelBuffer consumes) into a printable HTML
// document. Zero business logic, zero import from src/modules/** or
// @prisma/client — a structural check the spec explicitly calls out.

/**
 * This codebase's on-screen date display convention (mirrors
 * excel-export.ts's own DATE_NUMBER_FORMAT intent, spelled out here as a
 * plain readable string rather than an Excel numFmt code, since HTML has no
 * native cell-format concept).
 */
function formatDateCell(value: Date): string {
  const day = String(value.getDate()).padStart(2, "0");
  const month = value.toLocaleString("en-US", { month: "short" });
  const year = value.getFullYear();
  return `${day}-${month}-${year}`;
}

/** A caller's `percent` value is already the display number (e.g. 18 for
 * "18%"), mirroring excel-export.ts's identical PERCENT_NUMBER_FORMAT
 * convention — never a 0-1 fraction requiring a x100 multiply. */
function formatCellValue(value: string | number | Date | null, type: ReportExportColumnType): string {
  if (value === null) {
    return "";
  }
  if (value instanceof Date) {
    return escapeHtml(formatDateCell(value));
  }
  if (typeof value === "number") {
    if (type === "currency") {
      return value.toFixed(2);
    }
    if (type === "percent") {
      return `${value.toFixed(2)}%`;
    }
    return String(value);
  }
  return escapeHtml(value);
}

function defaultAlign(type: ReportExportColumnType): "left" | "right" | "center" {
  return type === "currency" || type === "number" || type === "percent" ? "right" : "left";
}

function cellClass(column: ReportExportColumn): string {
  return (column.align ?? defaultAlign(column.type)) === "right" ? "text-right" : "";
}

function headerRowHtml(columns: ReportExportColumn[]): string {
  const cells = columns.map((column) => `<th class="${cellClass(column)}">${escapeHtml(column.header)}</th>`).join("");
  return `<thead><tr>${cells}</tr></thead>`;
}

function dataRowHtml(columns: ReportExportColumn[], row: Record<string, string | number | Date | null>): string {
  const cells = columns
    .map((column) => `<td class="${cellClass(column)}">${formatCellValue(row[column.key] ?? null, column.type)}</td>`)
    .join("");
  return `<tr>${cells}</tr>`;
}

function totalsRowHtml(columns: ReportExportColumn[], totals: Record<string, string | number | null>): string {
  const cells = columns
    .map((column) => `<td class="${cellClass(column)}">${formatCellValue(totals[column.key] ?? null, column.type)}</td>`)
    .join("");
  return `<tfoot><tr style="font-weight: 600;">${cells}</tr></tfoot>`;
}

function tableSectionHtml(table: ReportExportTable): string {
  const heading = table.title ? `<h1>${escapeHtml(table.title)}</h1>` : "";
  const bodyRows = table.rows.map((row) => dataRowHtml(table.columns, row)).join("");
  const totalsRow = table.totals ? totalsRowHtml(table.columns, table.totals) : "";

  return `<div class="section">
    ${heading}
    <table class="items-table">
      ${headerRowHtml(table.columns)}
      <tbody>${bodyRows}</tbody>
      ${totalsRow}
    </table>
  </div>`;
}

/**
 * Renders the identical `ReportExportTable[]` contract
 * `exportToExcelBuffer` (`src/lib/excel-export.ts`) consumes into a
 * self-contained, printable HTML document — one `<table>` per input table,
 * in order. GSTR-1's multi-section shape becomes multiple sequential
 * same-document sections instead of `exportToExcelBuffer`'s one-workbook-
 * many-sheets equivalent, since a PDF has no "sheet" concept
 * (78-pdf-generation.md's Report PDFs rule). Every string cell value is
 * escaped via `escapeHtml` before interpolation — a report row can contain a
 * Ledger/Customer/Supplier name entered by a user.
 */
export function buildReportHtml(tables: ReportExportInput): string {
  const sections = tables.map(tableSectionHtml).join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    ${sections}
  </body>
</html>`;
}
