import { createUnitSchema, type CreateUnitInput } from "@/modules/units/validation/unit-schema";
import { unitService } from "@/modules/units/services/unit-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell, parseRequiredNumber } from "@/modules/bulk-import/targets/import-cell-parsers";

export const UNIT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Unit Name", required: true, example: "Litre" },
  { key: "symbol", header: "Symbol", required: true, example: "L" },
  { key: "uqcCode", header: "UQC Code", required: false, example: "LTR" },
  { key: "decimalPlaces", header: "Decimal Places (0-4)", required: true, example: "2" },
  { key: "description", header: "Description", required: false, example: "" },
];

export const unitImportTarget: ImportTarget<CreateUnitInput> = {
  key: "units",
  label: "Units",
  columns: UNIT_IMPORT_COLUMNS,

  async resolveRow(rawRow): Promise<ResolvedRowResult<CreateUnitInput>> {
    const errors: string[] = [];

    const candidate = {
      name: getCell(rawRow, "name"),
      symbol: getCell(rawRow, "symbol"),
      uqcCode: getOptionalCell(rawRow, "uqcCode"),
      decimalPlaces: parseRequiredNumber(getCell(rawRow, "decimalPlaces"), "Decimal places", errors) ?? 0,
      description: getOptionalCell(rawRow, "description"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createUnitSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const unit = await unitService.createUnit(resolvedInput);
    return { id: unit.id };
  },
};
