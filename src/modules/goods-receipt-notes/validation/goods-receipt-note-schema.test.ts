import { describe, expect, it } from "vitest";

import {
  createGoodsReceiptNoteSchema,
  goodsReceiptNoteLineSchema,
  isValidCalendarDate,
} from "@/modules/goods-receipt-notes/validation/goods-receipt-note-schema";

const SUPPLIER_ID = "1a2b3c4d-5e6f-4789-8abc-def012345678";
const PURCHASE_ORDER_ID = "2b3c4d5e-6f70-4890-9abc-ef0123456789";
const PRODUCT_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const WAREHOUSE_ID = "3c4d5e6f-7081-4901-8bcd-f01234567890";
const ITEM_ID = "4d5e6f70-8192-4012-9cde-012345678901";

const VALID_LINE = { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 5, rejectedQuantity: 0 };

const VALID_INPUT = {
  supplierId: SUPPLIER_ID,
  grnDate: "2026-09-10",
  narration: "Receiving note",
  lines: [VALID_LINE],
};

describe("isValidCalendarDate", () => {
  it("accepts a real calendar date and rejects a rolled-over one", () => {
    expect(isValidCalendarDate("2026-09-10")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });
});

describe("goodsReceiptNoteLineSchema", () => {
  it("accepts a valid line with an omitted purchaseOrderItemId", () => {
    const result = goodsReceiptNoteLineSchema.parse(VALID_LINE);
    expect(result.purchaseOrderItemId).toBeUndefined();
  });

  it("rejects an omitted rejectedQuantity — always sent explicitly by the form", () => {
    const withoutRejected = { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 5 };
    expect(goodsReceiptNoteLineSchema.safeParse(withoutRejected).success).toBe(false);
  });

  it("rejects a non-uuid productId/warehouseId and a non-positive quantity", () => {
    expect(goodsReceiptNoteLineSchema.safeParse({ ...VALID_LINE, productId: "not-a-uuid" }).success).toBe(false);
    expect(goodsReceiptNoteLineSchema.safeParse({ ...VALID_LINE, warehouseId: "not-a-uuid" }).success).toBe(false);
    expect(goodsReceiptNoteLineSchema.safeParse({ ...VALID_LINE, quantity: 0 }).success).toBe(false);
  });

  it("rejects a negative rejectedQuantity", () => {
    expect(goodsReceiptNoteLineSchema.safeParse({ ...VALID_LINE, rejectedQuantity: -1 }).success).toBe(false);
  });

  it("rejects a quantity or rejectedQuantity with more than 4 decimal places", () => {
    expect(goodsReceiptNoteLineSchema.safeParse({ ...VALID_LINE, quantity: 1.23456 }).success).toBe(false);
    expect(goodsReceiptNoteLineSchema.safeParse({ ...VALID_LINE, rejectedQuantity: 1.23456 }).success).toBe(false);
  });
});

describe("createGoodsReceiptNoteSchema — purchase order linkage", () => {
  it("accepts a manual GRN with no purchaseOrderId and no line-level purchaseOrderItemId", () => {
    const result = createGoodsReceiptNoteSchema.parse(VALID_INPUT);
    expect(result.purchaseOrderId).toBeUndefined();
  });

  it("accepts a linked GRN when every line carries a purchaseOrderItemId", () => {
    const result = createGoodsReceiptNoteSchema.parse({
      ...VALID_INPUT,
      purchaseOrderId: PURCHASE_ORDER_ID,
      lines: [{ ...VALID_LINE, purchaseOrderItemId: ITEM_ID }],
    });
    expect(result.purchaseOrderId).toBe(PURCHASE_ORDER_ID);
  });

  it("rejects a linked GRN (purchaseOrderId set) with a line missing purchaseOrderItemId", () => {
    expect(
      createGoodsReceiptNoteSchema.safeParse({
        ...VALID_INPUT,
        purchaseOrderId: PURCHASE_ORDER_ID,
        lines: [VALID_LINE],
      }).success
    ).toBe(false);
  });

  it("rejects a manual GRN (no purchaseOrderId) with a line carrying purchaseOrderItemId", () => {
    expect(
      createGoodsReceiptNoteSchema.safeParse({
        ...VALID_INPUT,
        lines: [{ ...VALID_LINE, purchaseOrderItemId: ITEM_ID }],
      }).success
    ).toBe(false);
  });

  it("rejects a linked GRN with only some lines carrying purchaseOrderItemId", () => {
    expect(
      createGoodsReceiptNoteSchema.safeParse({
        ...VALID_INPUT,
        purchaseOrderId: PURCHASE_ORDER_ID,
        lines: [{ ...VALID_LINE, purchaseOrderItemId: ITEM_ID }, VALID_LINE],
      }).success
    ).toBe(false);
  });
});

describe("createGoodsReceiptNoteSchema — general shape", () => {
  it("accepts an omitted/blank narration", () => {
    const result = createGoodsReceiptNoteSchema.parse({ ...VALID_INPUT, narration: "   " });
    expect(result.narration).toBeUndefined();
  });

  it("rejects a GRN with zero lines", () => {
    expect(createGoodsReceiptNoteSchema.safeParse({ ...VALID_INPUT, lines: [] }).success).toBe(false);
  });

  it("rejects an invalid supplierId", () => {
    expect(createGoodsReceiptNoteSchema.safeParse({ ...VALID_INPUT, supplierId: "not-a-uuid" }).success).toBe(false);
  });
});
