import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkImportResolutionCache } from "@/types/bulk-import";

import { productImportTarget } from "./product-import-target";

const { findManyCategoryMock, findManyBrandMock, findManyUnitMock, findManyHsnMock, findManyWarehouseMock, createProductMock } =
  vi.hoisted(() => ({
    findManyCategoryMock: vi.fn(),
    findManyBrandMock: vi.fn(),
    findManyUnitMock: vi.fn(),
    findManyHsnMock: vi.fn(),
    findManyWarehouseMock: vi.fn(),
    createProductMock: vi.fn(),
  }));

vi.mock("@/modules/categories/repositories/category-repository", () => ({
  categoryRepository: { findMany: findManyCategoryMock },
}));
vi.mock("@/modules/brands/repositories/brand-repository", () => ({
  brandRepository: { findMany: findManyBrandMock },
}));
vi.mock("@/modules/units/repositories/unit-repository", () => ({
  unitRepository: { findMany: findManyUnitMock },
}));
vi.mock("@/modules/hsn-codes/repositories/hsn-code-repository", () => ({
  hsnCodeRepository: { findMany: findManyHsnMock },
}));
vi.mock("@/modules/warehouses/repositories/warehouse-repository", () => ({
  warehouseRepository: { findMany: findManyWarehouseMock },
}));
vi.mock("@/modules/products/services/product-service", () => ({
  productService: { createProduct: createProductMock },
}));

const COMPANY_A = "company-a";

// createProductSchema's reference fields are z.uuid() — a plain "cat-1"-style
// id would fail schema validation regardless of resolution being correct, so
// every mocked master row needs a real UUID-shaped id.
const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const UNIT_ID = "33333333-3333-4333-8333-333333333333";
const HSN_ID = "44444444-4444-4444-8444-444444444444";
const WAREHOUSE_ID = "55555555-5555-4555-8555-555555555555";

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Premium Emulsion Paint 1L",
    productCode: "PEP-1L-001",
    productType: "TRADING",
    unit: "Litre",
    isBatchTracked: "No",
    isSerialTracked: "No",
    ...overrides,
  };
}

describe("productImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyCategoryMock.mockResolvedValue([{ id: CATEGORY_ID, name: "Paints" }]);
    findManyBrandMock.mockResolvedValue([{ id: BRAND_ID, name: "Premgiri" }]);
    findManyUnitMock.mockResolvedValue([{ id: UNIT_ID, name: "Litre" }]);
    findManyHsnMock.mockResolvedValue([{ id: HSN_ID, code: "3208" }]);
    findManyWarehouseMock.mockResolvedValue([{ id: WAREHOUSE_ID, code: "MAIN" }]);
  });

  function cache(): BulkImportResolutionCache {
    return new Map();
  }

  it("resolves valid natural-key codes (case-insensitively) into ids and passes the target's own Zod schema", async () => {
    const result = await productImportTarget.resolveRow(
      baseRow({ category: "paints", brand: "PREMGIRI", hsnCode: "3208", warehouse: "main" }),
      COMPANY_A,
      cache()
    );

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.categoryId).toBe(CATEGORY_ID);
      expect(result.input.brandId).toBe(BRAND_ID);
      expect(result.input.unitId).toBe(UNIT_ID);
      expect(result.input.hsnCodeId).toBe(HSN_ID);
      expect(result.input.defaultWarehouseId).toBe(WAREHOUSE_ID);
    }
  });

  it("rejects a row whose Category code does not resolve to any active company category", async () => {
    const result = await productImportTarget.resolveRow(baseRow({ category: "Nonexistent" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toEqual(['Category "Nonexistent" was not found.']);
    }
  });

  it("rejects a row with no Unit — the one required natural key for Products", async () => {
    const result = await productImportTarget.resolveRow(baseRow({ unit: "" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("Unit is required.");
    }
  });

  it("scopes every natural-key lookup to the given companyId (cross-company isolation)", async () => {
    await productImportTarget.resolveRow(baseRow(), COMPANY_A, cache());

    expect(findManyCategoryMock).toHaveBeenCalledWith(COMPANY_A, { status: "active" });
    expect(findManyBrandMock).toHaveBeenCalledWith(COMPANY_A, { status: "active" });
    expect(findManyUnitMock).toHaveBeenCalledWith(COMPANY_A, { status: "active" });
    expect(findManyHsnMock).toHaveBeenCalledWith(COMPANY_A, { status: "active" });
    expect(findManyWarehouseMock).toHaveBeenCalledWith(COMPANY_A, { status: "active" });
  });

  it("fetches each master's reference data only once per shared cache, even across many rows", async () => {
    const sharedCache = cache();
    await productImportTarget.resolveRow(baseRow(), COMPANY_A, sharedCache);
    await productImportTarget.resolveRow(baseRow({ productCode: "PEP-1L-002" }), COMPANY_A, sharedCache);

    expect(findManyCategoryMock).toHaveBeenCalledTimes(1);
    expect(findManyUnitMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the target's own Zod schema errors (e.g. a batch+serial-tracked conflict) verbatim", async () => {
    const result = await productImportTarget.resolveRow(
      baseRow({ isBatchTracked: "Yes", isSerialTracked: "Yes" }),
      COMPANY_A,
      cache()
    );

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("A product cannot be both batch-tracked and serial-tracked.");
    }
  });

  it("rejects an unresolvable Product Type before the schema even runs", async () => {
    const result = await productImportTarget.resolveRow(baseRow({ productType: "MANUFACTURING" }), COMPANY_A, cache());
    expect(result.status).toBe("invalid");
  });
});

describe("productImportTarget.createRow", () => {
  it("is a thin pass-through to productService.createProduct", async () => {
    createProductMock.mockResolvedValue({ id: "prod-1" });
    const result = await productImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await productImportTarget.createRow(result.input);

    expect(createProductMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "prod-1" });
  });
});
