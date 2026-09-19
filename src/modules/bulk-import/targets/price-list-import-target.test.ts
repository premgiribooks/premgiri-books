import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPriceListMock } = vi.hoisted(() => ({
  createPriceListMock: vi.fn(),
}));

vi.mock("@/modules/price-lists/services/price-list-service", () => ({
  priceListService: { createPriceList: createPriceListMock },
}));

import { priceListImportTarget } from "./price-list-import-target";

const COMPANY_A = "company-a";

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Wholesale Price List",
    ...overrides,
  };
}

describe("priceListImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a header-only row with just a name through the price list create schema", async () => {
    const result = await priceListImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.name).toBe("Wholesale Price List");
      expect(result.input.customerType).toBeUndefined();
    }
  });

  it("uppercases a lowercase customer type cell before validation", async () => {
    const result = await priceListImportTarget.resolveRow(baseRow({ customerType: "wholesale" }), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.customerType).toBe("WHOLESALE");
    }
  });

  it("passes effective dates through as plain optional strings", async () => {
    const result = await priceListImportTarget.resolveRow(
      baseRow({ effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" }),
      COMPANY_A,
      new Map()
    );

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.effectiveFrom).toBe("2026-01-01");
      expect(result.input.effectiveTo).toBe("2026-12-31");
    }
  });

  it("rejects an effectiveFrom date after effectiveTo via the schema's own refine", async () => {
    const result = await priceListImportTarget.resolveRow(
      baseRow({ effectiveFrom: "2026-12-31", effectiveTo: "2026-01-01" }),
      COMPANY_A,
      new Map()
    );

    expect(result.status).toBe("invalid");
  });

  it("rejects an invalid customer type", async () => {
    const result = await priceListImportTarget.resolveRow(baseRow({ customerType: "GOVERNMENT" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
  });
});

describe("priceListImportTarget.createRow", () => {
  it("is a thin pass-through to priceListService.createPriceList (header only, no items)", async () => {
    createPriceListMock.mockResolvedValue({ id: "price-list-1" });

    const result = await priceListImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await priceListImportTarget.createRow(result.input);

    expect(createPriceListMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "price-list-1" });
  });
});
