import { describe, expect, it } from "vitest";

import { createPaymentModeSchema, PAYMENT_MODE_LEDGER_CLASSES } from "@/modules/payment-modes/validation/payment-mode-schema";

const VALID_INPUT = {
  name: "NEFT",
  ledgerClass: "BANK" as const,
};

describe("createPaymentModeSchema", () => {
  it("accepts a complete valid input and trims the name", () => {
    const result = createPaymentModeSchema.parse({ ...VALID_INPUT, name: "  NEFT  " });
    expect(result.name).toBe("NEFT");
    expect(result.ledgerClass).toBe("BANK");
  });

  // Create/Edit accepts any ledgerClass value, including on a seeded row —
  // 86-payment-mode-master.md's Code Standards.
  it.each(PAYMENT_MODE_LEDGER_CLASSES)("accepts ledgerClass %s", (ledgerClass) => {
    expect(createPaymentModeSchema.safeParse({ ...VALID_INPUT, ledgerClass }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createPaymentModeSchema.safeParse({ ...VALID_INPUT, name: "" }).success).toBe(false);
    expect(createPaymentModeSchema.safeParse({ ...VALID_INPUT, name: "   " }).success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    expect(
      createPaymentModeSchema.safeParse({ ...VALID_INPUT, name: "a".repeat(101) }).success
    ).toBe(false);
    expect(
      createPaymentModeSchema.safeParse({ ...VALID_INPUT, name: "a".repeat(100) }).success
    ).toBe(true);
  });

  it("rejects an invalid ledgerClass", () => {
    expect(
      createPaymentModeSchema.safeParse({ ...VALID_INPUT, ledgerClass: "SAVINGS" }).success
    ).toBe(false);
  });
});
