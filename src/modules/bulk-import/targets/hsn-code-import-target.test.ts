import { beforeEach, describe, expect, it, vi } from "vitest";

const { createHsnCodeMock } = vi.hoisted(() => ({
  createHsnCodeMock: vi.fn(),
}));

vi.mock("@/modules/hsn-codes/services/hsn-code-service", () => ({
  hsnCodeService: { createHsnCode: createHsnCodeMock },
}));

import { hsnCodeImportTarget } from "./hsn-code-import-target";

const COMPANY_A = "company-a";

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    code: "3208",
    codeType: "HSN",
    description: "Paints and varnishes",
    ...overrides,
  };
}

describe("hsnCodeImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a valid HSN row through the hsn code create schema", async () => {
    const result = await hsnCodeImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.code).toBe("3208");
      expect(result.input.codeType).toBe("HSN");
    }
  });

  it("uppercases a lowercase code type before validating", async () => {
    const result = await hsnCodeImportTarget.resolveRow(baseRow({ codeType: "hsn" }), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.codeType).toBe("HSN");
    }
  });

  it("resolves a valid 6-digit SAC row", async () => {
    const result = await hsnCodeImportTarget.resolveRow(baseRow({ code: "998314", codeType: "SAC" }), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.codeType).toBe("SAC");
    }
  });

  it("rejects a SAC code with the wrong digit length via the schema's own superRefine", async () => {
    const result = await hsnCodeImportTarget.resolveRow(baseRow({ code: "1234", codeType: "SAC" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/SAC code must be exactly 6 digits/);
    }
  });

  it("surfaces the target's own schema errors (e.g. an invalid code type)", async () => {
    const result = await hsnCodeImportTarget.resolveRow(baseRow({ codeType: "GST" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
  });
});

describe("hsnCodeImportTarget.createRow", () => {
  it("is a thin pass-through to hsnCodeService.createHsnCode", async () => {
    createHsnCodeMock.mockResolvedValue({ id: "hsn-1" });

    const result = await hsnCodeImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await hsnCodeImportTarget.createRow(result.input);

    expect(createHsnCodeMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "hsn-1" });
  });
});
