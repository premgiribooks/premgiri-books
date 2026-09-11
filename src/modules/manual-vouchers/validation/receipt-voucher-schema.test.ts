import { describe, expect, it } from "vitest";

import { createReceiptVoucherSchema } from "@/modules/manual-vouchers/validation/receipt-voucher-schema";

const LEDGER_A = "11111111-1111-4111-8111-111111111111";
const LEDGER_B = "22222222-2222-4222-8222-222222222222";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    voucherDate: "2026-09-11",
    narration: "Received against outstanding balance",
    debitLedgerId: LEDGER_A,
    creditLines: [{ ledgerId: LEDGER_B, amount: 500 }],
    ...overrides,
  };
}

describe("createReceiptVoucherSchema", () => {
  it("accepts a well-formed single-line receipt", () => {
    expect(createReceiptVoucherSchema.safeParse(validInput()).success).toBe(true);
  });

  it("accepts a well-formed multi-line receipt", () => {
    expect(
      createReceiptVoucherSchema.safeParse(
        validInput({ creditLines: [{ ledgerId: LEDGER_B, amount: 300 }, { ledgerId: LEDGER_A, amount: 200 }] })
      ).success
    ).toBe(true);
  });

  it("rejects a malformed voucher date", () => {
    expect(createReceiptVoucherSchema.safeParse(validInput({ voucherDate: "2026-02-30" })).success).toBe(false);
  });

  it("normalizes a blank narration to undefined", () => {
    expect(createReceiptVoucherSchema.parse(validInput({ narration: "   " })).narration).toBeUndefined();
  });

  it("rejects narration over 500 characters", () => {
    expect(createReceiptVoucherSchema.safeParse(validInput({ narration: "x".repeat(501) })).success).toBe(false);
  });

  it("requires a valid uuid debitLedgerId", () => {
    expect(createReceiptVoucherSchema.safeParse(validInput({ debitLedgerId: "not-a-uuid" })).success).toBe(false);
  });

  it("rejects zero credit lines", () => {
    expect(createReceiptVoucherSchema.safeParse(validInput({ creditLines: [] })).success).toBe(false);
  });

  it("rejects a zero or negative credit amount", () => {
    expect(
      createReceiptVoucherSchema.safeParse(validInput({ creditLines: [{ ledgerId: LEDGER_B, amount: 0 }] })).success
    ).toBe(false);
    expect(
      createReceiptVoucherSchema.safeParse(validInput({ creditLines: [{ ledgerId: LEDGER_B, amount: -5 }] })).success
    ).toBe(false);
  });

  it("rejects a credit amount with more than 2 decimal places", () => {
    expect(
      createReceiptVoucherSchema.safeParse(validInput({ creditLines: [{ ledgerId: LEDGER_B, amount: 10.555 }] }))
        .success
    ).toBe(false);
  });

  it("rejects a non-uuid ledgerId in a credit line", () => {
    expect(
      createReceiptVoucherSchema.safeParse(validInput({ creditLines: [{ ledgerId: "not-a-uuid", amount: 10 }] }))
        .success
    ).toBe(false);
  });
});
