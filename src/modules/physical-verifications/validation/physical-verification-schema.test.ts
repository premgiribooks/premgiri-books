import { describe, expect, it } from "vitest";

import {
  createPhysicalVerificationSchema,
  isValidCalendarDate,
  toUtcDate,
} from "@/modules/physical-verifications/validation/physical-verification-schema";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const WAREHOUSE_ID = "22222222-2222-4222-8222-222222222222";

function line(overrides: Record<string, unknown> = {}) {
  return { productId: PRODUCT_ID, countedQuantity: 10, ...overrides };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return { verificationDate: "2026-09-11", warehouseId: WAREHOUSE_ID, lines: [line()], ...overrides };
}

describe("isValidCalendarDate / toUtcDate", () => {
  it("accepts a valid calendar date", () => {
    expect(isValidCalendarDate("2026-09-11")).toBe(true);
  });

  it("rejects an invalid calendar date", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });

  it("converts to a UTC-midnight Date", () => {
    expect(toUtcDate("2026-09-11").toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });
});

describe("createPhysicalVerificationSchema", () => {
  it("accepts a minimal valid single-line input", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects an empty lines array", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput({ lines: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid warehouseId", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput({ warehouseId: "not-a-uuid" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid verificationDate", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput({ verificationDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative countedQuantity", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput({ lines: [line({ countedQuantity: -1 })] }));
    expect(result.success).toBe(false);
  });

  // Zero is a legal count ("found none") — distinct from Stock
  // Adjustment/Transfer's strictly-positive quantity lines.
  it("accepts a zero countedQuantity", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput({ lines: [line({ countedQuantity: 0 })] }));
    expect(result.success).toBe(true);
  });

  it("rejects narration longer than 500 characters", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput({ narration: "a".repeat(501) }));
    expect(result.success).toBe(false);
  });

  it("transforms an empty narration to undefined", () => {
    const result = createPhysicalVerificationSchema.safeParse(validInput({ narration: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.narration).toBeUndefined();
    }
  });

  // 49-physical-verification.md's Validation: a client-submitted
  // systemQuantity/varianceQuantity is never accepted on the write path —
  // z.object() strips unknown keys, so they are ignored, not merely
  // rejected as an error.
  it("strips a client-supplied systemQuantity/varianceQuantity from a line", () => {
    const result = createPhysicalVerificationSchema.safeParse(
      validInput({ lines: [line({ systemQuantity: 999, varianceQuantity: 989 })] })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines[0]).not.toHaveProperty("systemQuantity");
      expect(result.data.lines[0]).not.toHaveProperty("varianceQuantity");
    }
  });

  it("accepts multiple lines", () => {
    const result = createPhysicalVerificationSchema.safeParse(
      validInput({ lines: [line(), line({ countedQuantity: 0 })] })
    );
    expect(result.success).toBe(true);
  });
});
