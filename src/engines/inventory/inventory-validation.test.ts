import { describe, expect, it } from "vitest";

import {
  aggregateBatchOutDemand,
  aggregateOutDemand,
  batchKey,
  batchRequirementError,
  deriveSerialStatus,
  directionErrorMessage,
  hasAtMostTwoDecimals,
  hasSufficientStock,
  hasValidQuantityPrecision,
  isDirectionAllowed,
  isFutureTransactionDate,
  isValidCalendarDate,
  pairKey,
  recordMovementsInputSchema,
  serialAvailabilityError,
  serialQuantityError,
  serialRequirementError,
  stockMovementLineSchema,
  toUtcDate,
  transferStockInputSchema,
  type SerialMovementRecord,
} from "@/engines/inventory/inventory-validation";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "99999999-9999-4999-8999-999999999999";
const WAREHOUSE_A = "22222222-2222-4222-8222-222222222222";
const WAREHOUSE_B = "33333333-3333-4333-8333-333333333333";
const BATCH_A = "44444444-4444-4444-8444-444444444444";
const BATCH_B = "55555555-5555-4555-8555-555555555555";
const SERIAL_A = "66666666-6666-4666-8666-666666666666";

function validLine(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_A,
    warehouseId: WAREHOUSE_A,
    transactionType: "PURCHASE",
    direction: "IN",
    quantity: 10,
    transactionDate: "2026-07-01",
    ...overrides,
  };
}

describe("isValidCalendarDate", () => {
  it("accepts a well-formed calendar date", () => {
    expect(isValidCalendarDate("2026-07-19")).toBe(true);
  });

  it("rejects a non-YYYY-MM-DD string", () => {
    expect(isValidCalendarDate("19-07-2026")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });

  it("rejects a date that Date would silently roll over (e.g. Feb 30)", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
  });
});

describe("toUtcDate", () => {
  it("parses to UTC midnight", () => {
    const date = toUtcDate("2026-07-19");
    expect(date.toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });
});

describe("isFutureTransactionDate", () => {
  const now = new Date("2026-07-19T15:30:00.000Z");

  it("is false for a past date", () => {
    expect(isFutureTransactionDate(toUtcDate("2026-07-18"), now)).toBe(false);
  });

  it("is false for today", () => {
    expect(isFutureTransactionDate(toUtcDate("2026-07-19"), now)).toBe(false);
  });

  it("is true for a future date", () => {
    expect(isFutureTransactionDate(toUtcDate("2026-07-20"), now)).toBe(true);
  });
});

describe("hasAtMostTwoDecimals", () => {
  it("accepts whole numbers and 2-decimal values", () => {
    expect(hasAtMostTwoDecimals(100)).toBe(true);
    expect(hasAtMostTwoDecimals(18.15)).toBe(true);
  });

  it("rejects more than 2 decimal places", () => {
    expect(hasAtMostTwoDecimals(18.155)).toBe(false);
  });
});

describe("hasValidQuantityPrecision", () => {
  it("requires a whole number when decimalPlaces is 0", () => {
    expect(hasValidQuantityPrecision(5, 0)).toBe(true);
    expect(hasValidQuantityPrecision(5.5, 0)).toBe(false);
  });

  it("allows up to the unit's decimalPlaces", () => {
    expect(hasValidQuantityPrecision(5.1234, 4)).toBe(true);
    expect(hasValidQuantityPrecision(5.12345, 4)).toBe(false);
  });

  it("allows 2-decimal quantities for a 2-decimal unit", () => {
    expect(hasValidQuantityPrecision(5.25, 2)).toBe(true);
    expect(hasValidQuantityPrecision(5.255, 2)).toBe(false);
  });
});

describe("type/direction matrix", () => {
  const cases: Array<[string, "IN" | "OUT", boolean]> = [
    ["OPENING_STOCK", "IN", true],
    ["OPENING_STOCK", "OUT", false],
    ["PURCHASE", "IN", true],
    ["PURCHASE", "OUT", false],
    ["PURCHASE_RETURN", "OUT", true],
    ["PURCHASE_RETURN", "IN", false],
    ["SALES", "OUT", true],
    ["SALES", "IN", false],
    ["SALES_RETURN", "IN", true],
    ["SALES_RETURN", "OUT", false],
    ["ADJUSTMENT", "IN", true],
    ["ADJUSTMENT", "OUT", true],
    ["PHYSICAL_VERIFICATION", "IN", true],
    ["PHYSICAL_VERIFICATION", "OUT", true],
    ["TRANSFER", "IN", false],
    ["TRANSFER", "OUT", false],
  ];

  it.each(cases)("%s + %s -> allowed=%s", (transactionType, direction, expected) => {
    expect(isDirectionAllowed(transactionType as never, direction)).toBe(expected);
  });

  it("gives a TRANSFER-specific message pointing at transferStock", () => {
    expect(directionErrorMessage("TRANSFER")).toMatch(/transferStock/);
  });

  it("gives a type-specific message naming the allowed direction(s)", () => {
    expect(directionErrorMessage("SALES")).toBe("SALES movements must be OUT.");
    expect(directionErrorMessage("ADJUSTMENT")).toBe("ADJUSTMENT movements must be IN or OUT.");
  });
});

describe("hasSufficientStock", () => {
  it("allows drawing down to exactly zero", () => {
    expect(hasSufficientStock(10, 10)).toBe(true);
  });

  it("allows sufficient stock", () => {
    expect(hasSufficientStock(10, 4)).toBe(true);
  });

  it("rejects insufficient stock", () => {
    expect(hasSufficientStock(10, 11)).toBe(false);
  });

  it("tolerates float drift at the epsilon boundary", () => {
    expect(hasSufficientStock(0.3, 0.1 + 0.2)).toBe(true);
  });
});

describe("aggregateOutDemand", () => {
  it("sums OUT quantities per (product, warehouse) pair", () => {
    const demand = aggregateOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
    ]);

    expect(demand).toEqual([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, quantity: 12 }]);
  });

  it("does not net IN lines against OUT lines in the same batch", () => {
    const demand = aggregateOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 10 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "IN", quantity: 100 },
    ]);

    expect(demand).toEqual([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, quantity: 10 }]);
  });

  it("keeps distinct (product, warehouse) pairs separate", () => {
    const demand = aggregateOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_B, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 5 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_B, direction: "OUT", quantity: 6 },
    ]);

    expect(demand).toHaveLength(3);
  });

  it("returns an empty array when there are no OUT lines", () => {
    expect(aggregateOutDemand([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "IN", quantity: 5 }])).toEqual(
      []
    );
  });
});

describe("pairKey", () => {
  it("is stable and distinct per (product, warehouse) combination", () => {
    expect(pairKey(PRODUCT_A, WAREHOUSE_A)).toBe(pairKey(PRODUCT_A, WAREHOUSE_A));
    expect(pairKey(PRODUCT_A, WAREHOUSE_A)).not.toBe(pairKey(PRODUCT_A, WAREHOUSE_B));
  });
});

describe("batchRequirementError", () => {
  it("requires a batch when the product is batch-tracked and none was supplied", () => {
    expect(batchRequirementError("Widget", true, undefined)).toMatch(/Widget/);
    expect(batchRequirementError("Widget", true, undefined)).toMatch(/batch/i);
  });

  it("allows a batch-tracked product with a batch supplied", () => {
    expect(batchRequirementError("Widget", true, BATCH_A)).toBeNull();
  });

  it("rejects a batch on a non-batch-tracked product", () => {
    expect(batchRequirementError("Widget", false, BATCH_A)).toMatch(/not batch-tracked/i);
  });

  it("allows a non-batch-tracked product with no batch supplied", () => {
    expect(batchRequirementError("Widget", false, undefined)).toBeNull();
  });
});

describe("batchKey", () => {
  it("is stable and distinct per (product, warehouse, batch) combination", () => {
    expect(batchKey(PRODUCT_A, WAREHOUSE_A, BATCH_A)).toBe(batchKey(PRODUCT_A, WAREHOUSE_A, BATCH_A));
    expect(batchKey(PRODUCT_A, WAREHOUSE_A, BATCH_A)).not.toBe(batchKey(PRODUCT_A, WAREHOUSE_A, BATCH_B));
  });

  it("never collides with a pairKey value", () => {
    expect(batchKey(PRODUCT_A, WAREHOUSE_A, BATCH_A)).not.toBe(pairKey(PRODUCT_A, WAREHOUSE_A));
  });
});

describe("aggregateBatchOutDemand", () => {
  it("sums OUT quantities per (product, warehouse, batch) triple", () => {
    const demand = aggregateBatchOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, direction: "OUT", quantity: 4 },
    ]);

    expect(demand).toEqual([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, quantity: 8 }]);
  });

  it("does not net IN lines against OUT lines", () => {
    const demand = aggregateBatchOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, direction: "OUT", quantity: 10 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, direction: "IN", quantity: 100 },
    ]);

    expect(demand).toEqual([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, quantity: 10 }]);
  });

  it("ignores lines with no batchId", () => {
    const demand = aggregateBatchOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: undefined, direction: "OUT", quantity: 10 },
    ]);

    expect(demand).toEqual([]);
  });

  it("keeps two batches of the same product/warehouse independent", () => {
    const demand = aggregateBatchOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_B, direction: "OUT", quantity: 5 },
    ]);

    expect(demand).toHaveLength(2);
  });

  it("returns an empty array when there are no OUT lines", () => {
    expect(
      aggregateBatchOutDemand([
        { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, batchId: BATCH_A, direction: "IN", quantity: 5 },
      ])
    ).toEqual([]);
  });
});

describe("stockMovementLineSchema", () => {
  it("accepts a well-formed line", () => {
    expect(stockMovementLineSchema.safeParse(validLine()).success).toBe(true);
  });

  it("rejects a zero or negative quantity", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ quantity: 0 })).success).toBe(false);
    expect(stockMovementLineSchema.safeParse(validLine({ quantity: -1 })).success).toBe(false);
  });

  it("rejects an invalid transaction date", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ transactionDate: "not-a-date" })).success).toBe(false);
  });

  it("rejects an invalid unitCost with more than 2 decimals", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ unitCost: 10.555 })).success).toBe(false);
  });

  it("requires referenceType and referenceId together, or neither", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ referenceType: "SALES_INVOICE" })).success).toBe(false);
    expect(
      stockMovementLineSchema.safeParse(
        validLine({ referenceType: "SALES_INVOICE", referenceId: PRODUCT_B })
      ).success
    ).toBe(true);
  });

  it("accepts a valid uuid batchId", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ batchId: BATCH_A })).success).toBe(true);
  });

  it("rejects a non-uuid batchId", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ batchId: "not-a-uuid" })).success).toBe(false);
  });

  it("accepts batchId omitted", () => {
    expect(stockMovementLineSchema.safeParse(validLine()).success).toBe(true);
  });

  it("accepts a valid uuid serialId", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ serialId: SERIAL_A })).success).toBe(true);
  });

  it("rejects a non-uuid serialId", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ serialId: "not-a-uuid" })).success).toBe(false);
  });
});

describe("recordMovementsInputSchema", () => {
  it("requires at least one line", () => {
    expect(recordMovementsInputSchema.safeParse([]).success).toBe(false);
  });

  it("accepts a batch of well-formed lines", () => {
    expect(recordMovementsInputSchema.safeParse([validLine(), validLine({ quantity: 5 })]).success).toBe(true);
  });
});

describe("transferStockInputSchema", () => {
  function validTransfer(overrides: Record<string, unknown> = {}) {
    return {
      productId: PRODUCT_A,
      sourceWarehouseId: WAREHOUSE_A,
      destinationWarehouseId: WAREHOUSE_B,
      quantity: 5,
      transactionDate: "2026-07-01",
      ...overrides,
    };
  }

  it("accepts a well-formed transfer", () => {
    expect(transferStockInputSchema.safeParse(validTransfer()).success).toBe(true);
  });

  it("rejects source and destination being the same warehouse", () => {
    expect(
      transferStockInputSchema.safeParse(validTransfer({ destinationWarehouseId: WAREHOUSE_A })).success
    ).toBe(false);
  });

  it("accepts a valid uuid batchId", () => {
    expect(transferStockInputSchema.safeParse(validTransfer({ batchId: BATCH_A })).success).toBe(true);
  });

  it("rejects a non-uuid batchId", () => {
    expect(transferStockInputSchema.safeParse(validTransfer({ batchId: "not-a-uuid" })).success).toBe(false);
  });

  it("accepts batchId omitted", () => {
    expect(transferStockInputSchema.safeParse(validTransfer()).success).toBe(true);
  });

  it("accepts a valid uuid serialId", () => {
    expect(transferStockInputSchema.safeParse(validTransfer({ serialId: SERIAL_A })).success).toBe(true);
  });

  it("rejects a non-uuid serialId", () => {
    expect(transferStockInputSchema.safeParse(validTransfer({ serialId: "not-a-uuid" })).success).toBe(false);
  });
});

describe("serialRequirementError", () => {
  it("requires a serial when the product is serial-tracked and none was supplied", () => {
    expect(serialRequirementError("Widget", true, undefined)).toMatch(/Widget/);
    expect(serialRequirementError("Widget", true, undefined)).toMatch(/serial/i);
  });

  it("allows a serial-tracked product with a serial supplied", () => {
    expect(serialRequirementError("Widget", true, SERIAL_A)).toBeNull();
  });

  it("rejects a serial on a non-serial-tracked product", () => {
    expect(serialRequirementError("Widget", false, SERIAL_A)).toMatch(/not serial-tracked/i);
  });

  it("allows a non-serial-tracked product with no serial supplied", () => {
    expect(serialRequirementError("Widget", false, undefined)).toBeNull();
  });
});

describe("serialQuantityError", () => {
  it("rejects a serial-tracked line with quantity other than 1", () => {
    expect(serialQuantityError("Widget", true, 2)).toMatch(/exactly 1/);
    expect(serialQuantityError("Widget", true, 0.5)).toMatch(/exactly 1/);
  });

  it("allows a serial-tracked line with quantity exactly 1", () => {
    expect(serialQuantityError("Widget", true, 1)).toBeNull();
  });

  it("ignores quantity for a non-serial-tracked product", () => {
    expect(serialQuantityError("Widget", false, 5)).toBeNull();
  });
});

describe("deriveSerialStatus", () => {
  function movement(overrides: Partial<SerialMovementRecord> = {}): SerialMovementRecord {
    return {
      direction: "IN",
      transactionType: "PURCHASE",
      warehouseId: WAREHOUSE_A,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      ...overrides,
    };
  }

  it("reports NO_MOVEMENTS for a serial with no history", () => {
    expect(deriveSerialStatus([])).toEqual({ status: "NO_MOVEMENTS", warehouseId: null });
  });

  it("reports IN_STOCK at the receiving warehouse after a single IN movement", () => {
    expect(deriveSerialStatus([movement()])).toEqual({ status: "IN_STOCK", warehouseId: WAREHOUSE_A });
  });

  it("reports SOLD after the latest movement is a SALES OUT", () => {
    const history = [
      movement({ createdAt: new Date("2026-07-01T00:00:00.000Z") }),
      movement({
        direction: "OUT",
        transactionType: "SALES",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      }),
    ];
    expect(deriveSerialStatus(history)).toEqual({ status: "SOLD", warehouseId: null });
  });

  it("reports IN_STOCK again after an IN -> OUT-sale -> IN-return sequence", () => {
    const history = [
      movement({ transactionType: "PURCHASE", createdAt: new Date("2026-07-01T00:00:00.000Z") }),
      movement({
        direction: "OUT",
        transactionType: "SALES",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      }),
      movement({
        direction: "IN",
        transactionType: "SALES_RETURN",
        warehouseId: WAREHOUSE_B,
        createdAt: new Date("2026-07-03T00:00:00.000Z"),
      }),
    ];
    expect(deriveSerialStatus(history)).toEqual({ status: "IN_STOCK", warehouseId: WAREHOUSE_B });
  });

  it("reports RETURNED after the latest movement is a PURCHASE_RETURN OUT", () => {
    const history = [
      movement({ createdAt: new Date("2026-07-01T00:00:00.000Z") }),
      movement({
        direction: "OUT",
        transactionType: "PURCHASE_RETURN",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      }),
    ];
    expect(deriveSerialStatus(history)).toEqual({ status: "RETURNED", warehouseId: null });
  });

  it("reports OUT_OF_STOCK for any other OUT transaction type", () => {
    const history = [
      movement({
        direction: "OUT",
        transactionType: "ADJUSTMENT",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ];
    expect(deriveSerialStatus(history)).toEqual({ status: "OUT_OF_STOCK", warehouseId: null });
  });

  it("resolves a tie at the same createdAt (a transferStock pair) in favor of IN", () => {
    const tiedInstant = new Date("2026-07-01T00:00:00.000Z");
    const history = [
      movement({ direction: "OUT", transactionType: "TRANSFER", warehouseId: WAREHOUSE_A, createdAt: tiedInstant }),
      movement({ direction: "IN", transactionType: "TRANSFER", warehouseId: WAREHOUSE_B, createdAt: tiedInstant }),
    ];
    expect(deriveSerialStatus(history)).toEqual({ status: "IN_STOCK", warehouseId: WAREHOUSE_B });
  });
});

describe("serialAvailabilityError", () => {
  it("allows an OUT movement when the serial is IN_STOCK at the given warehouse", () => {
    expect(
      serialAvailabilityError("SN-001", { status: "IN_STOCK", warehouseId: WAREHOUSE_A }, WAREHOUSE_A)
    ).toBeNull();
  });

  it("rejects an OUT movement when the serial is IN_STOCK at a different warehouse", () => {
    expect(
      serialAvailabilityError("SN-001", { status: "IN_STOCK", warehouseId: WAREHOUSE_A }, WAREHOUSE_B)
    ).toMatch(/not currently in stock/);
  });

  it("rejects an OUT movement when the serial is already SOLD", () => {
    expect(serialAvailabilityError("SN-001", { status: "SOLD", warehouseId: null }, WAREHOUSE_A)).toMatch(
      /not currently in stock/
    );
  });

  it("rejects an OUT movement when the serial has NO_MOVEMENTS", () => {
    expect(
      serialAvailabilityError("SN-001", { status: "NO_MOVEMENTS", warehouseId: null }, WAREHOUSE_A)
    ).toMatch(/not currently in stock/);
  });
});
