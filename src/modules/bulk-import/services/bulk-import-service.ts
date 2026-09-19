import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import { AppError } from "@/lib/app-error";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { customerImportTarget } from "@/modules/bulk-import/targets/customer-import-target";
import { productImportTarget } from "@/modules/bulk-import/targets/product-import-target";
import { supplierImportTarget } from "@/modules/bulk-import/targets/supplier-import-target";
import { isCsvFilename, MAX_IMPORT_ROWS } from "@/modules/bulk-import/validation/bulk-import-schema";
import type {
  BulkImportResolutionCache,
  BulkImportTargetKey,
  ImportPreviewResult,
  ImportReport,
  ImportTarget,
} from "@/types/bulk-import";

// Each target's own TInput is erased to `unknown` here — deliberately, and
// soundly: this registry (and every caller below) only ever calls a given
// target's `resolveRow` and then feeds its exact return value straight into
// that *same* target's `createRow`, never mixing a resolved input from one
// target into another's create call. TypeScript can't prove that usage
// discipline structurally (createRow's parameter is contravariant in
// TInput), so each entry is narrowed with a single explicit cast here
// instead of loosening the shared ImportTarget<TInput> contract itself.
const IMPORT_TARGETS: Record<BulkImportTargetKey, ImportTarget<unknown>> = {
  products: productImportTarget as ImportTarget<unknown>,
  customers: customerImportTarget as ImportTarget<unknown>,
  suppliers: supplierImportTarget as ImportTarget<unknown>,
};

export function getImportTarget(key: BulkImportTargetKey): ImportTarget<unknown> {
  return IMPORT_TARGETS[key];
}

export interface ParsedRow {
  rowNumber: number;
  row: Record<string, string>;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("result" in value) {
      return String(value.result ?? "");
    }
  }
  return String(value);
}

async function loadWorksheet(buffer: Buffer, filename: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  if (isCsvFilename(filename)) {
    return workbook.csv.read(Readable.from(buffer));
  }
  // exceljs's own bundled types resolve `Buffer` against an older @types/node
  // it declares as a devDependency; pnpm hoists that alongside this
  // project's own (newer, generic) @types/node, so the two "Buffer" types
  // are structurally incompatible even though both are real Node Buffers at
  // runtime (src/lib/excel-export.test.ts hits the identical mismatch).
  // @ts-expect-error — @types/node version skew, not a real type error.
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError("The uploaded file has no worksheet.");
  }
  return worksheet;
}

/**
 * Parses an uploaded `.xlsx`/`.csv` into rows keyed by the target's own
 * column `key` (never the raw header text — a header is matched
 * case-insensitively against `target.columns`, and an unrecognized column is
 * ignored rather than rejected, since a business's own source file commonly
 * carries extra columns this feature doesn't need). Enforces the 1,000-row
 * cap before any row is handed to `resolveRow` (76-excel-import.md's Business
 * Rules: fail fast, before any resolution work begins).
 */
export async function parseImportFile(
  target: ImportTarget<unknown>,
  buffer: Buffer,
  filename: string
): Promise<ParsedRow[]> {
  const worksheet = await loadWorksheet(buffer, filename);

  const headerByColumnIndex = new Map<number, string>();
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    // buildImportTemplate appends " *" to a required column's own header
    // text — stripped back off here so the template this feature itself
    // generates round-trips through its own parser unchanged.
    const headerText = cellToString(cell.value).trim().replace(/\s*\*$/, "").toLowerCase();
    const column = target.columns.find((candidate) => candidate.header.toLowerCase() === headerText);
    if (column) {
      headerByColumnIndex.set(columnNumber, column.key);
    }
  });

  const rows: ParsedRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const excelRow = worksheet.getRow(rowNumber);
    const row: Record<string, string> = {};
    let hasAnyValue = false;

    headerByColumnIndex.forEach((columnKey, columnIndex) => {
      const value = cellToString(excelRow.getCell(columnIndex).value).trim();
      row[columnKey] = value;
      if (value !== "") {
        hasAnyValue = true;
      }
    });

    if (hasAnyValue) {
      rows.push({ rowNumber, row });
    }
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError(`This file has ${rows.length} rows — the maximum per import is ${MAX_IMPORT_ROWS}. Split the file and import in batches.`);
  }

  return rows;
}

/** Zero writes — every row is only run through `resolveRow`. */
export async function previewImport(
  target: ImportTarget<unknown>,
  rows: ParsedRow[],
  companyId: string
): Promise<ImportPreviewResult> {
  const cache: BulkImportResolutionCache = new Map();
  let validCount = 0;
  let invalidCount = 0;

  const previewRows = [];
  for (const { rowNumber, row } of rows) {
    const result = await target.resolveRow(row, companyId, cache);
    if (result.status === "valid") {
      validCount += 1;
    } else {
      invalidCount += 1;
    }
    previewRows.push({
      rowNumber,
      status: result.status,
      errors: result.status === "invalid" ? result.errors : [],
      raw: row,
    });
  }

  return { validCount, invalidCount, rows: previewRows };
}

/**
 * Creates each still-valid row independently (76-excel-import.md's
 * Business Rules: row-by-row, never an all-or-nothing cross-row
 * transaction). Every row is re-resolved here rather than trusting a
 * client-echoed "this row was valid at preview time" flag — a concurrent
 * change between preview and commit (e.g. another user creating the same
 * duplicate code) must be caught, not assumed unchanged.
 */
export async function commitImport(
  target: ImportTarget<unknown>,
  rows: ParsedRow[],
  companyId: string
): Promise<ImportReport> {
  // Re-enforced here, not only in parseImportFile: commitImportAction takes
  // `rows` directly as a Server Action argument, reachable independently of
  // the upload/preview step (e.g. a scripted call bypassing the wizard UI)
  // — the 1,000-row cap must hold regardless of which path reaches this
  // function (code review finding).
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError(`This import has ${rows.length} rows — the maximum per import is ${MAX_IMPORT_ROWS}.`);
  }

  const cache: BulkImportResolutionCache = new Map();
  let createdCount = 0;
  let failedCount = 0;

  const reportRows = [];
  for (const { rowNumber, row } of rows) {
    const resolved = await target.resolveRow(row, companyId, cache);
    if (resolved.status === "invalid") {
      failedCount += 1;
      reportRows.push({ rowNumber, status: "failed" as const, error: resolved.errors.join(" "), raw: row });
      continue;
    }

    try {
      const created = await target.createRow(resolved.input);
      createdCount += 1;
      reportRows.push({ rowNumber, status: "created" as const, recordId: created.id, raw: row });
    } catch (error) {
      failedCount += 1;
      const message = error instanceof AppError ? error.message : "Could not create this row.";
      reportRows.push({ rowNumber, status: "failed" as const, error: message, raw: row });
    }
  }

  // code-standards.md's Logging section requires "Data Import" to be
  // logged — the operational audit trail 76-excel-import.md's own Data
  // Model section names as the deliberate substitute for a persisted
  // import-history table.
  logger.info(
    { target: target.key, companyId, createdCount, failedCount, totalRows: rows.length },
    "Bulk import committed"
  );

  return { createdCount, failedCount, rows: reportRows };
}

/** A blank template — the target's own column headers plus one example row, via the shared Excel Export utility. No second Excel-writing code path. */
export async function buildImportTemplate(target: ImportTarget<unknown>): Promise<Buffer> {
  return exportToExcelBuffer([
    {
      sheetName: `${target.label} Template`,
      columns: target.columns.map((column) => ({
        key: column.key,
        header: column.required ? `${column.header} *` : column.header,
        type: "string" as const,
      })),
      rows: [Object.fromEntries(target.columns.map((column) => [column.key, column.example]))],
    },
  ]);
}

/** The failed rows only, in the same column shape as the template plus an appended Error column — ready to fix and re-upload directly. */
export async function buildImportErrorReport(target: ImportTarget<unknown>, report: ImportReport): Promise<Buffer> {
  const failedRows = report.rows.filter((row) => row.status === "failed");

  return exportToExcelBuffer([
    {
      sheetName: `${target.label} Errors`,
      columns: [
        { key: "__rowNumber", header: "Row", type: "number" as const },
        ...target.columns.map((column) => ({ key: column.key, header: column.header, type: "string" as const })),
        { key: "__error", header: "Error", type: "string" as const },
      ],
      rows: failedRows.map((row) => ({
        __rowNumber: row.rowNumber,
        ...row.raw,
        __error: row.error ?? "",
      })),
    },
  ]);
}

export const bulkImportService = {
  getImportTarget,
  parseImportFile,
  previewImport,
  commitImport,
  buildImportTemplate,
  buildImportErrorReport,
};
