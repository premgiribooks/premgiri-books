import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors purchase-invoice-service.test.ts's / stock-adjustment-service.test.ts's
// convention — mock the Voucher Engine this service is a thin layer over,
// the shared ledger-class helper, and the session/permission/FY boundaries.
const {
  postVoucherMock,
  cancelVoucherMock,
  getVoucherMock,
  listVouchersMock,
  assertLedgersAreCashOrBankMock,
  ledgerFindManyMock,
  ledgerGroupFindManyMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  getLedgerBalanceMock,
} = vi.hoisted(() => ({
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  getVoucherMock: vi.fn(),
  listVouchersMock: vi.fn(),
  assertLedgersAreCashOrBankMock: vi.fn(),
  ledgerFindManyMock: vi.fn(),
  ledgerGroupFindManyMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getLedgerBalanceMock: vi.fn(),
}));

vi.mock("@/engines/voucher/voucher-engine", () => ({
  voucherEngine: {
    postVoucher: postVoucherMock,
    cancelVoucher: cancelVoucherMock,
    getVoucher: getVoucherMock,
    listVouchers: listVouchersMock,
  },
}));
vi.mock("@/engines/voucher/voucher-queries", () => ({
  voucherQueries: { getLedgerBalance: getLedgerBalanceMock },
}));
vi.mock("@/lib/ledger-class", () => ({ assertLedgersAreCashOrBank: assertLedgersAreCashOrBankMock }));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: ledgerGroupFindManyMock },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { ledger: { findMany: ledgerFindManyMock } },
}));

import { AppError } from "@/lib/app-error";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const CASH_LEDGER_ID = "44444444-4444-4444-8444-444444444444";
const EXPENSE_LEDGER_ID = "55555555-5555-4555-8555-555555555555";
const VOUCHER_ID = "66666666-6666-4666-8666-666666666666";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID };

const POSTED_PAYMENT_VOUCHER = {
  id: VOUCHER_ID,
  companyId: COMPANY_ID,
  voucherType: "PAYMENT" as const,
  voucherNumber: "PV-2026-0001",
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
  ledgerFindManyMock.mockReset().mockResolvedValue([]);
  ledgerGroupFindManyMock.mockReset().mockResolvedValue([]);
  getCurrentCompanyUserMock.mockReset().mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockReset().mockResolvedValue({ id: FY_ID });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
  getLedgerBalanceMock.mockReset();
});

describe("postPaymentVoucher — entry shape", () => {
  function validInput(overrides: Record<string, unknown> = {}) {
    return {
      voucherDate: "2026-09-11",
      creditLedgerId: CASH_LEDGER_ID,
      debitLines: [{ ledgerId: EXPENSE_LEDGER_ID, amount: 500 }],
      ...overrides,
    };
  }

  it("posts exactly one Credit entry and the given Debit entries", async () => {
    postVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);

    await paymentVoucherService.postPaymentVoucher(validInput());

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        voucherType: "PAYMENT",
        financialYearId: FY_ID,
        entries: [
          { ledgerId: CASH_LEDGER_ID, entryType: "CREDIT", amount: 500 },
          { ledgerId: EXPENSE_LEDGER_ID, entryType: "DEBIT", amount: 500 },
        ],
      })
    );
  });

  it("sums multiple Debit lines into the single Credit entry's amount", async () => {
    postVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);

    await paymentVoucherService.postPaymentVoucher(
      validInput({
        debitLines: [
          { ledgerId: EXPENSE_LEDGER_ID, amount: 300 },
          { ledgerId: EXPENSE_LEDGER_ID, amount: 200.5 },
        ],
      })
    );

    const call = postVoucherMock.mock.calls[0][1];
    const creditEntry = call.entries.find((entry: { entryType: string }) => entry.entryType === "CREDIT");
    expect(creditEntry.amount).toBe(500.5);
  });

  it("rejects zero debit lines before calling the engine", async () => {
    await expect(paymentVoucherService.postPaymentVoucher(validInput({ debitLines: [] }))).rejects.toThrow();
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("requires the create permission before posting", async () => {
    postVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);
    await paymentVoucherService.postPaymentVoucher(validInput());
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "create");
  });

  it("rejects when no financial year is active", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    await expect(paymentVoucherService.postPaymentVoucher(validInput())).rejects.toThrow(
      "Select a financial year"
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("postPaymentVoucher — Credit-side ledger-class rejection", () => {
  // Reuses the shared helper's own test fixture/behavior rather than
  // re-deriving a duplicate matrix (52-payment-voucher.md's Code Standards)
  // — this only verifies the service actually calls the shared check with
  // the Credit ledger id, and propagates its rejection.
  it("propagates the shared helper's rejection for an invalid Credit ledger", async () => {
    assertLedgersAreCashOrBankMock.mockRejectedValue(
      new AppError('Ledger "Sundry Creditor" is not a Cash-in-Hand or bank-linked ledger and cannot be used for this payment.')
    );

    await expect(
      paymentVoucherService.postPaymentVoucher({
        voucherDate: "2026-09-11",
        creditLedgerId: EXPENSE_LEDGER_ID,
        debitLines: [{ ledgerId: CASH_LEDGER_ID, amount: 100 }],
      })
    ).rejects.toThrow("is not a Cash-in-Hand or bank-linked ledger");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("calls the shared helper with only the Credit ledger id", async () => {
    postVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);

    await paymentVoucherService.postPaymentVoucher({
      voucherDate: "2026-09-11",
      creditLedgerId: CASH_LEDGER_ID,
      debitLines: [{ ledgerId: EXPENSE_LEDGER_ID, amount: 100 }],
    });

    expect(assertLedgersAreCashOrBankMock).toHaveBeenCalledWith(
      expect.anything(),
      COMPANY_ID,
      [CASH_LEDGER_ID],
      "this payment"
    );
  });
});

describe("cancelPaymentVoucher", () => {
  it("rejects an id belonging to a different voucher type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_PAYMENT_VOUCHER, voucherType: "RECEIPT" });

    await expect(paymentVoucherService.cancelPaymentVoucher(VOUCHER_ID)).rejects.toThrow(
      "Payment voucher not found."
    );
    expect(cancelVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown id", async () => {
    getVoucherMock.mockResolvedValue(null);
    await expect(paymentVoucherService.cancelPaymentVoucher(VOUCHER_ID)).rejects.toThrow(
      "Payment voucher not found."
    );
  });

  it("cancels a genuine Payment Voucher via the engine", async () => {
    getVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);
    cancelVoucherMock.mockResolvedValue({ ...POSTED_PAYMENT_VOUCHER, status: "CANCELLED" });

    const result = await paymentVoucherService.cancelPaymentVoucher(VOUCHER_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID);
    expect(result.status).toBe("CANCELLED");
  });

  it("requires the approve permission", async () => {
    getVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);
    cancelVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);
    await paymentVoucherService.cancelPaymentVoucher(VOUCHER_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "approve");
  });
});

describe("getPaymentVoucher", () => {
  it("returns null for a voucher of a different type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_PAYMENT_VOUCHER, voucherType: "JOURNAL" });
    expect(await paymentVoucherService.getPaymentVoucher(VOUCHER_ID)).toBeNull();
  });

  it("returns the voucher when it is a genuine Payment Voucher", async () => {
    getVoucherMock.mockResolvedValue(POSTED_PAYMENT_VOUCHER);
    expect(await paymentVoucherService.getPaymentVoucher(VOUCHER_ID)).toEqual(POSTED_PAYMENT_VOUCHER);
  });
});

describe("listPaymentVouchers", () => {
  it("returns an empty list with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    expect(await paymentVoucherService.listPaymentVouchers()).toEqual([]);
    expect(listVouchersMock).not.toHaveBeenCalled();
  });

  it("scopes the list to PAYMENT vouchers in the current financial year", async () => {
    listVouchersMock.mockResolvedValue([POSTED_PAYMENT_VOUCHER]);
    await paymentVoucherService.listPaymentVouchers();
    expect(listVouchersMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "PAYMENT", financialYearId: FY_ID })
    );
  });
});

// Shared by both Payment Voucher and Receipt Voucher's forms — see
// receipt-vouchers/new/page.tsx's own reuse of listLedgerOptions.
describe("getLedgerOutstandingBalance", () => {
  it("asserts accounting/view and delegates to voucherQueries.getLedgerBalance, company-scoped", async () => {
    const balance = {
      ledgerId: CASH_LEDGER_ID,
      openingBalance: 0,
      openingBalanceType: "DEBIT" as const,
      totalDebit: 500,
      totalCredit: 200,
      netMovement: 300,
      closingBalance: 300,
    };
    getLedgerBalanceMock.mockResolvedValue(balance);

    const result = await paymentVoucherService.getLedgerOutstandingBalance(CASH_LEDGER_ID);

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "view");
    expect(getLedgerBalanceMock).toHaveBeenCalledWith(COMPANY_ID, CASH_LEDGER_ID);
    expect(result).toEqual(balance);
  });
});
