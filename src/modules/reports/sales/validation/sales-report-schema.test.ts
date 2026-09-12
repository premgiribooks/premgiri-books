import { describe, expect, it } from "vitest";

import {
  itemWiseSalesFiltersSchema,
  partyWiseSalesFiltersSchema,
  salesRegisterFiltersSchema,
  salesReturnSummaryFiltersSchema,
} from "@/modules/reports/sales/validation/sales-report-schema";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";

describe("salesRegisterFiltersSchema", () => {
  it("accepts a valid filter set and defaults status to POSTED", () => {
    const result = salesRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("POSTED");
    }
  });

  it("accepts an explicit non-default status override", () => {
    const result = salesRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30", status: "DRAFT" });
    expect(result.success).toBe(true);
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = salesRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = salesRegisterFiltersSchema.safeParse({ dateFrom: "01-04-2026", dateTo: "2026-04-30" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid customerId", () => {
    const result = salesRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30", customerId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty range (dateTo === dateFrom)", () => {
    const result = salesRegisterFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-01" });
    expect(result.success).toBe(true);
  });
});

describe("itemWiseSalesFiltersSchema", () => {
  it("accepts a valid filter set with every optional field", () => {
    const result = itemWiseSalesFiltersSchema.safeParse({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      productId: CUSTOMER_ID,
      warehouseId: CUSTOMER_ID,
      customerId: CUSTOMER_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = itemWiseSalesFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });
});

describe("partyWiseSalesFiltersSchema", () => {
  it("accepts a bare date-range filter set (no other filters exist for this view)", () => {
    const result = partyWiseSalesFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(result.success).toBe(true);
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = partyWiseSalesFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });
});

describe("salesReturnSummaryFiltersSchema", () => {
  it("accepts a valid filter set and defaults status to POSTED", () => {
    const result = salesReturnSummaryFiltersSchema.safeParse({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("POSTED");
    }
  });

  it("rejects a dateTo before dateFrom", () => {
    const result = salesReturnSummaryFiltersSchema.safeParse({ dateFrom: "2026-04-30", dateTo: "2026-04-01" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid customerId", () => {
    const result = salesReturnSummaryFiltersSchema.safeParse({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      customerId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
