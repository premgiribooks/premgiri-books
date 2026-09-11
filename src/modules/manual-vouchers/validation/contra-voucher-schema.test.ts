import { describe, expect, it } from "vitest";

import { createContraVoucherSchema } from "@/modules/manual-vouchers/validation/contra-voucher-schema";

const LEDGER_A = "11111111-1111-4111-8111-111111111111";
const LEDGER_B = "22222222-2222-4222-8222-222222222222";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    voucherDate: "2026-09-11",
    narration: "Cash deposited into bank",
    fromLedgerId: LEDGER_A,
    toLedgerId: LEDGER_B,
    amount: 500,
    ...overrides,
  };
}

describe("createContraVoucherSchema", () => {
  it("accepts a well-formed contra voucher", () => {
    expect(createContraVoucherSchema.safeParse(validInput()).success).toBe(true);
  });

  it("rejects a malformed voucher date", () => {
    expect(createContraVoucherSchema.safeParse(validInput({ voucherDate: "2026-02-30" })).success).toBe(false);
  });

  it("normalizes a blank narration to undefined", () => {
    expect(createContraVoucherSchema.parse(validInput({ narration: "   " })).narration).toBeUndefined();
  });

  it("rejects narration over 500 characters", () => {
    expect(createContraVoucherSchema.safeParse(validInput({ narration: "x".repeat(501) })).success).toBe(false);
  });

  it("requires a valid uuid fromLedgerId", () => {
    expect(createContraVoucherSchema.safeParse(validInput({ fromLedgerId: "not-a-uuid" })).success).toBe(false);
  });

  it("requires a valid uuid toLedgerId", () => {
    expect(createContraVoucherSchema.safeParse(validInput({ toLedgerId: "not-a-uuid" })).success).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(createContraVoucherSchema.safeParse(validInput({ amount: 0 })).success).toBe(false);
    expect(createContraVoucherSchema.safeParse(validInput({ amount: -5 })).success).toBe(false);
  });

  it("rejects an amount with more than 2 decimal places", () => {
    expect(createContraVoucherSchema.safeParse(validInput({ amount: 10.555 })).success).toBe(false);
  });

  it("rejects when fromLedgerId and toLedgerId are the same", () => {
    expect(createContraVoucherSchema.safeParse(validInput({ toLedgerId: LEDGER_A })).success).toBe(false);
  });
});
