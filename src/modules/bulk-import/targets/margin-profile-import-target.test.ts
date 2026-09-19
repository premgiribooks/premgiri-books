import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMarginProfileMock } = vi.hoisted(() => ({
  createMarginProfileMock: vi.fn(),
}));

vi.mock("@/modules/margin-profiles/services/margin-profile-service", () => ({
  marginProfileService: { createMarginProfile: createMarginProfileMock },
}));

import { marginProfileImportTarget } from "./margin-profile-import-target";

const COMPANY_A = "company-a";

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Retail Margin Profile",
    calculationMode: "MARKUP",
    retailPercent: "20",
    wholesalePercent: "15",
    dealerPercent: "10",
    distributorPercent: "8",
    ...overrides,
  };
}

describe("marginProfileImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a valid MARKUP-mode row through the margin profile create schema", async () => {
    const result = await marginProfileImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.name).toBe("Retail Margin Profile");
      expect(result.input.calculationMode).toBe("MARKUP");
      expect(result.input.retailPercent).toBe(20);
    }
  });

  it("uppercases a lowercase calculation mode cell before validation", async () => {
    const result = await marginProfileImportTarget.resolveRow(baseRow({ calculationMode: "markup" }), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.calculationMode).toBe("MARKUP");
    }
  });

  it("rejects a MARGIN-mode row with a tier at or above 100 via the schema's own superRefine", async () => {
    const result = await marginProfileImportTarget.resolveRow(
      baseRow({ calculationMode: "MARGIN", retailPercent: "100" }),
      COMPANY_A,
      new Map()
    );

    expect(result.status).toBe("invalid");
  });

  it("allows a MARKUP-mode row with a tier at or above 100 (no such bound in that mode)", async () => {
    const result = await marginProfileImportTarget.resolveRow(
      baseRow({ calculationMode: "MARKUP", retailPercent: "150" }),
      COMPANY_A,
      new Map()
    );

    expect(result.status).toBe("valid");
  });

  it("rejects a blank required tier rather than silently defaulting it", async () => {
    const result = await marginProfileImportTarget.resolveRow(baseRow({ retailPercent: "" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("Retail percent is required.");
    }
  });
});

describe("marginProfileImportTarget.createRow", () => {
  it("is a thin pass-through to marginProfileService.createMarginProfile", async () => {
    createMarginProfileMock.mockResolvedValue({ id: "margin-1" });

    const result = await marginProfileImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await marginProfileImportTarget.createRow(result.input);

    expect(createMarginProfileMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "margin-1" });
  });
});
