import { describe, expect, it } from "vitest";

import { resolvePaymentVoucherPrefill } from "@/modules/manual-vouchers/utils/resolve-payment-voucher-prefill";
import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";

const LEDGER_OPTIONS: ManualVoucherLedgerOption[] = [
  { id: "ledger-1", name: "ABC Traders", isCashOrBank: false },
  { id: "cash", name: "Cash-in-Hand", isCashOrBank: true },
];

describe("resolvePaymentVoucherPrefill", () => {
  it("resolves a valid debitLedgerId/amount pair", () => {
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, "ledger-1", "1234.5")).toEqual({
      ledgerId: "ledger-1",
      amount: 1234.5,
    });
  });

  it("returns undefined when debitLedgerId is missing", () => {
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, undefined, "100")).toBeUndefined();
  });

  it("returns undefined when amount is missing", () => {
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, "ledger-1", undefined)).toBeUndefined();
  });

  it("returns undefined for a malformed (non-numeric) amount", () => {
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, "ledger-1", "not-a-number")).toBeUndefined();
  });

  it("returns undefined for a zero or negative amount", () => {
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, "ledger-1", "0")).toBeUndefined();
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, "ledger-1", "-50")).toBeUndefined();
  });

  it("returns undefined for a ledger id not present in the caller's own ledger options (inactive or cross-company)", () => {
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, "someone-elses-ledger", "100")).toBeUndefined();
  });

  it("rounds the amount to 2 decimal places", () => {
    expect(resolvePaymentVoucherPrefill(LEDGER_OPTIONS, "ledger-1", "99.999")).toEqual({
      ledgerId: "ledger-1",
      amount: 100,
    });
  });
});
