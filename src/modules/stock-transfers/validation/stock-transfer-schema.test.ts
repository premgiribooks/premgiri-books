import { describe, expect, it } from "vitest";

import { createStockTransferSchema, isValidCalendarDate, toUtcDate } from "@/modules/stock-transfers/validation/stock-transfer-schema";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_WAREHOUSE_ID = "22222222-2222-4222-8222-222222222222";
const DESTINATION_WAREHOUSE_ID = "33333333-3333-4333-8333-333333333333";

function line(overrides: Record<string, unknown> = {}) {
  return { productId: PRODUCT_ID, quantity: 10, ...overrides };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    transferDate: "2026-09-11",
    sourceWarehouseId: SOURCE_WAREHOUSE_ID,
    destinationWarehouseId: DESTINATION_WAREHOUSE_ID,
    lines: [line()],
    ...overrides,
  };
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

describe("createStockTransferSchema", () => {
  it("accepts a minimal valid single-line input", () => {
    const result = createStockTransferSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects an empty lines array", () => {
    const result = createStockTransferSchema.safeParse(validInput({ lines: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects when source and destination warehouse are the same", () => {
    const result = createStockTransferSchema.safeParse(validInput({ destinationWarehouseId: SOURCE_WAREHOUSE_ID }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["destinationWarehouseId"]);
    }
  });

  it("rejects an invalid transferDate", () => {
    const result = createStockTransferSchema.safeParse(validInput({ transferDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const result = createStockTransferSchema.safeParse(validInput({ lines: [line({ quantity: 0 })] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sourceWarehouseId", () => {
    const result = createStockTransferSchema.safeParse(validInput({ sourceWarehouseId: "not-a-uuid" }));
    expect(result.success).toBe(false);
  });

  it("accepts multiple lines", () => {
    const result = createStockTransferSchema.safeParse(
      validInput({ lines: [line(), line({ productId: DESTINATION_WAREHOUSE_ID, quantity: 5 })] })
    );
    expect(result.success).toBe(true);
  });

  it("rejects narration longer than 500 characters", () => {
    const result = createStockTransferSchema.safeParse(validInput({ narration: "a".repeat(501) }));
    expect(result.success).toBe(false);
  });

  it("transforms an empty narration to undefined", () => {
    const result = createStockTransferSchema.safeParse(validInput({ narration: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.narration).toBeUndefined();
    }
  });
});
