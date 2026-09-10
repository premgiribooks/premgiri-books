import { describe, expect, it } from "vitest";

import {
  createQuotationSchema,
  isValidCalendarDate,
  quotationLineSchema,
} from "@/modules/quotations/validation/quotation-schema";

const PRODUCT_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const CUSTOMER_ID = "1a2b3c4d-5e6f-4789-8abc-def012345678";

const VALID_LINE = {
  productId: PRODUCT_ID,
  quantity: 10,
  rate: 100,
  discountPercent: 10,
  discountAmount: 50,
};

const VALID_INPUT = {
  customerId: CUSTOMER_ID,
  quotationDate: "2026-09-10",
  validUntil: "2026-09-20",
  placeOfSupplyStateCode: "27",
  narration: "Sample quotation",
  lines: [VALID_LINE],
};

describe("isValidCalendarDate", () => {
  it("accepts a real calendar date and rejects a rolled-over one", () => {
    expect(isValidCalendarDate("2026-09-10")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });
});

describe("quotationLineSchema", () => {
  it("accepts a valid line and omitted optional discount fields", () => {
    const result = quotationLineSchema.parse({
      productId: PRODUCT_ID,
      quantity: 5,
      rate: 20,
    });
    expect(result.discountPercent).toBeUndefined();
    expect(result.discountAmount).toBeUndefined();
  });

  it("rejects a non-uuid productId and a non-positive quantity", () => {
    expect(
      quotationLineSchema.safeParse({ ...VALID_LINE, productId: "not-a-uuid" }).success
    ).toBe(false);
    expect(quotationLineSchema.safeParse({ ...VALID_LINE, quantity: 0 }).success).toBe(false);
    expect(quotationLineSchema.safeParse({ ...VALID_LINE, quantity: -5 }).success).toBe(false);
  });

  it("rejects a negative rate and a rate with too many decimals", () => {
    expect(quotationLineSchema.safeParse({ ...VALID_LINE, rate: -1 }).success).toBe(false);
    expect(quotationLineSchema.safeParse({ ...VALID_LINE, rate: 100.005 }).success).toBe(false);
  });

  it("accepts a combined discount exactly equal to the line's gross value", () => {
    // gross = 10 * 100 = 1000; discountAmount 500 + 50% of 1000 (500) = 1000 exactly.
    const result = quotationLineSchema.safeParse({
      ...VALID_LINE,
      quantity: 10,
      rate: 100,
      discountPercent: 50,
      discountAmount: 500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a combined discount that exceeds the line's gross value by one paisa", () => {
    const result = quotationLineSchema.safeParse({
      ...VALID_LINE,
      quantity: 10,
      rate: 100,
      discountPercent: 50,
      discountAmount: 500.01,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range discount percent", () => {
    expect(
      quotationLineSchema.safeParse({ ...VALID_LINE, discountPercent: 101 }).success
    ).toBe(false);
    expect(
      quotationLineSchema.safeParse({ ...VALID_LINE, discountPercent: -1 }).success
    ).toBe(false);
  });
});

describe("createQuotationSchema", () => {
  it("accepts a complete valid quotation", () => {
    const result = createQuotationSchema.parse(VALID_INPUT);
    expect(result.lines).toHaveLength(1);
    expect(result.placeOfSupplyStateCode).toBe("27");
  });

  it("accepts an omitted validUntil and blank narration", () => {
    const result = createQuotationSchema.parse({
      ...VALID_INPUT,
      validUntil: "",
      narration: "   ",
    });
    expect(result.validUntil).toBeUndefined();
    expect(result.narration).toBeUndefined();
  });

  it("rejects a validUntil before quotationDate and accepts one equal to it", () => {
    expect(
      createQuotationSchema.safeParse({
        ...VALID_INPUT,
        quotationDate: "2026-09-10",
        validUntil: "2026-09-09",
      }).success
    ).toBe(false);
    expect(
      createQuotationSchema.safeParse({
        ...VALID_INPUT,
        quotationDate: "2026-09-10",
        validUntil: "2026-09-10",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown place-of-supply state code", () => {
    expect(
      createQuotationSchema.safeParse({ ...VALID_INPUT, placeOfSupplyStateCode: "99" }).success
    ).toBe(false);
  });

  it("rejects a quotation with zero lines", () => {
    expect(createQuotationSchema.safeParse({ ...VALID_INPUT, lines: [] }).success).toBe(false);
  });

  it("rejects narration over 500 characters", () => {
    expect(
      createQuotationSchema.safeParse({ ...VALID_INPUT, narration: "x".repeat(501) }).success
    ).toBe(false);
  });

  it("rejects a non-uuid customerId", () => {
    expect(
      createQuotationSchema.safeParse({ ...VALID_INPUT, customerId: "not-a-uuid" }).success
    ).toBe(false);
  });
});
