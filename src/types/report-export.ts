// Shared by src/lib/excel-export.ts (77-excel-export.md) and, per that
// spec's own note, by 76-excel-import.md and 78-pdf-generation.md as their
// common report-to-file contract.

export type ReportExportColumnType = "string" | "number" | "currency" | "date" | "percent";

export interface ReportExportColumn {
  key: string;
  header: string;
  type: ReportExportColumnType;
  /** Character-width hint; auto-computed from header/cell content when omitted. */
  width?: number;
  /** Defaults by type when omitted — currency/number right-align, everything else left-aligns. */
  align?: "left" | "right" | "center";
}

export interface ReportExportTable {
  /** Sanitized/truncated defensively by exportToExcelBuffer — never trust a caller to have already done so. */
  sheetName: string;
  /** Optional human-readable title row rendered above the header row. */
  title?: string;
  columns: ReportExportColumn[];
  rows: Record<string, string | number | Date | null>[];
  /** Optional footer row, rendered as the sheet's last row, keyed like `rows`. */
  totals?: Record<string, string | number | null>;
}

/** One workbook, N sheets — GSTR-1's multi-section shape drove this being an array from the start. */
export type ReportExportInput = ReportExportTable[];
