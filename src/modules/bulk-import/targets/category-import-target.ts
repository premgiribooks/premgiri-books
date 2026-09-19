import { categoryRepository } from "@/modules/categories/repositories/category-repository";
import { createCategorySchema, type CreateCategoryInput } from "@/modules/categories/validation/category-schema";
import { categoryService } from "@/modules/categories/services/category-service";
import type { BulkImportResolutionCache, ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell } from "@/modules/bulk-import/targets/import-cell-parsers";

export const CATEGORY_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Category Name", required: true, example: "Paints" },
  { key: "parentCategory", header: "Parent Category", required: false, example: "" },
  { key: "description", header: "Description", required: false, example: "" },
];

function indexByLowercaseKey<T>(items: T[], keyOf: (item: T) => string, idOf: (item: T) => string): Map<string, string> {
  const index = new Map<string, string>();
  for (const item of items) {
    index.set(keyOf(item).trim().toLowerCase(), idOf(item));
  }
  return index;
}

// Only matches against categories that already exist before this import run
// — a spreadsheet importing a parent and its own child category in the same
// file is out of scope (the child row's Parent Category cell simply won't
// resolve, failing that row with a clear error), the same "resolve against
// existing active reference data only" convention product-import-target.ts's
// own getLookups already established.
async function getCategoryByNameIndex(companyId: string, cache: BulkImportResolutionCache): Promise<Map<string, string>> {
  const cacheKey = `categories:byName:${companyId}`;
  const cached = cache.get(cacheKey) as Map<string, string> | undefined;
  if (cached) {
    return cached;
  }

  const categories = await categoryRepository.findMany(companyId, { status: "active" });
  const index = indexByLowercaseKey(categories, (category) => category.name, (category) => category.id);
  cache.set(cacheKey, index);
  return index;
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

export const categoryImportTarget: ImportTarget<CreateCategoryInput> = {
  key: "categories",
  label: "Categories",
  columns: CATEGORY_IMPORT_COLUMNS,

  async resolveRow(rawRow, companyId, cache): Promise<ResolvedRowResult<CreateCategoryInput>> {
    const errors: string[] = [];
    const categoryByName = await getCategoryByNameIndex(companyId, cache);

    const candidate = {
      name: getCell(rawRow, "name"),
      parentCategoryId: resolveOptionalReference(
        getOptionalCell(rawRow, "parentCategory"),
        categoryByName,
        "Parent Category",
        errors
      ),
      description: getOptionalCell(rawRow, "description"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createCategorySchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const category = await categoryService.createCategory(resolvedInput);
    return { id: category.id };
  },
};
