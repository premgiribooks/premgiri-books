import { describe, expect, it } from "vitest";

import {
  createSalesOrderSchema,
  isValidCalendarDate,
  salesOrderLineSchema,
} from "@/modules/sales-orders/validation/sales-order-schema";

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
  orderDate: "2026-09-10",
  expectedDeliveryDate: "2026-09-20",
  placeOfSupplyStateCode: "27",
  narration: "Sample order",
  lines: [VALID_LINE],
};

describe("isValidCalendarDate", () => {
  it("accepts a real calendar date and rejects a rolled-over one", () => {
    expect(isValidCalendarDate("2026-09-10")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });
});

describe("salesOrderLineSchema", () => {
  it("accepts a valid line and omitted optional discount fields", () => {
    const result = salesOrderLineSchema.parse({ productId: PRODUCT_ID, quantity: 5, rate: 20 });
    expect(result.discountPercent).toBeUndefined();
    expect(result.discountAmount).toBeUndefined();
  });

  it("rejects a non-uuid productId and a non-positive quantity", () => {
    expect(
      salesOrderLineSchema.safeParse({ ...VALID_LINE, productId: "not-a-uuid" }).success
    ).toBe(false);
    expect(salesOrderLineSchema.safeParse({ ...VALID_LINE, quantity: 0 }).success).toBe(false);
  });

  it("rejects a combined discount that exceeds the line's gross value by one paisa", () => {
    const result = salesOrderLineSchema.safeParse({
      ...VALID_LINE,
      quantity: 10,
      rate: 100,
      discountPercent: 50,
      discountAmount: 500.01,
    });
    expect(result.success).toBe(false);
  });
});

describe("createSalesOrderSchema", () => {
  it("accepts a complete valid sales order", () => {
    const result = createSalesOrderSchema.parse(VALID_INPUT);
    expect(result.lines).toHaveLength(1);
    expect(result.placeOfSupplyStateCode).toBe("27");
  });

  it("accepts an omitted expectedDeliveryDate and blank narration", () => {
    const result = createSalesOrderSchema.parse({
      ...VALID_INPUT,
      expectedDeliveryDate: "",
      narration: "   ",
    });
    expect(result.expectedDeliveryDate).toBeUndefined();
    expect(result.narration).toBeUndefined();
  });

  it("rejects an expectedDeliveryDate before orderDate and accepts one equal to it", () => {
    expect(
      createSalesOrderSchema.safeParse({
        ...VALID_INPUT,
        orderDate: "2026-09-10",
        expectedDeliveryDate: "2026-09-09",
      }).success
    ).toBe(false);
    expect(
      createSalesOrderSchema.safeParse({
        ...VALID_INPUT,
        orderDate: "2026-09-10",
        expectedDeliveryDate: "2026-09-10",
      }).success
    ).toBe(true);
  });

  it("rejects a sales order with zero lines", () => {
    expect(createSalesOrderSchema.safeParse({ ...VALID_INPUT, lines: [] }).success).toBe(false);
  });

  it("rejects an unknown place-of-supply state code", () => {
    expect(
      createSalesOrderSchema.safeParse({ ...VALID_INPUT, placeOfSupplyStateCode: "99" }).success
    ).toBe(false);
  });
});
