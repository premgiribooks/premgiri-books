import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkImportResolutionCache } from "@/types/bulk-import";

const { findManyCategoryMock, createCategoryMock } = vi.hoisted(() => ({
  findManyCategoryMock: vi.fn(),
  createCategoryMock: vi.fn(),
}));

vi.mock("@/modules/categories/repositories/category-repository", () => ({
  categoryRepository: { findMany: findManyCategoryMock },
}));
vi.mock("@/modules/categories/services/category-service", () => ({
  categoryService: { createCategory: createCategoryMock },
}));

import { categoryImportTarget } from "./category-import-target";

const COMPANY_A = "company-a";
const PAINTS_ID = "11111111-1111-4111-8111-111111111111";

function paintsCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: PAINTS_ID,
    companyId: COMPANY_A,
    name: "Paints",
    parentCategoryId: null,
    description: null,
    isActive: true,
    ...overrides,
  };
}

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Emulsion Paints",
    ...overrides,
  };
}

describe("categoryImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function cache(): BulkImportResolutionCache {
    return new Map();
  }

  it("resolves an existing Parent Category by name, case-insensitively", async () => {
    findManyCategoryMock.mockResolvedValue([paintsCategory()]);

    const result = await categoryImportTarget.resolveRow(baseRow({ parentCategory: "paints" }), COMPANY_A, cache());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.parentCategoryId).toBe(PAINTS_ID);
    }
  });

  it("rejects an unresolvable Parent Category name with a clear error", async () => {
    findManyCategoryMock.mockResolvedValue([paintsCategory()]);

    const result = await categoryImportTarget.resolveRow(baseRow({ parentCategory: "Hardware" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/Parent Category "Hardware" was not found/);
    }
  });

  it("leaves parentCategoryId undefined when the column is left blank", async () => {
    findManyCategoryMock.mockResolvedValue([paintsCategory()]);

    const result = await categoryImportTarget.resolveRow(baseRow(), COMPANY_A, cache());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.parentCategoryId).toBeUndefined();
    }
  });

  it("fetches categories only once per shared cache across many rows", async () => {
    findManyCategoryMock.mockResolvedValue([paintsCategory()]);
    const sharedCache = cache();

    await categoryImportTarget.resolveRow(baseRow({ parentCategory: "Paints" }), COMPANY_A, sharedCache);
    await categoryImportTarget.resolveRow(
      baseRow({ name: "Distemper", parentCategory: "Paints" }),
      COMPANY_A,
      sharedCache
    );

    expect(findManyCategoryMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the target's own schema errors (e.g. a name that is too short)", async () => {
    findManyCategoryMock.mockResolvedValue([]);

    const result = await categoryImportTarget.resolveRow(baseRow({ name: "P" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
  });
});

describe("categoryImportTarget.createRow", () => {
  it("is a thin pass-through to categoryService.createCategory", async () => {
    createCategoryMock.mockResolvedValue({ id: "cat-1" });
    findManyCategoryMock.mockResolvedValue([]);

    const result = await categoryImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await categoryImportTarget.createRow(result.input);

    expect(createCategoryMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "cat-1" });
  });
});
