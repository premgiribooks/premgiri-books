import { describe, expect, it } from "vitest";

import {
  createDeliveryChallanSchema,
  deliveryChallanLineSchema,
  isValidCalendarDate,
} from "@/modules/delivery-challans/validation/delivery-challan-schema";

const CUSTOMER_ID = "1a2b3c4d-5e6f-4789-8abc-def012345678";
const SALES_ORDER_ID = "2b3c4d5e-6f70-4890-9abc-ef0123456789";
const PRODUCT_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const ITEM_ID = "4d5e6f70-8192-4012-9cde-012345678901";

const VALID_LINE = { productId: PRODUCT_ID, quantity: 5 };

const VALID_INPUT = {
  customerId: CUSTOMER_ID,
  challanDate: "2026-09-10",
  narration: "Dispatch note",
  lines: [VALID_LINE],
};

describe("isValidCalendarDate", () => {
  it("accepts a real calendar date and rejects a rolled-over one", () => {
    expect(isValidCalendarDate("2026-09-10")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });
});

describe("deliveryChallanLineSchema", () => {
  it("accepts a valid line with an omitted salesOrderItemId", () => {
    const result = deliveryChallanLineSchema.parse(VALID_LINE);
    expect(result.salesOrderItemId).toBeUndefined();
  });

  it("rejects a non-uuid productId and a non-positive quantity", () => {
    expect(deliveryChallanLineSchema.safeParse({ ...VALID_LINE, productId: "not-a-uuid" }).success).toBe(false);
    expect(deliveryChallanLineSchema.safeParse({ ...VALID_LINE, quantity: 0 }).success).toBe(false);
  });

  it("rejects a quantity with more than 4 decimal places", () => {
    expect(deliveryChallanLineSchema.safeParse({ ...VALID_LINE, quantity: 1.23456 }).success).toBe(false);
  });
});

describe("createDeliveryChallanSchema — sales order linkage", () => {
  it("accepts a manual challan with no salesOrderId and no line-level salesOrderItemId", () => {
    const result = createDeliveryChallanSchema.parse(VALID_INPUT);
    expect(result.salesOrderId).toBeUndefined();
  });

  it("accepts a linked challan when every line carries a salesOrderItemId", () => {
    const result = createDeliveryChallanSchema.parse({
      ...VALID_INPUT,
      salesOrderId: SALES_ORDER_ID,
      lines: [{ ...VALID_LINE, salesOrderItemId: ITEM_ID }],
    });
    expect(result.salesOrderId).toBe(SALES_ORDER_ID);
  });

  it("rejects a linked challan (salesOrderId set) with a line missing salesOrderItemId", () => {
    expect(
      createDeliveryChallanSchema.safeParse({
        ...VALID_INPUT,
        salesOrderId: SALES_ORDER_ID,
        lines: [VALID_LINE],
      }).success
    ).toBe(false);
  });

  it("rejects a manual challan (no salesOrderId) with a line carrying salesOrderItemId", () => {
    expect(
      createDeliveryChallanSchema.safeParse({
        ...VALID_INPUT,
        lines: [{ ...VALID_LINE, salesOrderItemId: ITEM_ID }],
      }).success
    ).toBe(false);
  });

  it("rejects a linked challan with only some lines carrying salesOrderItemId", () => {
    expect(
      createDeliveryChallanSchema.safeParse({
        ...VALID_INPUT,
        salesOrderId: SALES_ORDER_ID,
        lines: [{ ...VALID_LINE, salesOrderItemId: ITEM_ID }, VALID_LINE],
      }).success
    ).toBe(false);
  });
});

describe("createDeliveryChallanSchema — general shape", () => {
  it("accepts an omitted/blank narration", () => {
    const result = createDeliveryChallanSchema.parse({ ...VALID_INPUT, narration: "   " });
    expect(result.narration).toBeUndefined();
  });

  it("rejects a challan with zero lines", () => {
    expect(createDeliveryChallanSchema.safeParse({ ...VALID_INPUT, lines: [] }).success).toBe(false);
  });

  it("rejects an invalid customerId", () => {
    expect(createDeliveryChallanSchema.safeParse({ ...VALID_INPUT, customerId: "not-a-uuid" }).success).toBe(false);
  });
});
