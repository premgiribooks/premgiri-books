import { describe, expect, it } from "vitest";

import {
  createProductBatchSchema,
  updateProductBatchSchema,
} from "@/modules/product-batches/validation/product-batch-schema";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function validBatch(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_ID,
    batchNumber: "B-2026-001",
    ...overrides,
  };
}

describe("createProductBatchSchema", () => {
  it("accepts a well-formed batch with no dates", () => {
    expect(createProductBatchSchema.safeParse(validBatch()).success).toBe(true);
  });

  it("trims batchNumber", () => {
    const result = createProductBatchSchema.parse(validBatch({ batchNumber: "  B-2026-001  " }));
    expect(result.batchNumber).toBe("B-2026-001");
  });

  it("requires a valid productId", () => {
    expect(createProductBatchSchema.safeParse(validBatch({ productId: "not-a-uuid" })).success).toBe(false);
  });

  it("rejects an empty batchNumber", () => {
    expect(createProductBatchSchema.safeParse(validBatch({ batchNumber: "" })).success).toBe(false);
  });

  it("rejects a batchNumber over 50 characters", () => {
    expect(createProductBatchSchema.safeParse(validBatch({ batchNumber: "B".repeat(51) })).success).toBe(false);
  });

  it("accepts well-formed manufacture and expiry dates", () => {
    expect(
      createProductBatchSchema.safeParse(
        validBatch({ manufactureDate: "2026-01-01", expiryDate: "2027-01-01" })
      ).success
    ).toBe(true);
  });

  it("rejects a malformed date (e.g. Feb 30)", () => {
    expect(
      createProductBatchSchema.safeParse(validBatch({ manufactureDate: "2026-02-30" })).success
    ).toBe(false);
  });

  it("rejects expiryDate before manufactureDate", () => {
    expect(
      createProductBatchSchema.safeParse(
        validBatch({ manufactureDate: "2027-01-01", expiryDate: "2026-01-01" })
      ).success
    ).toBe(false);
  });

  it("accepts equal manufactureDate and expiryDate", () => {
    expect(
      createProductBatchSchema.safeParse(
        validBatch({ manufactureDate: "2026-01-01", expiryDate: "2026-01-01" })
      ).success
    ).toBe(true);
  });

  it("accepts only one of the two dates present", () => {
    expect(createProductBatchSchema.safeParse(validBatch({ manufactureDate: "2026-01-01" })).success).toBe(
      true
    );
    expect(createProductBatchSchema.safeParse(validBatch({ expiryDate: "2027-01-01" })).success).toBe(true);
  });
});

describe("updateProductBatchSchema", () => {
  it("omits productId", () => {
    const result = updateProductBatchSchema.safeParse({ batchNumber: "B-2026-001" });
    expect(result.success).toBe(true);
  });

  it("still enforces the expiryDate/manufactureDate ordering", () => {
    expect(
      updateProductBatchSchema.safeParse({
        batchNumber: "B-2026-001",
        manufactureDate: "2027-01-01",
        expiryDate: "2026-01-01",
      }).success
    ).toBe(false);
  });
});
