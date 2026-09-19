import { createBrandSchema, type CreateBrandInput } from "@/modules/brands/validation/brand-schema";
import { brandService } from "@/modules/brands/services/brand-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell } from "@/modules/bulk-import/targets/import-cell-parsers";

export const BRAND_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Brand Name", required: true, example: "Premgiri" },
  { key: "description", header: "Description", required: false, example: "" },
];

export const brandImportTarget: ImportTarget<CreateBrandInput> = {
  key: "brands",
  label: "Brands",
  columns: BRAND_IMPORT_COLUMNS,

  async resolveRow(rawRow): Promise<ResolvedRowResult<CreateBrandInput>> {
    const candidate = {
      name: getCell(rawRow, "name"),
      description: getOptionalCell(rawRow, "description"),
    };

    const parsed = createBrandSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const brand = await brandService.createBrand(resolvedInput);
    return { id: brand.id };
  },
};
