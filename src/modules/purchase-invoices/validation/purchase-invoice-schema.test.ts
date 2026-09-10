import { describe, expect, it } from "vitest";

import {
  createPurchaseInvoiceSchema,
  isValidCalendarDate,
  purchaseInvoiceLineSchema,
} from "@/modules/purchase-invoices/validation/purchase-invoice-schema";

const SUPPLIER_ID = "1a2b3c4d-5e6f-4789-8abc-def012345678";
const PRODUCT_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const WAREHOUSE_ID = "3c4d5e6f-7081-4901-8bcd-f01234567890";
const LEDGER_ID = "4d5e6f70-8192-4012-9cde-012345678901";

const VALID_LINE = { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 5, rate: 100 };

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: SUPPLIER_ID,
    supplierInvoiceNumber: "SUP-INV-001",
    invoiceDate: "2026-09-10",
    placeOfSupplyStateCode: "27",
    lines: [VALID_LINE],
    ...overrides,
  };
}

describe("isValidCalendarDate", () => {
  it("accepts a real calendar date and rejects a rolled-over one", () => {
    expect(isValidCalendarDate("2026-09-10")).toBe(true);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
  });
});

describe("purchaseInvoiceLineSchema", () => {
  it("accepts a valid line with tax override off", () => {
    const result = purchaseInvoiceLineSchema.parse(VALID_LINE);
    expect(result.isTaxOverridden).toBeUndefined();
  });

  it("rejects a combined discount that exceeds the line's gross value", () => {
    expect(
      purchaseInvoiceLineSchema.safeParse({ ...VALID_LINE, discountPercent: 50, discountAmount: 500.01 }).success
    ).toBe(false);
  });

  it("requires a non-empty overrideReason when isTaxOverridden is true", () => {
    expect(
      purchaseInvoiceLineSchema.safeParse({ ...VALID_LINE, isTaxOverridden: true, overriddenCgst: 10 }).success
    ).toBe(false);
    expect(
      purchaseInvoiceLineSchema.safeParse({
        ...VALID_LINE,
        isTaxOverridden: true,
        overriddenCgst: 10,
        overrideReason: "Exempt under notification X",
      }).success
    ).toBe(true);
  });

  it("does not require an override reason when isTaxOverridden is false", () => {
    expect(purchaseInvoiceLineSchema.safeParse(VALID_LINE).success).toBe(true);
  });

  it("rejects a line overriding both the intra-state pair and the inter-state field at once", () => {
    expect(
      purchaseInvoiceLineSchema.safeParse({
        ...VALID_LINE,
        isTaxOverridden: true,
        overriddenCgst: 10,
        overriddenIgst: 10,
        overrideReason: "Invalid combination",
      }).success
    ).toBe(false);
  });

  it("accepts an override setting only the intra-state pair", () => {
    expect(
      purchaseInvoiceLineSchema.safeParse({
        ...VALID_LINE,
        isTaxOverridden: true,
        overriddenCgst: 10,
        overriddenSgst: 10,
        overrideReason: "Intra-state correction",
      }).success
    ).toBe(true);
  });

  it("accepts an override setting only the inter-state field", () => {
    expect(
      purchaseInvoiceLineSchema.safeParse({
        ...VALID_LINE,
        isTaxOverridden: true,
        overriddenIgst: 20,
        overrideReason: "Inter-state correction",
      }).success
    ).toBe(true);
  });
});

describe("createPurchaseInvoiceSchema — general shape", () => {
  it("accepts a valid purchase invoice", () => {
    expect(createPurchaseInvoiceSchema.safeParse(validInput()).success).toBe(true);
  });

  it("requires a supplierId", () => {
    expect(createPurchaseInvoiceSchema.safeParse(validInput({ supplierId: undefined })).success).toBe(false);
  });

  it("requires a non-empty supplierInvoiceNumber", () => {
    expect(createPurchaseInvoiceSchema.safeParse(validInput({ supplierInvoiceNumber: "" })).success).toBe(false);
  });

  it("rejects a purchase invoice with zero lines", () => {
    expect(createPurchaseInvoiceSchema.safeParse(validInput({ lines: [] })).success).toBe(false);
  });

  it("accepts an omitted payments array", () => {
    const result = createPurchaseInvoiceSchema.parse(validInput());
    expect(result.payments).toBeUndefined();
  });

  it("accepts a valid payments array", () => {
    const result = createPurchaseInvoiceSchema.parse(validInput({ payments: [{ ledgerId: LEDGER_ID, amount: 100 }] }));
    expect(result.payments).toHaveLength(1);
  });

  it("rejects a non-positive payment amount", () => {
    expect(
      createPurchaseInvoiceSchema.safeParse(validInput({ payments: [{ ledgerId: LEDGER_ID, amount: 0 }] })).success
    ).toBe(false);
  });

  it("accepts an optional purchaseOrderId/goodsReceiptNoteId", () => {
    expect(
      createPurchaseInvoiceSchema.safeParse(
        validInput({ purchaseOrderId: SUPPLIER_ID, goodsReceiptNoteId: WAREHOUSE_ID })
      ).success
    ).toBe(true);
  });
});
