import { describe, expect, it } from "vitest";

import { createStockAdjustmentSchema, isValidCalendarDate, toUtcDate } from "@/modules/stock-adjustments/validation/stock-adjustment-schema";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const WAREHOUSE_ID = "22222222-2222-4222-8222-222222222222";

function line(overrides: Record<string, unknown> = {}) {
  return { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, direction: "IN", quantity: 10, ...overrides };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return { adjustmentDate: "2026-09-11", reason: "Quarterly shrinkage write-off", lines: [line()], ...overrides };
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

describe("createStockAdjustmentSchema", () => {
  it("accepts a minimal valid single-line input", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects an empty lines array", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ lines: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing reason", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ reason: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a reason longer than 500 characters", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ reason: "a".repeat(501) }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid adjustmentDate", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ adjustmentDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ lines: [line({ quantity: 0 })] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid direction", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ lines: [line({ direction: "SIDEWAYS" })] }));
    expect(result.success).toBe(false);
  });

  it("accepts both IN and OUT directions", () => {
    expect(createStockAdjustmentSchema.safeParse(validInput({ lines: [line({ direction: "IN" })] })).success).toBe(true);
    expect(createStockAdjustmentSchema.safeParse(validInput({ lines: [line({ direction: "OUT" })] })).success).toBe(true);
  });

  it("accepts mixed IN/OUT lines within one submission", () => {
    const result = createStockAdjustmentSchema.safeParse(
      validInput({ lines: [line({ direction: "IN" }), line({ direction: "OUT", quantity: 5 })] })
    );
    expect(result.success).toBe(true);
  });

  it("rejects narration longer than 500 characters on a line", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ lines: [line({ narration: "a".repeat(501) })] }));
    expect(result.success).toBe(false);
  });

  it("transforms an empty line narration to undefined", () => {
    const result = createStockAdjustmentSchema.safeParse(validInput({ lines: [line({ narration: "" })] }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines[0].narration).toBeUndefined();
    }
  });
});
