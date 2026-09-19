import { brandRepository } from "@/modules/brands/repositories/brand-repository";
import { categoryRepository } from "@/modules/categories/repositories/category-repository";
import { hsnCodeRepository } from "@/modules/hsn-codes/repositories/hsn-code-repository";
import { createProductSchema, type CreateProductInput } from "@/modules/products/validation/product-schema";
import { productService } from "@/modules/products/services/product-service";
import { unitRepository } from "@/modules/units/repositories/unit-repository";
import { warehouseRepository } from "@/modules/warehouses/repositories/warehouse-repository";
import type { BulkImportResolutionCache, ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell, parseBoolean, parseOptionalNumber } from "@/modules/bulk-import/targets/import-cell-parsers";

// GST Rate and Margin Profile are deliberately excluded from the v1 import
// template — 77-excel-export.md's sibling spec (76-excel-import.md)'s own
// Resolution section enumerates exactly five natural keys for Products
// (category/brand/unit/HSN/warehouse), leaving gstRateId/marginProfileId
// unmentioned; both remain editable afterward via the existing Edit screen.
export const PRODUCT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Product Name", required: true, example: "Premium Emulsion Paint 1L" },
  { key: "productCode", header: "Product Code", required: true, example: "PEP-1L-001" },
  { key: "productType", header: "Product Type (TRADING/SERVICE/EXPENSE)", required: true, example: "TRADING" },
  { key: "unit", header: "Unit", required: true, example: "Litre" },
  { key: "barcode", header: "Barcode", required: false, example: "" },
  { key: "category", header: "Category", required: false, example: "Paints" },
  { key: "brand", header: "Brand", required: false, example: "Premgiri" },
  { key: "hsnCode", header: "HSN/SAC Code", required: false, example: "3208" },
  { key: "warehouse", header: "Warehouse", required: false, example: "Main Warehouse" },
  { key: "mrp", header: "MRP", required: false, example: "450.00" },
  { key: "sellingPrice", header: "Selling Price", required: false, example: "420.00" },
  { key: "purchasePrice", header: "Purchase Price", required: false, example: "350.00" },
  { key: "minStockLevel", header: "Min Stock Level", required: false, example: "10" },
  { key: "isBatchTracked", header: "Batch Tracked (Yes/No)", required: false, example: "No" },
  { key: "isSerialTracked", header: "Serial Tracked (Yes/No)", required: false, example: "No" },
  { key: "description", header: "Description", required: false, example: "" },
];

interface ProductLookups {
  categoryByName: Map<string, string>;
  brandByName: Map<string, string>;
  unitByName: Map<string, string>;
  hsnByCode: Map<string, string>;
  warehouseByCode: Map<string, string>;
}

function indexByLowercaseKey<T>(items: T[], keyOf: (item: T) => string, idOf: (item: T) => string): Map<string, string> {
  const index = new Map<string, string>();
  for (const item of items) {
    index.set(keyOf(item).trim().toLowerCase(), idOf(item));
  }
  return index;
}

async function getLookups(companyId: string, cache: BulkImportResolutionCache): Promise<ProductLookups> {
  const cacheKey = `products:lookups:${companyId}`;
  const cached = cache.get(cacheKey) as ProductLookups | undefined;
  if (cached) {
    return cached;
  }

  const [categories, brands, units, hsnCodes, warehouses] = await Promise.all([
    categoryRepository.findMany(companyId, { status: "active" }),
    brandRepository.findMany(companyId, { status: "active" }),
    unitRepository.findMany(companyId, { status: "active" }),
    hsnCodeRepository.findMany(companyId, { status: "active" }),
    warehouseRepository.findMany(companyId, { status: "active" }),
  ]);

  const lookups: ProductLookups = {
    categoryByName: indexByLowercaseKey(categories, (c) => c.name, (c) => c.id),
    brandByName: indexByLowercaseKey(brands, (b) => b.name, (b) => b.id),
    unitByName: indexByLowercaseKey(units, (u) => u.name, (u) => u.id),
    hsnByCode: indexByLowercaseKey(hsnCodes, (h) => h.code, (h) => h.id),
    warehouseByCode: indexByLowercaseKey(warehouses, (w) => w.code, (w) => w.id),
  };
  cache.set(cacheKey, lookups);
  return lookups;
}

function resolveOptionalReference(
  rawValue: string | undefined,
  index: Map<string, string>,
  label: string,
  errors: string[]
): string | undefined {
  if (rawValue === undefined) {
    return undefined;
  }
  const id = index.get(rawValue.trim().toLowerCase());
  if (!id) {
    errors.push(`${label} "${rawValue}" was not found.`);
    return undefined;
  }
  return id;
}

export const productImportTarget: ImportTarget<CreateProductInput> = {
  key: "products",
  label: "Products",
  columns: PRODUCT_IMPORT_COLUMNS,

  async resolveRow(rawRow, companyId, cache): Promise<ResolvedRowResult<CreateProductInput>> {
    const errors: string[] = [];
    const lookups = await getLookups(companyId, cache);

    const unitRaw = getCell(rawRow, "unit");
    let unitId: string | undefined;
    if (unitRaw === "") {
      errors.push("Unit is required.");
    } else {
      unitId = resolveOptionalReference(unitRaw, lookups.unitByName, "Unit", errors);
    }

    const candidate = {
      name: getCell(rawRow, "name"),
      productCode: getCell(rawRow, "productCode"),
      barcode: getOptionalCell(rawRow, "barcode"),
      productType: getCell(rawRow, "productType").toUpperCase(),
      categoryId: resolveOptionalReference(getOptionalCell(rawRow, "category"), lookups.categoryByName, "Category", errors),
      brandId: resolveOptionalReference(getOptionalCell(rawRow, "brand"), lookups.brandByName, "Brand", errors),
      unitId,
      hsnCodeId: resolveOptionalReference(getOptionalCell(rawRow, "hsnCode"), lookups.hsnByCode, "HSN/SAC code", errors),
      defaultWarehouseId: resolveOptionalReference(
        getOptionalCell(rawRow, "warehouse"),
        lookups.warehouseByCode,
        "Warehouse",
        errors
      ),
      mrp: parseOptionalNumber(getOptionalCell(rawRow, "mrp"), "MRP", errors),
      sellingPrice: parseOptionalNumber(getOptionalCell(rawRow, "sellingPrice"), "Selling price", errors),
      purchasePrice: parseOptionalNumber(getOptionalCell(rawRow, "purchasePrice"), "Purchase price", errors),
      minStockLevel: parseOptionalNumber(getOptionalCell(rawRow, "minStockLevel"), "Min stock level", errors),
      isBatchTracked: parseBoolean(getOptionalCell(rawRow, "isBatchTracked"), "Batch Tracked", errors),
      isSerialTracked: parseBoolean(getOptionalCell(rawRow, "isSerialTracked"), "Serial Tracked", errors),
      description: getOptionalCell(rawRow, "description"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createProductSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const product = await productService.createProduct(resolvedInput);
    return { id: product.id };
  },
};
