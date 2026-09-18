import { describe, expect, it } from "vitest";

import {
  createSalesInvoiceSchema,
  isValidCalendarDate,
  salesInvoiceLineSchema,
} from "@/modules/sales-invoices/validation/sales-invoice-schema";

const CUSTOMER_ID = "1a2b3c4d-5e6f-4789-8abc-def012345678";
const PRODUCT_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const WAREHOUSE_ID = "3c4d5e6f-7081-4901-8bcd-f01234567890";
const LEDGER_ID = "4d5e6f70-8192-4012-9cde-012345678901";
const PAYMENT_MODE_ID = "5e6f7081-9203-4123-8def-123456789012";

const VALID_LINE = { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 5, rate: 100 };

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerMode: "PERMANENT" as const,
    customerId: CUSTOMER_ID,
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

describe("salesInvoiceLineSchema", () => {
  it("accepts a valid line with tax override off", () => {
    const result = salesInvoiceLineSchema.parse(VALID_LINE);
    expect(result.isTaxOverridden).toBeUndefined();
  });

  it("rejects a combined discount that exceeds the line's gross value", () => {
    expect(
      salesInvoiceLineSchema.safeParse({ ...VALID_LINE, discountPercent: 50, discountAmount: 500.01 }).success
    ).toBe(false);
  });

  it("requires a non-empty overrideReason when isTaxOverridden is true", () => {
    expect(
      salesInvoiceLineSchema.safeParse({ ...VALID_LINE, isTaxOverridden: true, overriddenCgst: 10 }).success
    ).toBe(false);
    expect(
      salesInvoiceLineSchema.safeParse({
        ...VALID_LINE,
        isTaxOverridden: true,
        overriddenCgst: 10,
        overrideReason: "Exempt under notification X",
      }).success
    ).toBe(true);
  });

  it("does not require an override reason when isTaxOverridden is false", () => {
    expect(salesInvoiceLineSchema.safeParse(VALID_LINE).success).toBe(true);
  });
});

describe("createSalesInvoiceSchema — customerMode discriminator", () => {
  it("accepts PERMANENT with customerId and no quick-customer fields", () => {
    expect(createSalesInvoiceSchema.safeParse(validInput()).success).toBe(true);
  });

  it("rejects PERMANENT without a customerId", () => {
    expect(
      createSalesInvoiceSchema.safeParse(validInput({ customerMode: "PERMANENT", customerId: undefined })).success
    ).toBe(false);
  });

  it("rejects PERMANENT carrying a quickCustomerName", () => {
    expect(
      createSalesInvoiceSchema.safeParse(validInput({ quickCustomerName: "Walk-in Joe" })).success
    ).toBe(false);
  });

  it("accepts QUICK with only quickCustomerName and no customerId", () => {
    expect(
      createSalesInvoiceSchema.safeParse(
        validInput({ customerMode: "QUICK", customerId: undefined, quickCustomerName: "Jane Doe" })
      ).success
    ).toBe(true);
  });

  it("rejects QUICK without a quickCustomerName", () => {
    expect(
      createSalesInvoiceSchema.safeParse(validInput({ customerMode: "QUICK", customerId: undefined })).success
    ).toBe(false);
  });

  it("rejects QUICK carrying a customerId", () => {
    expect(
      createSalesInvoiceSchema.safeParse(
        validInput({ customerMode: "QUICK", quickCustomerName: "Jane Doe" })
      ).success
    ).toBe(false);
  });

  it("accepts WALK_IN with no customerId and only an optional display name", () => {
    expect(
      createSalesInvoiceSchema.safeParse(
        validInput({ customerMode: "WALK_IN", customerId: undefined, quickCustomerName: "Cash Sale" })
      ).success
    ).toBe(true);
    expect(
      createSalesInvoiceSchema.safeParse(validInput({ customerMode: "WALK_IN", customerId: undefined })).success
    ).toBe(true);
  });

  it("rejects WALK_IN carrying a mobile/GSTIN/address", () => {
    expect(
      createSalesInvoiceSchema.safeParse(
        validInput({ customerMode: "WALK_IN", customerId: undefined, quickCustomerMobile: "9999999999" })
      ).success
    ).toBe(false);
  });
});

describe("createSalesInvoiceSchema — general shape", () => {
  it("rejects a sales invoice with zero lines", () => {
    expect(createSalesInvoiceSchema.safeParse(validInput({ lines: [] })).success).toBe(false);
  });

  it("accepts an omitted payments array", () => {
    const result = createSalesInvoiceSchema.parse(validInput());
    expect(result.payments).toBeUndefined();
  });

  it("accepts a valid payments array", () => {
    const result = createSalesInvoiceSchema.parse(validInput({ payments: [{ ledgerId: LEDGER_ID, paymentModeId: PAYMENT_MODE_ID, amount: 100 }] }));
    expect(result.payments).toHaveLength(1);
  });

  it("rejects a non-positive payment amount", () => {
    expect(
      createSalesInvoiceSchema.safeParse(validInput({ payments: [{ ledgerId: LEDGER_ID, paymentModeId: PAYMENT_MODE_ID, amount: 0 }] })).success
    ).toBe(false);
  });

  it("rejects a payment line with no paymentModeId", () => {
    expect(
      createSalesInvoiceSchema.safeParse(validInput({ payments: [{ ledgerId: LEDGER_ID, amount: 100 }] })).success
    ).toBe(false);
  });
});
