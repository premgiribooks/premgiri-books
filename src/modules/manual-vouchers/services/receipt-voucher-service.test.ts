import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors payment-voucher-service.test.ts's convention — mock the Voucher
// Engine this service is a thin layer over, the shared ledger-class helper,
// and the session/permission/FY boundaries.
const {
  postVoucherMock,
  cancelVoucherMock,
  getVoucherMock,
  listVouchersMock,
  assertLedgersAreCashOrBankMock,
  assertPaymentModeMatchesLedgerMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
} = vi.hoisted(() => ({
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  getVoucherMock: vi.fn(),
  listVouchersMock: vi.fn(),
  assertLedgersAreCashOrBankMock: vi.fn(),
  assertPaymentModeMatchesLedgerMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
}));

vi.mock("@/engines/voucher/voucher-engine", () => ({
  voucherEngine: {
    postVoucher: postVoucherMock,
    cancelVoucher: cancelVoucherMock,
    getVoucher: getVoucherMock,
    listVouchers: listVouchersMock,
  },
}));
vi.mock("@/lib/ledger-class", () => ({ assertLedgersAreCashOrBank: assertLedgersAreCashOrBankMock }));
vi.mock("@/lib/payment-mode-validation", () => ({ assertPaymentModeMatchesLedger: assertPaymentModeMatchesLedgerMock }));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { receiptVoucherService } from "@/modules/manual-vouchers/services/receipt-voucher-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const CASH_LEDGER_ID = "44444444-4444-4444-8444-444444444444";
const INCOME_LEDGER_ID = "55555555-5555-4555-8555-555555555555";
const VOUCHER_ID = "66666666-6666-4666-8666-666666666666";
const PAYMENT_MODE_ID = "77777777-7777-4777-8777-777777777777";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID };

const POSTED_RECEIPT_VOUCHER = {
  id: VOUCHER_ID,
  companyId: COMPANY_ID,
  voucherType: "RECEIPT" as const,
  voucherNumber: "RCT-2026-0001",
  status: "POSTED" as const,
  totalAmount: 500,
  entries: [],
};

beforeEach(() => {
  postVoucherMock.mockReset();
  cancelVoucherMock.mockReset();
  getVoucherMock.mockReset();
  listVouchersMock.mockReset();
  assertLedgersAreCashOrBankMock.mockReset().mockResolvedValue(undefined);
  assertPaymentModeMatchesLedgerMock.mockReset().mockResolvedValue(undefined);
  getCurrentCompanyUserMock.mockReset().mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockReset().mockResolvedValue({ id: FY_ID });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
});

describe("postReceiptVoucher — entry shape", () => {
  function validInput(overrides: Record<string, unknown> = {}) {
    return {
      voucherDate: "2026-09-11",
      debitLedgerId: CASH_LEDGER_ID,
      paymentModeId: PAYMENT_MODE_ID,
      creditLines: [{ ledgerId: INCOME_LEDGER_ID, amount: 500 }],
      ...overrides,
    };
  }

  it("posts exactly one Debit entry and the given Credit entries", async () => {
    postVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);

    await receiptVoucherService.postReceiptVoucher(validInput());

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        voucherType: "RECEIPT",
        financialYearId: FY_ID,
        entries: [
          { ledgerId: CASH_LEDGER_ID, entryType: "DEBIT", amount: 500 },
          { ledgerId: INCOME_LEDGER_ID, entryType: "CREDIT", amount: 500 },
        ],
      })
    );
  });

  it("sums multiple Credit lines into the single Debit entry's amount", async () => {
    postVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);

    await receiptVoucherService.postReceiptVoucher(
      validInput({
        creditLines: [
          { ledgerId: INCOME_LEDGER_ID, amount: 300 },
          { ledgerId: INCOME_LEDGER_ID, amount: 200.5 },
        ],
      })
    );

    const call = postVoucherMock.mock.calls[0][1];
    const debitEntry = call.entries.find((entry: { entryType: string }) => entry.entryType === "DEBIT");
    expect(debitEntry.amount).toBe(500.5);
  });

  it("rejects zero credit lines before calling the engine", async () => {
    await expect(receiptVoucherService.postReceiptVoucher(validInput({ creditLines: [] }))).rejects.toThrow();
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("requires the create permission before posting", async () => {
    postVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);
    await receiptVoucherService.postReceiptVoucher(validInput());
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "create");
  });

  it("rejects when no financial year is active", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    await expect(receiptVoucherService.postReceiptVoucher(validInput())).rejects.toThrow(
      "Select a financial year"
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("postReceiptVoucher — Debit-side ledger-class rejection", () => {
  // Reuses the shared helper's own test fixture/behavior rather than
  // re-deriving a duplicate matrix (53-receipt-voucher.md's Code Standards)
  // — this only verifies the service actually calls the shared check with
  // the Debit ledger id, and propagates its rejection.
  it("propagates the shared helper's rejection for an invalid Debit ledger", async () => {
    assertLedgersAreCashOrBankMock.mockRejectedValue(
      new AppError('Ledger "Sundry Debtor" is not a Cash-in-Hand or bank-linked ledger and cannot be used for this receipt.')
    );

    await expect(
      receiptVoucherService.postReceiptVoucher({
        voucherDate: "2026-09-11",
        debitLedgerId: INCOME_LEDGER_ID,
        paymentModeId: PAYMENT_MODE_ID,
        creditLines: [{ ledgerId: CASH_LEDGER_ID, amount: 100 }],
      })
    ).rejects.toThrow("is not a Cash-in-Hand or bank-linked ledger");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("calls the shared helper with only the Debit ledger id", async () => {
    postVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);

    await receiptVoucherService.postReceiptVoucher({
      voucherDate: "2026-09-11",
      debitLedgerId: CASH_LEDGER_ID,
      paymentModeId: PAYMENT_MODE_ID,
      creditLines: [{ ledgerId: INCOME_LEDGER_ID, amount: 100 }],
    });

    expect(assertLedgersAreCashOrBankMock).toHaveBeenCalledWith(
      expect.anything(),
      COMPANY_ID,
      [CASH_LEDGER_ID],
      "this receipt"
    );
  });
});

describe("postReceiptVoucher — Payment Mode validation (93-payment-mode-integration-manual-vouchers.md)", () => {
  it("validates the payment mode against the Debit (Cash/Bank) ledger via the global prisma client", async () => {
    postVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);

    await receiptVoucherService.postReceiptVoucher({
      voucherDate: "2026-09-11",
      debitLedgerId: CASH_LEDGER_ID,
      paymentModeId: PAYMENT_MODE_ID,
      creditLines: [{ ledgerId: INCOME_LEDGER_ID, amount: 100 }],
    });

    expect(assertPaymentModeMatchesLedgerMock).toHaveBeenCalledWith(prisma, PAYMENT_MODE_ID, CASH_LEDGER_ID, COMPANY_ID);
    expect(postVoucherMock).toHaveBeenCalledWith(COMPANY_ID, expect.objectContaining({ paymentModeId: PAYMENT_MODE_ID }));
  });

  it("propagates the shared helper's rejection for a mismatched payment mode class", async () => {
    assertPaymentModeMatchesLedgerMock.mockRejectedValue(
      new AppError('Payment mode "Cheque" requires a bank-linked ledger.')
    );

    await expect(
      receiptVoucherService.postReceiptVoucher({
        voucherDate: "2026-09-11",
        debitLedgerId: CASH_LEDGER_ID,
        paymentModeId: PAYMENT_MODE_ID,
        creditLines: [{ ledgerId: INCOME_LEDGER_ID, amount: 100 }],
      })
    ).rejects.toThrow("requires a bank-linked ledger");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects a missing paymentModeId before calling the engine", async () => {
    const inputMissingMode = {
      voucherDate: "2026-09-11",
      debitLedgerId: CASH_LEDGER_ID,
      creditLines: [{ ledgerId: INCOME_LEDGER_ID, amount: 100 }],
      // A raw/unchecked payload (e.g. a hand-crafted server action call)
      // can omit a required field even though the Zod-inferred input type
      // says it can't — this cast simulates that at the type layer.
    } as unknown as Parameters<typeof receiptVoucherService.postReceiptVoucher>[0];

    await expect(receiptVoucherService.postReceiptVoucher(inputMissingMode)).rejects.toThrow();
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("cancelReceiptVoucher", () => {
  it("rejects an id belonging to a different voucher type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_RECEIPT_VOUCHER, voucherType: "PAYMENT" });

    await expect(receiptVoucherService.cancelReceiptVoucher(VOUCHER_ID)).rejects.toThrow(
      "Receipt voucher not found."
    );
    expect(cancelVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown id", async () => {
    getVoucherMock.mockResolvedValue(null);
    await expect(receiptVoucherService.cancelReceiptVoucher(VOUCHER_ID)).rejects.toThrow(
      "Receipt voucher not found."
    );
  });

  it("cancels a genuine Receipt Voucher via the engine", async () => {
    getVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);
    cancelVoucherMock.mockResolvedValue({ ...POSTED_RECEIPT_VOUCHER, status: "CANCELLED" });

    const result = await receiptVoucherService.cancelReceiptVoucher(VOUCHER_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID);
    expect(result.status).toBe("CANCELLED");
  });

  it("requires the approve permission", async () => {
    getVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);
    cancelVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);
    await receiptVoucherService.cancelReceiptVoucher(VOUCHER_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "approve");
  });
});

describe("getReceiptVoucher", () => {
  it("returns null for a voucher of a different type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_RECEIPT_VOUCHER, voucherType: "JOURNAL" });
    expect(await receiptVoucherService.getReceiptVoucher(VOUCHER_ID)).toBeNull();
  });

  it("returns the voucher when it is a genuine Receipt Voucher", async () => {
    getVoucherMock.mockResolvedValue(POSTED_RECEIPT_VOUCHER);
    expect(await receiptVoucherService.getReceiptVoucher(VOUCHER_ID)).toEqual(POSTED_RECEIPT_VOUCHER);
  });
});

describe("listReceiptVouchers", () => {
  it("returns an empty list with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    expect(await receiptVoucherService.listReceiptVouchers()).toEqual([]);
    expect(listVouchersMock).not.toHaveBeenCalled();
  });

  it("scopes the list to RECEIPT vouchers in the current financial year", async () => {
    listVouchersMock.mockResolvedValue([POSTED_RECEIPT_VOUCHER]);
    await receiptVoucherService.listReceiptVouchers();
    expect(listVouchersMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "RECEIPT", financialYearId: FY_ID })
    );
  });
});
