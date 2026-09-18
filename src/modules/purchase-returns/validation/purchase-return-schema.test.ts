import { describe, expect, it } from "vitest";

import { createPurchaseReturnSchema, isValidCalendarDate, toUtcDate } from "@/modules/purchase-returns/validation/purchase-return-schema";

const PURCHASE_INVOICE_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID_2 = "33333333-3333-4333-8333-333333333333";
const LEDGER_ID = "44444444-4444-4444-8444-444444444444";
const PAYMENT_MODE_ID = "55555555-5555-4555-8555-555555555555";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    purchaseInvoiceId: PURCHASE_INVOICE_ID,
    returnDate: "2026-09-10",
    lines: [{ purchaseInvoiceItemId: ITEM_ID, quantity: 1 }],
    ...overrides,
  };
}

describe("isValidCalendarDate / toUtcDate", () => {
  it("accepts a valid calendar date", () => {
    expect(isValidCalendarDate("2026-09-10")).toBe(true);
  });

  it("rejects an invalid calendar date", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });

  it("converts to a UTC-midnight Date", () => {
    expect(toUtcDate("2026-09-10").toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });
});

describe("createPurchaseReturnSchema", () => {
  it("accepts a minimal valid input with refundMode omitted", () => {
    const result = createPurchaseReturnSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects a return with no lines", () => {
    const result = createPurchaseReturnSchema.safeParse(validInput({ lines: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const result = createPurchaseReturnSchema.safeParse(validInput({ lines: [{ purchaseInvoiceItemId: ITEM_ID, quantity: 0 }] }));
    expect(result.success).toBe(false);
  });

  it("rejects CASH_REFUND with no refundLedgerId", () => {
    const result = createPurchaseReturnSchema.safeParse(validInput({ refundMode: "CASH_REFUND" }));
    expect(result.success).toBe(false);
  });

  it("rejects CASH_REFUND with a refundLedgerId but no paymentModeId", () => {
    const result = createPurchaseReturnSchema.safeParse(validInput({ refundMode: "CASH_REFUND", refundLedgerId: LEDGER_ID }));
    expect(result.success).toBe(false);
  });

  it("accepts CASH_REFUND with both a refundLedgerId and a paymentModeId", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validInput({ refundMode: "CASH_REFUND", refundLedgerId: LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
    );
    expect(result.success).toBe(true);
  });

  it("rejects the same purchaseInvoiceItemId listed twice", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validInput({
        lines: [
          { purchaseInvoiceItemId: ITEM_ID, quantity: 1 },
          { purchaseInvoiceItemId: ITEM_ID, quantity: 2 },
        ],
      })
    );
    expect(result.success).toBe(false);
  });

  it("accepts two different lines", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validInput({
        lines: [
          { purchaseInvoiceItemId: ITEM_ID, quantity: 1 },
          { purchaseInvoiceItemId: ITEM_ID_2, quantity: 2 },
        ],
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects an invalid returnDate", () => {
    const result = createPurchaseReturnSchema.safeParse(validInput({ returnDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });
});
