import { describe, expect, it } from "vitest";

import { createPaymentVoucherSchema } from "@/modules/manual-vouchers/validation/payment-voucher-schema";

const LEDGER_A = "11111111-1111-4111-8111-111111111111";
const LEDGER_B = "22222222-2222-4222-8222-222222222222";
const PAYMENT_MODE_ID = "33333333-3333-4333-8333-333333333333";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    voucherDate: "2026-09-11",
    narration: "Paid electricity bill",
    creditLedgerId: LEDGER_A,
    paymentModeId: PAYMENT_MODE_ID,
    debitLines: [{ ledgerId: LEDGER_B, amount: 500 }],
    ...overrides,
  };
}

describe("createPaymentVoucherSchema", () => {
  it("accepts a well-formed single-line payment", () => {
    expect(createPaymentVoucherSchema.safeParse(validInput()).success).toBe(true);
  });

  it("accepts a well-formed multi-line payment", () => {
    expect(
      createPaymentVoucherSchema.safeParse(
        validInput({ debitLines: [{ ledgerId: LEDGER_B, amount: 300 }, { ledgerId: LEDGER_A, amount: 200 }] })
      ).success
    ).toBe(true);
  });

  it("rejects a malformed voucher date", () => {
    expect(createPaymentVoucherSchema.safeParse(validInput({ voucherDate: "2026-02-30" })).success).toBe(false);
  });

  it("normalizes a blank narration to undefined", () => {
    expect(createPaymentVoucherSchema.parse(validInput({ narration: "   " })).narration).toBeUndefined();
  });

  it("rejects narration over 500 characters", () => {
    expect(createPaymentVoucherSchema.safeParse(validInput({ narration: "x".repeat(501) })).success).toBe(false);
  });

  it("requires a valid uuid creditLedgerId", () => {
    expect(createPaymentVoucherSchema.safeParse(validInput({ creditLedgerId: "not-a-uuid" })).success).toBe(false);
  });

  // 93-payment-mode-integration-manual-vouchers.md — required on the
  // Cash/Bank (Credit) side.
  it("requires a paymentModeId", () => {
    expect(createPaymentVoucherSchema.safeParse(validInput({ paymentModeId: undefined })).success).toBe(false);
  });

  it("rejects zero debit lines", () => {
    expect(createPaymentVoucherSchema.safeParse(validInput({ debitLines: [] })).success).toBe(false);
  });

  it("rejects a zero or negative debit amount", () => {
    expect(
      createPaymentVoucherSchema.safeParse(validInput({ debitLines: [{ ledgerId: LEDGER_B, amount: 0 }] })).success
    ).toBe(false);
    expect(
      createPaymentVoucherSchema.safeParse(validInput({ debitLines: [{ ledgerId: LEDGER_B, amount: -5 }] })).success
    ).toBe(false);
  });

  it("rejects a debit amount with more than 2 decimal places", () => {
    expect(
      createPaymentVoucherSchema.safeParse(validInput({ debitLines: [{ ledgerId: LEDGER_B, amount: 10.555 }] }))
        .success
    ).toBe(false);
  });

  it("rejects a non-uuid ledgerId in a debit line", () => {
    expect(
      createPaymentVoucherSchema.safeParse(validInput({ debitLines: [{ ledgerId: "not-a-uuid", amount: 10 }] }))
        .success
    ).toBe(false);
  });
});
