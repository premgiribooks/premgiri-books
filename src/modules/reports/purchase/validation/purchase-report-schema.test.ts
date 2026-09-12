import { describe, expect, it } from "vitest";

import {
  itemWisePurchaseFiltersSchema,
  partyWisePurchaseFiltersSchema,
  purchaseRegisterFiltersSchema,
  purchaseReturnSummaryFiltersSchema,
} from "@/modules/reports/purchase/validation/purchase-report-schema";

const SUPPLIER_ID = "11111111-1111-4111-8111-111111111111";

describe("purchaseRegisterFiltersSchema", () => {
  it("accepts a valid filter set and defaults status to POSTED", () => {
    const result = purchaseRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("POSTED");
    }
  });

  it("accepts an explicit non-default status override", () => {
    const result = purchaseRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30", status: "DRAFT" });
    expect(result.success).toBe(true);
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = purchaseRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = purchaseRegisterFiltersSchema.safeParse({ dateFrom: "01-04-2026", dateTo: "2026-04-30" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid supplierId", () => {
    const result = purchaseRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30", supplierId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty range (dateTo === dateFrom)", () => {
    const result = purchaseRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-01" });
    expect(result.success).toBe(true);
  });
});

describe("itemWisePurchaseFiltersSchema", () => {
  it("accepts a valid filter set with every optional field", () => {
    const result = itemWisePurchaseFiltersSchema.safeParse({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      productId: SUPPLIER_ID,
      warehouseId: SUPPLIER_ID,
      supplierId: SUPPLIER_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = itemWisePurchaseFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });
});

describe("partyWisePurchaseFiltersSchema", () => {
  it("accepts a bare date-range filter set (no other filters exist for this view)", () => {
    const result = partyWisePurchaseFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(result.success).toBe(true);
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = partyWisePurchaseFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });
});

describe("purchaseReturnSummaryFiltersSchema", () => {
  it("accepts a valid filter set and defaults status to POSTED", () => {
    const result = purchaseReturnSummaryFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("POSTED");
    }
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = purchaseReturnSummaryFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid supplierId", () => {
    const result = purchaseReturnSummaryFiltersSchema.safeParse({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      supplierId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
