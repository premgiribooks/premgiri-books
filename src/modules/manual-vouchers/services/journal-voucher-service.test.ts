import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors receipt-voucher-service.test.ts's convention — mock the Voucher
// Engine this service is a thin layer over, and the session/permission/FY
// boundaries. No `assertLedgersAreCashOrBank` mock is needed here, unlike
// Payment/Receipt/Contra — Journal Voucher applies no ledger-class
// restriction at all (55-journal-voucher.md's Business Rules).
const { postVoucherMock, cancelVoucherMock, getVoucherMock, listVouchersMock, getCurrentCompanyUserMock, getCurrentFinancialYearMock, assertPermissionMock } =
  vi.hoisted(() => ({
    postVoucherMock: vi.fn(),
    cancelVoucherMock: vi.fn(),
    getVoucherMock: vi.fn(),
    listVouchersMock: vi.fn(),
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
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));

import { AppError } from "@/lib/app-error";
import { journalVoucherService } from "@/modules/manual-vouchers/services/journal-voucher-service";
import type { CreateJournalVoucherInput } from "@/modules/manual-vouchers/validation/journal-voucher-schema";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const LEDGER_A = "44444444-4444-4444-8444-444444444444";
const LEDGER_B = "55555555-5555-4555-8555-555555555555";
const LEDGER_C = "66666666-6666-4666-8666-666666666666";
const VOUCHER_ID = "77777777-7777-4777-8777-777777777777";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID };

const POSTED_JOURNAL_VOUCHER = {
  id: VOUCHER_ID,
  companyId: COMPANY_ID,
  voucherType: "JOURNAL" as const,
  voucherNumber: "JNL-2026-0001",
  status: "POSTED" as const,
  totalAmount: 500,
  entries: [],
};

/** Simulates a plain `create`-only user — `approve` is rejected, every other action passes. */
function rejectApprove() {
  assertPermissionMock.mockImplementation(async (_user: unknown, _module: string, action: string) => {
    if (action === "approve") {
      throw new AppError("You do not have permission to approve accounting.");
    }
  });
}

beforeEach(() => {
  postVoucherMock.mockReset();
  cancelVoucherMock.mockReset();
  getVoucherMock.mockReset();
  listVouchersMock.mockReset();
  getCurrentCompanyUserMock.mockReset().mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockReset().mockResolvedValue({ id: FY_ID });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
});

describe("postJournalVoucher — entry shape", () => {
  function validInput(overrides: Partial<CreateJournalVoucherInput> = {}): CreateJournalVoucherInput {
    return {
      voucherDate: "2026-09-11",
      entries: [
        { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 },
        { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 500 },
      ],
      ...overrides,
    };
  }

  it("posts the given entries unmodified, no additional shaping", async () => {
    postVoucherMock.mockResolvedValue(POSTED_JOURNAL_VOUCHER);

    await journalVoucherService.postJournalVoucher(validInput());

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        voucherType: "JOURNAL",
        financialYearId: FY_ID,
        entries: [
          { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 },
          { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 500 },
        ],
      })
    );
  });

  it("posts a freeform multi-line entry set with mixed Debit/Credit counts on either side when balanced", async () => {
    postVoucherMock.mockResolvedValue(POSTED_JOURNAL_VOUCHER);

    await journalVoucherService.postJournalVoucher(
      validInput({
        entries: [
          { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 300 },
          { ledgerId: LEDGER_B, entryType: "DEBIT", amount: 200 },
          { ledgerId: LEDGER_C, entryType: "CREDIT", amount: 500 },
        ],
      })
    );

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        entries: [
          { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 300 },
          { ledgerId: LEDGER_B, entryType: "DEBIT", amount: 200 },
          { ledgerId: LEDGER_C, entryType: "CREDIT", amount: 500 },
        ],
      })
    );
  });

  it("propagates the engine's rejection of an unbalanced entry set rather than silently accepting it", async () => {
    postVoucherMock.mockRejectedValue(new AppError("Voucher entries are not balanced: total debit must equal total credit."));

    await expect(
      journalVoucherService.postJournalVoucher(
        validInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 },
            { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 300 },
          ],
        })
      )
    ).rejects.toThrow("not balanced");
  });

  it("requires the approve permission before posting, not merely create", async () => {
    postVoucherMock.mockResolvedValue(POSTED_JOURNAL_VOUCHER);
    await journalVoucherService.postJournalVoucher(validInput());
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "approve");
  });

  it("rejects a plain create-only user, unlike Payment/Receipt/Contra Voucher", async () => {
    rejectApprove();
    await expect(journalVoucherService.postJournalVoucher(validInput())).rejects.toThrow(
      "You do not have permission to approve"
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects when no financial year is active", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    await expect(journalVoucherService.postJournalVoucher(validInput())).rejects.toThrow("Select a financial year");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects fewer than 2 entries before calling the engine", async () => {
    await expect(
      journalVoucherService.postJournalVoucher(
        validInput({ entries: [{ ledgerId: LEDGER_A, entryType: "DEBIT", amount: 500 }] })
      )
    ).rejects.toThrow();
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("cancelJournalVoucher", () => {
  it("rejects an id belonging to a different voucher type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_JOURNAL_VOUCHER, voucherType: "PAYMENT" });

    await expect(journalVoucherService.cancelJournalVoucher(VOUCHER_ID)).rejects.toThrow("Journal voucher not found.");
    expect(cancelVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown id", async () => {
    getVoucherMock.mockResolvedValue(null);
    await expect(journalVoucherService.cancelJournalVoucher(VOUCHER_ID)).rejects.toThrow("Journal voucher not found.");
  });

  it("cancels a genuine Journal Voucher via the engine", async () => {
    getVoucherMock.mockResolvedValue(POSTED_JOURNAL_VOUCHER);
    cancelVoucherMock.mockResolvedValue({ ...POSTED_JOURNAL_VOUCHER, status: "CANCELLED" });

    const result = await journalVoucherService.cancelJournalVoucher(VOUCHER_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID);
    expect(result.status).toBe("CANCELLED");
  });

  it("requires the approve permission", async () => {
    getVoucherMock.mockResolvedValue(POSTED_JOURNAL_VOUCHER);
    cancelVoucherMock.mockResolvedValue(POSTED_JOURNAL_VOUCHER);
    await journalVoucherService.cancelJournalVoucher(VOUCHER_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "accounting", "approve");
  });

  it("rejects a plain create-only user", async () => {
    rejectApprove();
    await expect(journalVoucherService.cancelJournalVoucher(VOUCHER_ID)).rejects.toThrow(
      "You do not have permission to approve"
    );
    expect(cancelVoucherMock).not.toHaveBeenCalled();
  });
});

describe("getJournalVoucher", () => {
  it("returns null for a voucher of a different type", async () => {
    getVoucherMock.mockResolvedValue({ ...POSTED_JOURNAL_VOUCHER, voucherType: "RECEIPT" });
    expect(await journalVoucherService.getJournalVoucher(VOUCHER_ID)).toBeNull();
  });

  it("returns the voucher when it is a genuine Journal Voucher", async () => {
    getVoucherMock.mockResolvedValue(POSTED_JOURNAL_VOUCHER);
    expect(await journalVoucherService.getJournalVoucher(VOUCHER_ID)).toEqual(POSTED_JOURNAL_VOUCHER);
  });
});

describe("listJournalVouchers", () => {
  it("returns an empty list with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    expect(await journalVoucherService.listJournalVouchers()).toEqual([]);
    expect(listVouchersMock).not.toHaveBeenCalled();
  });

  it("scopes the list to JOURNAL vouchers in the current financial year", async () => {
    listVouchersMock.mockResolvedValue([POSTED_JOURNAL_VOUCHER]);
    await journalVoucherService.listJournalVouchers();
    expect(listVouchersMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "JOURNAL", financialYearId: FY_ID })
    );
  });
});
