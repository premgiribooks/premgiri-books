import { describe, expect, it } from "vitest";

import { createDebitNoteSchema, isValidCalendarDate, toUtcDate } from "@/modules/debit-notes/validation/debit-note-schema";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CUSTOMER_ID,
    noteDate: "2026-09-10",
    placeOfSupplyStateCode: "27",
    reason: "Additional freight charge",
    lines: [{ description: "Freight adjustment", taxableAmount: 100, ratePercent: 18, cessPercent: 0 }],
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

describe("createDebitNoteSchema", () => {
  it("accepts a minimal valid input with salesInvoiceId omitted", () => {
    const result = createDebitNoteSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("accepts a valid input with salesInvoiceId set", () => {
    const result = createDebitNoteSchema.safeParse(validInput({ salesInvoiceId: INVOICE_ID }));
    expect(result.success).toBe(true);
  });

  it("rejects a debit note with no lines", () => {
    const result = createDebitNoteSchema.safeParse(validInput({ lines: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing reason", () => {
    const result = createDebitNoteSchema.safeParse(validInput({ reason: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive taxableAmount", () => {
    const result = createDebitNoteSchema.safeParse(
      validInput({ lines: [{ description: "x", taxableAmount: 0, ratePercent: 18, cessPercent: 0 }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a missing line description", () => {
    const result = createDebitNoteSchema.safeParse(
      validInput({ lines: [{ description: "", taxableAmount: 100, ratePercent: 18, cessPercent: 0 }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a ratePercent outside 0-100", () => {
    const result = createDebitNoteSchema.safeParse(
      validInput({ lines: [{ description: "x", taxableAmount: 100, ratePercent: 101, cessPercent: 0 }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an invalid noteDate", () => {
    const result = createDebitNoteSchema.safeParse(validInput({ noteDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid placeOfSupplyStateCode", () => {
    const result = createDebitNoteSchema.safeParse(validInput({ placeOfSupplyStateCode: "99" }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing customerId", () => {
    const result = createDebitNoteSchema.safeParse(validInput({ customerId: undefined }));
    expect(result.success).toBe(false);
  });

  it("has no refundMode or refundLedgerId fields", () => {
    const result = createDebitNoteSchema.safeParse(validInput({ refundMode: "CASH_REFUND" }));
    // Zod strips unknown keys by default rather than rejecting — assert the
    // parsed output carries no refund fields at all (41-debit-note.md: "no
    // refund-mode concept").
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("refundMode");
      expect(result.data).not.toHaveProperty("refundLedgerId");
    }
  });
});
