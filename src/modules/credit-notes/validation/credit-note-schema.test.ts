import { describe, expect, it } from "vitest";

import { createCreditNoteSchema, isValidCalendarDate, toUtcDate } from "@/modules/credit-notes/validation/credit-note-schema";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const LEDGER_ID = "33333333-3333-4333-8333-333333333333";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CUSTOMER_ID,
    noteDate: "2026-09-10",
    placeOfSupplyStateCode: "27",
    reason: "Price correction",
    lines: [{ description: "Discount adjustment", taxableAmount: 100, ratePercent: 18, cessPercent: 0 }],
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

describe("createCreditNoteSchema", () => {
  it("accepts a minimal valid input with salesInvoiceId/refundMode omitted", () => {
    const result = createCreditNoteSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("accepts a valid input with salesInvoiceId set", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ salesInvoiceId: INVOICE_ID }));
    expect(result.success).toBe(true);
  });

  it("rejects a credit note with no lines", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ lines: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing reason", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ reason: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive taxableAmount", () => {
    const result = createCreditNoteSchema.safeParse(
      validInput({ lines: [{ description: "x", taxableAmount: 0, ratePercent: 18, cessPercent: 0 }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a missing line description", () => {
    const result = createCreditNoteSchema.safeParse(
      validInput({ lines: [{ description: "", taxableAmount: 100, ratePercent: 18, cessPercent: 0 }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a ratePercent outside 0-100", () => {
    const result = createCreditNoteSchema.safeParse(
      validInput({ lines: [{ description: "x", taxableAmount: 100, ratePercent: 101, cessPercent: 0 }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects CASH_REFUND with no refundLedgerId", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ refundMode: "CASH_REFUND" }));
    expect(result.success).toBe(false);
  });

  it("accepts CASH_REFUND with a refundLedgerId", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ refundMode: "CASH_REFUND", refundLedgerId: LEDGER_ID }));
    expect(result.success).toBe(true);
  });

  it("rejects an invalid noteDate", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ noteDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid placeOfSupplyStateCode", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ placeOfSupplyStateCode: "99" }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing customerId", () => {
    const result = createCreditNoteSchema.safeParse(validInput({ customerId: undefined }));
    expect(result.success).toBe(false);
  });
});
