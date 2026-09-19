import { createHsnCodeSchema, type CreateHsnCodeInput } from "@/modules/hsn-codes/validation/hsn-code-schema";
import { hsnCodeService } from "@/modules/hsn-codes/services/hsn-code-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell } from "@/modules/bulk-import/targets/import-cell-parsers";

export const HSN_CODE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "code", header: "Code", required: true, example: "3208" },
  { key: "codeType", header: "Code Type (HSN/SAC)", required: true, example: "HSN" },
  { key: "description", header: "Description", required: true, example: "Paints and varnishes" },
];

export const hsnCodeImportTarget: ImportTarget<CreateHsnCodeInput> = {
  key: "hsn-codes",
  label: "HSN Codes",
  columns: HSN_CODE_IMPORT_COLUMNS,

  async resolveRow(rawRow): Promise<ResolvedRowResult<CreateHsnCodeInput>> {
    const candidate = {
      code: getCell(rawRow, "code"),
      codeType: getCell(rawRow, "codeType").toUpperCase(),
      description: getCell(rawRow, "description"),
    };

    const parsed = createHsnCodeSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const hsnCode = await hsnCodeService.createHsnCode(resolvedInput);
    return { id: hsnCode.id };
  },
};
