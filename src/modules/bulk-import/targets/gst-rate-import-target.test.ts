import { beforeEach, describe, expect, it, vi } from "vitest";

const { createGstRateMock } = vi.hoisted(() => ({
  createGstRateMock: vi.fn(),
}));

vi.mock("@/modules/gst-rates/services/gst-rate-service", () => ({
  gstRateService: { createGstRate: createGstRateMock },
}));

import { gstRateImportTarget } from "./gst-rate-import-target";

const COMPANY_A = "company-a";

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "GST 18%",
    ratePercent: "18",
    ...overrides,
  };
}

describe("gstRateImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a valid row through the GST rate create schema", async () => {
    const result = await gstRateImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.name).toBe("GST 18%");
      expect(result.input.ratePercent).toBe(18);
    }
  });

  it("passes through an optional cess percent", async () => {
    const result = await gstRateImportTarget.resolveRow(baseRow({ cessPercent: "5" }), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.cessPercent).toBe(5);
    }
  });

  it("rejects a rate percent over 100 via the schema's own bounds", async () => {
    const result = await gstRateImportTarget.resolveRow(baseRow({ ratePercent: "150" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
  });

  it("rejects a blank rate percent rather than silently defaulting it — the column is required", async () => {
    const result = await gstRateImportTarget.resolveRow(baseRow({ ratePercent: "" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("Rate percent is required.");
    }
  });
});

describe("gstRateImportTarget.createRow", () => {
  it("is a thin pass-through to gstRateService.createGstRate", async () => {
    createGstRateMock.mockResolvedValue({ id: "gst-1" });

    const result = await gstRateImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await gstRateImportTarget.createRow(result.input);

    expect(createGstRateMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "gst-1" });
  });
});
