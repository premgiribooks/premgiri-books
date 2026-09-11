import { describe, expect, it } from "vitest";

import { createJournalVoucherSchema } from "@/modules/manual-vouchers/validation/journal-voucher-schema";

const LEDGER_A = "11111111-1111-4111-8111-111111111111";
const LEDGER_B = "22222222-2222-4222-8222-222222222222";
const LEDGER_C = "33333333-3333-4333-8333-333333333333";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    voucherDate: "2026-09-11",
    narration: "Month-end correcting entry",
    entries: [
      { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 },
      { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 500 },
    ],
    ...overrides,
  };
}

describe("createJournalVoucherSchema", () => {
  it("accepts a well-formed two-entry journal", () => {
    expect(createJournalVoucherSchema.safeParse(validInput()).success).toBe(true);
  });

  it("accepts a freeform multi-line entry set with mixed Debit/Credit counts on either side", () => {
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 300 },
            { ledgerId: LEDGER_B, entryType: "DEBIT", amount: 200 },
            { ledgerId: LEDGER_C, entryType: "CREDIT", amount: 500 },
          ],
        })
      ).success
    ).toBe(true);
  });

  it("accepts a Cash/Bank ledger on either side — no ledger-class restriction", () => {
    // The schema itself has no `isCashOrBank` concept at all; this simply
    // confirms nothing about ledger identity is special-cased here.
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 },
            { ledgerId: LEDGER_A, entryType: "CREDIT", amount: 500 },
          ],
        })
      ).success
    ).toBe(true);
  });

  it("rejects a malformed voucher date", () => {
    expect(createJournalVoucherSchema.safeParse(validInput({ voucherDate: "2026-02-30" })).success).toBe(false);
  });

  it("normalizes a blank narration to undefined", () => {
    expect(createJournalVoucherSchema.parse(validInput({ narration: "   " })).narration).toBeUndefined();
  });

  it("rejects narration over 500 characters", () => {
    expect(createJournalVoucherSchema.safeParse(validInput({ narration: "x".repeat(501) })).success).toBe(false);
  });

  it("rejects fewer than 2 entries", () => {
    expect(
      createJournalVoucherSchema.safeParse(validInput({ entries: [{ ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 }] }))
        .success
    ).toBe(false);
  });

  it("rejects zero entries", () => {
    expect(createJournalVoucherSchema.safeParse(validInput({ entries: [] })).success).toBe(false);
  });

  it("rejects an invalid entryType", () => {
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({ entries: [{ ledgerId: LEDGER_A, entryType: "DEBT", amount: 500 }] })
      ).success
    ).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({ entries: [{ ledgerId: LEDGER_A, entryType: "DEBIT", amount: 0 }] })
      ).success
    ).toBe(false);
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({ entries: [{ ledgerId: LEDGER_A, entryType: "DEBIT", amount: -5 }] })
      ).success
    ).toBe(false);
  });

  it("rejects an amount with more than 2 decimal places", () => {
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({ entries: [{ ledgerId: LEDGER_A, entryType: "DEBIT", amount: 10.555 }] })
      ).success
    ).toBe(false);
  });

  it("rejects a non-uuid ledgerId in an entry", () => {
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({ entries: [{ ledgerId: "not-a-uuid", entryType: "DEBIT", amount: 10 }] })
      ).success
    ).toBe(false);
  });

  it("does not itself reject an unbalanced entry set — left to the engine", () => {
    expect(
      createJournalVoucherSchema.safeParse(
        validInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 },
            { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 300 },
          ],
        })
      ).success
    ).toBe(true);
  });
});
