import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUnitMock } = vi.hoisted(() => ({
  createUnitMock: vi.fn(),
}));

vi.mock("@/modules/units/services/unit-service", () => ({
  unitService: { createUnit: createUnitMock },
}));

import { unitImportTarget } from "./unit-import-target";

const COMPANY_A = "company-a";

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Litre",
    symbol: "L",
    decimalPlaces: "2",
    ...overrides,
  };
}

describe("unitImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a valid row through the unit create schema", async () => {
    const result = await unitImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.name).toBe("Litre");
      expect(result.input.symbol).toBe("L");
      expect(result.input.decimalPlaces).toBe(2);
      expect(result.input.uqcCode).toBeUndefined();
    }
  });

  it("passes through the optional UQC code and description columns", async () => {
    const result = await unitImportTarget.resolveRow(
      baseRow({ uqcCode: "ltr", description: "Volume unit" }),
      COMPANY_A,
      new Map()
    );

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.uqcCode).toBe("LTR");
      expect(result.input.description).toBe("Volume unit");
    }
  });

  it("rejects a blank Decimal Places column rather than silently defaulting it — the column is required", async () => {
    const result = await unitImportTarget.resolveRow(baseRow({ decimalPlaces: "" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("Decimal places is required.");
    }
  });

  it("surfaces the target's own schema errors (e.g. decimal places out of range)", async () => {
    const result = await unitImportTarget.resolveRow(baseRow({ decimalPlaces: "9" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
  });
});

describe("unitImportTarget.createRow", () => {
  it("is a thin pass-through to unitService.createUnit", async () => {
    createUnitMock.mockResolvedValue({ id: "unit-1" });

    const result = await unitImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await unitImportTarget.createRow(result.input);

    expect(createUnitMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "unit-1" });
  });
});
