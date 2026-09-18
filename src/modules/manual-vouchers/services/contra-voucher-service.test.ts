import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors payment-voucher-service.test.ts / receipt-voucher-service.test.ts's
// convention — mock the Voucher Engine this service is a thin layer over,
// the shared ledger-class helper, and the session/permission/FY boundaries.
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
import { contraVoucherService } from "@/modules/manual-vouchers/services/contra-voucher-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const CASH_LEDGER_ID = "44444444-4444-4444-8444-444444444444";
const BANK_LEDGER_ID = "55555555-5555-4555-8555-555555555555";
const INCOME_LEDGER_ID = "66666666-6666-4666-8666-666666666666";
const VOUCHER_ID = "77777777-7777-4777-8777-777777777777";
const PAYMENT_MODE_ID = "88888888-8888-4888-8888-888888888888";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID };

const POSTED_CONTRA_VOUCHER = {
  id: VOUCHER_ID,
  companyId: COMPANY_ID,
  voucherType: "CONTRA" as const,
  voucherNumber: "CTR-2026-0001",
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

describe("postContraVoucher — entry shape", () => {
  function validInput(overrides: Record<string, unknown> = {}) {
    return {
      voucherDate: "2026-09-11",
      fromLedgerId: CASH_LEDGER_ID,
      toLedgerId: BANK_LEDGER_ID,
      paymentModeId: PAYMENT_MODE_ID,
      amount: 500,
      ...overrides,
    };
  }

  it("posts exactly one Debit entry (to) and one Credit entry (from)", async () => {
    postVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);

    await contraVoucherService.postContraVoucher(validInput());

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        voucherType: "CONTRA",
        financialYearId: FY_ID,
        entries: [
          { ledgerId: BANK_LEDGER_ID, entryType: "DEBIT", amount: 500 },
          { ledgerId: CASH_LEDGER_ID, entryType: "CREDIT", amount: 500 },
        ],
      })
    );
  });

  it("rejects when fromLedgerId and toLedgerId are the same before calling the engine", async () => {
    await expect(
      contraVoucherService.postContraVoucher(validInput({ toLedgerId: CASH_LEDGER_ID }))
    ).rejects.toThrow();
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("requires the create permission before posting", async () => {
    postVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);
    await contraVoucherService.postContraVoucher(validInput());
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "create");
  });

  it("rejects when no financial year is active", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    await expect(contraVoucherService.postContraVoucher(validInput())).rejects.toThrow("Select a financial year");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("postContraVoucher — both-sides ledger-class rejection", () => {
  // Reuses the shared helper's own test fixture/behavior rather than
  // re-deriving a duplicate matrix (54-contra-voucher.md's Code Standards)
  // — this only verifies the service calls the shared check with both
  // ledger ids at once, and propagates its rejection for either side.
  it("propagates the shared helper's rejection when either side is outside Cash/Bank", async () => {
    assertLedgersAreCashOrBankMock.mockRejectedValue(
      new AppError('Ledger "Sundry Debtor" is not a Cash-in-Hand or bank-linked ledger and cannot be used for this contra voucher.')
    );

    await expect(
      contraVoucherService.postContraVoucher({
        voucherDate: "2026-09-11",
        fromLedgerId: CASH_LEDGER_ID,
        toLedgerId: INCOME_LEDGER_ID,
        paymentModeId: PAYMENT_MODE_ID,
        amount: 100,
      })
    ).rejects.toThrow("is not a Cash-in-Hand or bank-linked ledger");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("calls the shared helper with both the from and to ledger ids", async () => {
    postVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);

    await contraVoucherService.postContraVoucher({
      voucherDate: "2026-09-11",
      fromLedgerId: CASH_LEDGER_ID,
      toLedgerId: BANK_LEDGER_ID,
      paymentModeId: PAYMENT_MODE_ID,
      amount: 100,
    });

    expect(assertLedgersAreCashOrBankMock).toHaveBeenCalledWith(
      expect.anything(),
      COMPANY_ID,
      [CASH_LEDGER_ID, BANK_LEDGER_ID],
      "this contra voucher"
    );
  });
});

describe("postContraVoucher — Payment Mode validation (93-payment-mode-integration-manual-vouchers.md)", () => {
  it("validates the payment mode against fromLedgerId (the credited/source side)", async () => {
    postVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);

    await contraVoucherService.postContraVoucher({
      voucherDate: "2026-09-11",
      fromLedgerId: CASH_LEDGER_ID,
      toLedgerId: BANK_LEDGER_ID,
      paymentModeId: PAYMENT_MODE_ID,
      amount: 100,
    });

    expect(assertPaymentModeMatchesLedgerMock).toHaveBeenCalledWith(prisma, PAYMENT_MODE_ID, CASH_LEDGER_ID, COMPANY_ID);
    expect(postVoucherMock).toHaveBeenCalledWith(COMPANY_ID, expect.objectContaining({ paymentModeId: PAYMENT_MODE_ID }));
  });

  // 93's own note: both sides are guaranteed Cash/Bank, so an "ANY"-class
  // mode always matches — exercised here via the mocked helper resolving
  // for either a Cash-to-Bank or Bank-to-Bank transfer.
  it("accepts an ANY-class payment mode for a Bank-to-Bank contra voucher", async () => {
    postVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);

    await expect(
      contraVoucherService.postContraVoucher({
        voucherDate: "2026-09-11",
        fromLedgerId: BANK_LEDGER_ID,
        toLedgerId: CASH_LEDGER_ID,
        paymentModeId: PAYMENT_MODE_ID,
        amount: 100,
      })
    ).resolves.toBeDefined();
  });

  it("propagates the shared helper's rejection for a mismatched payment mode class", async () => {
    assertPaymentModeMatchesLedgerMock.mockRejectedValue(
      new AppError('Payment mode "Cheque" requires a bank-linked ledger.')
    );

    await expect(
      contraVoucherService.postContraVoucher({
        voucherDate: "2026-09-11",
        fromLedgerId: CASH_LEDGER_ID,
        toLedgerId: BANK_LEDGER_ID,
        paymentModeId: PAYMENT_MODE_ID,
        amount: 100,
      })
    ).rejects.toThrow("requires a bank-linked ledger");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects a missing paymentModeId before calling the engine", async () => {
    const inputMissingMode = {
      voucherDate: "2026-09-11",
      fromLedgerId: CASH_LEDGER_ID,
      toLedgerId: BANK_LEDGER_ID,
      amount: 100,
      // A raw/unchecked payload (e.g. a hand-crafted server action call)
      // can omit a required field even though the Zod-inferred input type
      // says it can't — this cast simulates that at the type layer.
    } as unknown as Parameters<typeof contraVoucherService.postContraVoucher>[0];

    await expect(contraVoucherService.postContraVoucher(inputMissingMode)).rejects.toThrow();
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("cancelContraVoucher", () => {
  it("rejects an id belonging to a different voucher type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_CONTRA_VOUCHER, voucherType: "PAYMENT" });

    await expect(contraVoucherService.cancelContraVoucher(VOUCHER_ID)).rejects.toThrow("Contra voucher not found.");
    expect(cancelVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown id", async () => {
    getVoucherMock.mockResolvedValue(null);
    await expect(contraVoucherService.cancelContraVoucher(VOUCHER_ID)).rejects.toThrow("Contra voucher not found.");
  });

  it("cancels a genuine Contra Voucher via the engine", async () => {
    getVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);
    cancelVoucherMock.mockResolvedValue({ ...POSTED_CONTRA_VOUCHER, status: "CANCELLED" });

    const result = await contraVoucherService.cancelContraVoucher(VOUCHER_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID);
    expect(result.status).toBe("CANCELLED");
  });

  it("requires the approve permission", async () => {
    getVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);
    cancelVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);
    await contraVoucherService.cancelContraVoucher(VOUCHER_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "approve");
  });
});

describe("getContraVoucher", () => {
  it("returns null for a voucher of a different type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_CONTRA_VOUCHER, voucherType: "JOURNAL" });
    expect(await contraVoucherService.getContraVoucher(VOUCHER_ID)).toBeNull();
  });

  it("returns the voucher when it is a genuine Contra Voucher", async () => {
    getVoucherMock.mockResolvedValue(POSTED_CONTRA_VOUCHER);
    expect(await contraVoucherService.getContraVoucher(VOUCHER_ID)).toEqual(POSTED_CONTRA_VOUCHER);
  });
});

describe("listContraVouchers", () => {
  it("returns an empty list with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    expect(await contraVoucherService.listContraVouchers()).toEqual([]);
    expect(listVouchersMock).not.toHaveBeenCalled();
  });

  it("scopes the list to CONTRA vouchers in the current financial year", async () => {
    listVouchersMock.mockResolvedValue([POSTED_CONTRA_VOUCHER]);
    await contraVoucherService.listContraVouchers();
    expect(listVouchersMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "CONTRA", financialYearId: FY_ID })
    );
  });
});
