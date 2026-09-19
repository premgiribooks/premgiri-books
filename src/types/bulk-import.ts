// 76-excel-import.md's target-parameterized contract — one shared pipeline
// (bulk-import-service.ts) driven by a small per-target implementation
// (src/modules/bulk-import/targets/*.ts), rather than three near-duplicate
// import modules.

export type BulkImportTargetKey = "products" | "customers" | "suppliers";

export interface ImportColumn {
  key: string;
  header: string;
  required: boolean;
  /** Shown in the downloadable template's own sample row. */
  example: string;
}

export type ResolvedRowResult<TInput> =
  | { status: "valid"; input: TInput }
  | { status: "invalid"; errors: string[] };

/**
 * One target's own resolution + write logic. `resolveRow` does natural-key
 * lookup (e.g. a Category name -> id) then parses the result through the
 * target's own existing Zod create schema — it never expresses a business
 * rule of its own. `createRow` is a thin pass-through to the target's own
 * existing create service method (76-excel-import.md's Module
 * Responsibilities: "never a duplicate implementation").
 */
/**
 * Scoped to one preview/commit call (one uploaded file), never persisted or
 * shared across requests. A target's own `resolveRow` uses this to memoize
 * its natural-key reference data (e.g. every active Category/Brand/Unit) so
 * a 1,000-row file resolves with a handful of queries total, not five
 * queries per row.
 */
export type BulkImportResolutionCache = Map<string, unknown>;

export interface ImportTarget<TInput> {
  key: BulkImportTargetKey;
  label: string;
  columns: ImportColumn[];
  resolveRow(
    rawRow: Record<string, string>,
    companyId: string,
    cache: BulkImportResolutionCache
  ): Promise<ResolvedRowResult<TInput>>;
  createRow(resolvedInput: TInput): Promise<{ id: string }>;
}

export interface ImportPreviewRow {
  rowNumber: number;
  status: "valid" | "invalid";
  errors: string[];
  raw: Record<string, string>;
}

export interface ImportPreviewResult {
  validCount: number;
  invalidCount: number;
  rows: ImportPreviewRow[];
}

export interface ImportReportRow {
  rowNumber: number;
  status: "created" | "failed";
  error?: string;
  recordId?: string;
  raw: Record<string, string>;
}

export interface ImportReport {
  createdCount: number;
  failedCount: number;
  rows: ImportReportRow[];
}
