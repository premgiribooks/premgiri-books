import { createPriceListSchema, type CreatePriceListInput } from "@/modules/price-lists/validation/price-list-schema";
import { priceListService } from "@/modules/price-lists/services/price-list-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell } from "@/modules/bulk-import/targets/import-cell-parsers";

// Price List has no natural-key references to another master — resolveRow is
// just cell-parsing through the master's own existing Zod create schema, the
// same shape as gst-rate-import-target.ts. Import creates ONLY the header
// record (name/customerType/effective dates/description) — line items
// (product + selling price + min quantity) remain addable afterward via the
// existing Price List detail screen, the same "no nested details" scope as
// Products' batches/serials. effectiveFrom/effectiveTo pass through as plain
// optional strings; the schema itself validates the YYYY-MM-DD format and
// that from <= to.
export const PRICE_LIST_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Name", required: true, example: "Wholesale Price List" },
  {
    key: "customerType",
    header: "Customer Type (RETAIL/WHOLESALE/DEALER/DISTRIBUTOR)",
    required: false,
    example: "WHOLESALE",
  },
  { key: "effectiveFrom", header: "Effective From (YYYY-MM-DD)", required: false, example: "" },
  { key: "effectiveTo", header: "Effective To (YYYY-MM-DD)", required: false, example: "" },
  { key: "description", header: "Description", required: false, example: "" },
];

export const priceListImportTarget: ImportTarget<CreatePriceListInput> = {
  key: "price-lists",
  label: "Price Lists",
  columns: PRICE_LIST_IMPORT_COLUMNS,

  async resolveRow(rawRow): Promise<ResolvedRowResult<CreatePriceListInput>> {
    const customerTypeRaw = getOptionalCell(rawRow, "customerType");

    const candidate = {
      name: getCell(rawRow, "name"),
      customerType: customerTypeRaw?.toUpperCase(),
      effectiveFrom: getOptionalCell(rawRow, "effectiveFrom"),
      effectiveTo: getOptionalCell(rawRow, "effectiveTo"),
      description: getOptionalCell(rawRow, "description"),
    };

    const parsed = createPriceListSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const priceList = await priceListService.createPriceList(resolvedInput);
    return { id: priceList.id };
  },
};
