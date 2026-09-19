import { createGstRateSchema, type CreateGstRateInput } from "@/modules/gst-rates/validation/gst-rate-schema";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell, parseOptionalNumber, parseRequiredNumber } from "@/modules/bulk-import/targets/import-cell-parsers";

// GST Rate has no natural-key references to another master — resolveRow is
// just cell-parsing through the master's own existing Zod create schema, the
// same shape as product-import-target.ts minus any lookups.
export const GST_RATE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Name", required: true, example: "GST 18%" },
  { key: "ratePercent", header: "Rate Percent", required: true, example: "18" },
  { key: "cessPercent", header: "Cess Percent", required: false, example: "" },
  { key: "description", header: "Description", required: false, example: "" },
];

export const gstRateImportTarget: ImportTarget<CreateGstRateInput> = {
  key: "gst-rates",
  label: "GST Rates",
  columns: GST_RATE_IMPORT_COLUMNS,

  async resolveRow(rawRow): Promise<ResolvedRowResult<CreateGstRateInput>> {
    const errors: string[] = [];

    const candidate = {
      name: getCell(rawRow, "name"),
      ratePercent: parseRequiredNumber(getCell(rawRow, "ratePercent"), "Rate percent", errors),
      cessPercent: parseOptionalNumber(getOptionalCell(rawRow, "cessPercent"), "Cess percent", errors),
      description: getOptionalCell(rawRow, "description"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createGstRateSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const gstRate = await gstRateService.createGstRate(resolvedInput);
    return { id: gstRate.id };
  },
};
