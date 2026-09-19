import { z } from "zod";

import type { BulkImportTargetKey } from "@/types/bulk-import";

export const BULK_IMPORT_TARGET_VALUES = ["products", "customers", "suppliers"] as const satisfies readonly BulkImportTargetKey[];

// 76-excel-import.md's Business Rules: "A hard cap of 1,000 rows per file in
// v1" — keeps the whole upload -> preview -> commit cycle synchronous within
// one request/response cycle (no background job queue exists in this
// codebase).
export const MAX_IMPORT_ROWS = 1000;

const ALLOWED_IMPORT_EXTENSIONS = [".xlsx", ".csv"] as const;

/**
 * Defense-in-depth against a decompression/parse-cost DoS: `.xlsx` is a zip
 * container, so a small file can still expand considerably during parsing —
 * this bounds the cost independently of Next's own (unrelated,
 * globally-configurable) Server Action body-size default, per the security
 * review's recommendation.
 */
export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Extension-based, not MIME-based — browsers report wildly inconsistent MIME types for `.csv` across OS/browser combinations. */
export function isAllowedImportFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_IMPORT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function isCsvFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith(".csv");
}

export const bulkImportUploadRequestSchema = z.object({
  target: z.enum(BULK_IMPORT_TARGET_VALUES, "Select a valid import target"),
});

export type BulkImportUploadRequest = z.infer<typeof bulkImportUploadRequestSchema>;

// commitImportAction/downloadErrorReportAction take a client-supplied `rows`
// array directly (round-tripped from the earlier preview step) — this is
// only ever a TypeScript type at the source level, which is erased at
// runtime for a Server Action invoked over the network, so it is validated
// here rather than trusted (security review finding: an unvalidated cell
// value could otherwise throw an uncaught TypeError deep inside
// resolveRow's own `.trim()` calls).
export const parsedImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  row: z.record(z.string(), z.string()),
});

export const parsedImportRowsSchema = z.array(parsedImportRowSchema).max(MAX_IMPORT_ROWS);
