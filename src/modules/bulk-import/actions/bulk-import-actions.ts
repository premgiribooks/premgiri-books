"use server";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import {
  bulkImportService,
  type ParsedRow,
} from "@/modules/bulk-import/services/bulk-import-service";
import {
  bulkImportUploadRequestSchema,
  isAllowedImportFilename,
  MAX_IMPORT_FILE_SIZE_BYTES,
  parsedImportRowsSchema,
} from "@/modules/bulk-import/validation/bulk-import-schema";
import { runAction } from "@/lib/run-action";
import type { ImportColumn, ImportPreviewResult, ImportReport } from "@/types/bulk-import";
import type { ActionResult } from "@/types/api";

const TARGET_LIST_PATH: Record<string, string> = {
  products: "/masters/products",
  customers: "/masters/customers",
  suppliers: "/masters/suppliers",
};

export interface UploadAndPreviewResult {
  columns: ImportColumn[];
  rows: ParsedRow[];
  preview: ImportPreviewResult;
}

/**
 * Upload + dry-run preview in one step — zero writes (76-excel-import.md's
 * two-phase flow). Gated on `masters`/`create` directly here, not only via
 * each target's own `createRow` (which is never reached during preview) —
 * otherwise a user with no create permission could still preview an import,
 * which this spec never intends to allow.
 */
export async function uploadAndPreviewAction(formData: FormData): Promise<ActionResult<UploadAndPreviewResult>> {
  return runAction(async () => {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const { target: targetKey } = bulkImportUploadRequestSchema.parse({ target: formData.get("target") });

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("Select a file to upload.");
    }
    if (!isAllowedImportFilename(file.name)) {
      throw new AppError("Only .xlsx or .csv files can be imported.");
    }
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      throw new AppError(`This file is larger than ${MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    const target = bulkImportService.getImportTarget(targetKey);
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await bulkImportService.parseImportFile(target, buffer, file.name);
    const preview = await bulkImportService.previewImport(target, rows, user.companyId);

    return { columns: target.columns, rows, preview };
  }, []);
}

/**
 * Creates every still-valid row (re-resolved, not trusted from the preview
 * step) and returns the final Import Report. Row-by-row, never an
 * all-or-nothing transaction (76-excel-import.md's Business Rules).
 */
export async function commitImportAction(
  targetKey: string,
  rows: ParsedRow[]
): Promise<ActionResult<ImportReport>> {
  return runAction(async () => {
    const { target: validatedKey } = bulkImportUploadRequestSchema.parse({ target: targetKey });
    // `rows` is a Server Action argument reachable directly over the network
    // (not only via the upload/preview step) — its TypeScript type is
    // erased at runtime, so both its shape (never trust an unvalidated cell
    // value) and the 1,000-row cap are re-validated here rather than
    // assumed (security review finding).
    const validatedRows = parsedImportRowsSchema.parse(rows);
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const target = bulkImportService.getImportTarget(validatedKey);
    return bulkImportService.commitImport(target, validatedRows, user.companyId);
  }, [TARGET_LIST_PATH[targetKey] ?? "/"]);
}

export interface DownloadableFile {
  base64: string;
  filename: string;
}

/**
 * The error report's content only exists in the client's hands (the just-
 * returned Import Report — 76-excel-import.md deliberately persists no
 * import history to re-fetch it from), so generating its `.xlsx` needs one
 * more server round-trip. Returned as base64 since a Server Action can't
 * hand back a raw file download the way a Route Handler can — the client
 * decodes it into a Blob and triggers the save itself.
 */
export async function downloadErrorReportAction(
  targetKey: string,
  report: ImportReport
): Promise<ActionResult<DownloadableFile>> {
  return runAction(async () => {
    const { target: validatedKey } = bulkImportUploadRequestSchema.parse({ target: targetKey });
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const target = bulkImportService.getImportTarget(validatedKey);
    const buffer = await bulkImportService.buildImportErrorReport(target, report);
    return { base64: buffer.toString("base64"), filename: `${target.label}-import-errors.xlsx` };
  }, []);
}
