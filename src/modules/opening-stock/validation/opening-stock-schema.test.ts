import { describe, expect, it } from "vitest";

import { isValidCalendarDate, recordOpeningStockSchema } from "@/modules/opening-stock/validation/opening-stock-schema";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID_2 = "22222222-2222-4222-8222-222222222222";
const WAREHOUSE_ID = "33333333-3333-4333-8333-333333333333";
const WAREHOUSE_ID_2 = "44444444-4444-4444-8444-444444444444";

function line(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_ID,
    warehouseId: WAREHOUSE_ID,
    quantity: 10,
    transactionDate: "2026-09-11",
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return { lines: [line()], ...overrides };
}

describe("isValidCalendarDate", () => {
  it("accepts a valid calendar date", () => {
    expect(isValidCalendarDate("2026-09-11")).toBe(true);
  });

  it("rejects a calendar date that would roll over (e.g. Feb 30)", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
  });

  it("rejects a non-date string", () => {
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });
});

describe("recordOpeningStockSchema", () => {
  it("accepts a minimal valid single-line input", () => {
    const result = recordOpeningStockSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects an empty lines array", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [line({ quantity: 0 })] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid transactionDate", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [line({ transactionDate: "not-a-date" })] }));
    expect(result.success).toBe(false);
  });

  it("accepts an omitted unitCost", () => {
    const result = recordOpeningStockSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects a negative unitCost", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [line({ unitCost: -1 })] }));
    expect(result.success).toBe(false);
  });

  it("rejects a unitCost with more than 2 decimal places", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [line({ unitCost: 12.345 })] }));
    expect(result.success).toBe(false);
  });

  it("accepts a unitCost with exactly 2 decimal places", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [line({ unitCost: 12.34 })] }));
    expect(result.success).toBe(true);
  });

  it("rejects narration longer than 500 characters", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [line({ narration: "a".repeat(501) })] }));
    expect(result.success).toBe(false);
  });

  it("transforms an empty narration string to undefined", () => {
    const result = recordOpeningStockSchema.safeParse(validInput({ lines: [line({ narration: "" })] }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines[0].narration).toBeUndefined();
    }
  });

  it("rejects two lines that share the same (productId, warehouseId) pair", () => {
    const result = recordOpeningStockSchema.safeParse(
      validInput({ lines: [line(), line({ quantity: 5 })] })
    );
    expect(result.success).toBe(false);
  });

  it("accepts two lines with different products at the same warehouse", () => {
    const result = recordOpeningStockSchema.safeParse(
      validInput({ lines: [line(), line({ productId: PRODUCT_ID_2 })] })
    );
    expect(result.success).toBe(true);
  });

  it("accepts two lines with the same product at different warehouses", () => {
    const result = recordOpeningStockSchema.safeParse(
      validInput({ lines: [line(), line({ warehouseId: WAREHOUSE_ID_2 })] })
    );
    expect(result.success).toBe(true);
  });
});
