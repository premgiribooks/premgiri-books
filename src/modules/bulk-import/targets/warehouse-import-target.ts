import { createWarehouseSchema, type CreateWarehouseInput } from "@/modules/warehouses/validation/warehouse-schema";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell } from "@/modules/bulk-import/targets/import-cell-parsers";
import { resolveBranchByName } from "@/modules/bulk-import/targets/resolve-branch";

export const WAREHOUSE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Warehouse Name", required: true, example: "Main Warehouse" },
  { key: "code", header: "Warehouse Code", required: true, example: "WH-MAIN" },
  { key: "branch", header: "Branch", required: false, example: "" },
  { key: "address", header: "Address", required: false, example: "" },
  { key: "contactNumber", header: "Contact Number", required: false, example: "" },
];

export const warehouseImportTarget: ImportTarget<CreateWarehouseInput> = {
  key: "warehouses",
  label: "Warehouses",
  columns: WAREHOUSE_IMPORT_COLUMNS,

  async resolveRow(rawRow, companyId, cache): Promise<ResolvedRowResult<CreateWarehouseInput>> {
    const errors: string[] = [];

    const branchId = await resolveBranchByName(getOptionalCell(rawRow, "branch"), companyId, cache, errors);

    const candidate = {
      name: getCell(rawRow, "name"),
      code: getCell(rawRow, "code"),
      branchId,
      address: getOptionalCell(rawRow, "address"),
      contactNumber: getOptionalCell(rawRow, "contactNumber"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createWarehouseSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const warehouse = await warehouseService.createWarehouse(resolvedInput);
    return { id: warehouse.id };
  },
};
