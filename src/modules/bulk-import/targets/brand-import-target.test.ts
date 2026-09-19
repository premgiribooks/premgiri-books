import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrandMock } = vi.hoisted(() => ({
  createBrandMock: vi.fn(),
}));

vi.mock("@/modules/brands/services/brand-service", () => ({
  brandService: { createBrand: createBrandMock },
}));

import { brandImportTarget } from "./brand-import-target";

const COMPANY_A = "company-a";

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Premgiri",
    ...overrides,
  };
}

describe("brandImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a valid row through the brand create schema", async () => {
    const result = await brandImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.name).toBe("Premgiri");
      expect(result.input.description).toBeUndefined();
    }
  });

  it("passes through the optional description column", async () => {
    const result = await brandImportTarget.resolveRow(baseRow({ description: "Paint manufacturer" }), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.description).toBe("Paint manufacturer");
    }
  });

  it("surfaces the target's own schema errors (e.g. a too-short name)", async () => {
    const result = await brandImportTarget.resolveRow(baseRow({ name: "A" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/at least 2 characters/);
    }
  });
});

describe("brandImportTarget.createRow", () => {
  it("is a thin pass-through to brandService.createBrand", async () => {
    createBrandMock.mockResolvedValue({ id: "brand-1" });

    const result = await brandImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await brandImportTarget.createRow(result.input);

    expect(createBrandMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "brand-1" });
  });
});
