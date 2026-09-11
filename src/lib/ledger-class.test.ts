import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors purchase-invoice-service.test.ts's convention for the same two
// dependencies this helper was extracted from.
const { ledgerGroupFindManyMock, findLedgersForValidationMock } = vi.hoisted(() => ({
  ledgerGroupFindManyMock: vi.fn(),
  findLedgersForValidationMock: vi.fn(),
}));

vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: ledgerGroupFindManyMock },
}));
vi.mock("@/modules/ledgers/repositories/ledger-repository", () => ({
  ledgerRepository: { findLedgersForValidation: findLedgersForValidationMock },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { assertLedgersAreCashOrBank } from "@/lib/ledger-class";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const CASH_GROUP_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_GROUP_ID = "10000000-0000-4000-8000-000000000002";
const CASH_LEDGER_ID = "20000000-0000-4000-8000-000000000001";
const BANK_LEDGER_ID = "20000000-0000-4000-8000-000000000002";
const INVALID_LEDGER_ID = "20000000-0000-4000-8000-000000000003";

const LEDGER_GROUPS = [
  { id: CASH_GROUP_ID, companyId: COMPANY_ID, name: "Cash-in-Hand", parentGroupId: null },
  { id: OTHER_GROUP_ID, companyId: COMPANY_ID, name: "Sundry Creditors", parentGroupId: null },
];

beforeEach(() => {
  ledgerGroupFindManyMock.mockReset().mockResolvedValue(LEDGER_GROUPS);
  findLedgersForValidationMock.mockReset();
});

describe("assertLedgersAreCashOrBank", () => {
  it("does nothing for an empty ledger id list", async () => {
    await expect(assertLedgersAreCashOrBank({} as never, COMPANY_ID, [], "payment")).resolves.toBeUndefined();
    expect(findLedgersForValidationMock).not.toHaveBeenCalled();
  });

  it("accepts a ledger under the Cash-in-Hand group", async () => {
    findLedgersForValidationMock.mockResolvedValue([
      { id: CASH_LEDGER_ID, name: "Cash", companyId: COMPANY_ID, isActive: true, ledgerGroupId: CASH_GROUP_ID, hasBankAccount: false },
    ]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [CASH_LEDGER_ID], "payment")
    ).resolves.toBeUndefined();
  });

  it("accepts a ledger carrying a BankAccount detail row even outside the Cash-in-Hand group", async () => {
    findLedgersForValidationMock.mockResolvedValue([
      { id: BANK_LEDGER_ID, name: "HDFC Bank", companyId: COMPANY_ID, isActive: true, ledgerGroupId: OTHER_GROUP_ID, hasBankAccount: true },
    ]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [BANK_LEDGER_ID], "payment")
    ).resolves.toBeUndefined();
  });

  it("rejects an unknown ledger id", async () => {
    findLedgersForValidationMock.mockResolvedValue([]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [INVALID_LEDGER_ID], "payment")
    ).rejects.toThrow("were not found");
  });

  it("rejects a ledger from another company", async () => {
    findLedgersForValidationMock.mockResolvedValue([
      { id: CASH_LEDGER_ID, name: "Cash", companyId: OTHER_COMPANY_ID, isActive: true, ledgerGroupId: CASH_GROUP_ID, hasBankAccount: false },
    ]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [CASH_LEDGER_ID], "payment")
    ).rejects.toThrow("were not found");
  });

  it("rejects an inactive ledger", async () => {
    findLedgersForValidationMock.mockResolvedValue([
      { id: CASH_LEDGER_ID, name: "Cash", companyId: COMPANY_ID, isActive: false, ledgerGroupId: CASH_GROUP_ID, hasBankAccount: false },
    ]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [CASH_LEDGER_ID], "payment")
    ).rejects.toThrow("is inactive");
  });

  it("rejects a ledger that is neither Cash-in-Hand nor bank-linked", async () => {
    findLedgersForValidationMock.mockResolvedValue([
      { id: INVALID_LEDGER_ID, name: "Sundry Creditor", companyId: COMPANY_ID, isActive: true, ledgerGroupId: OTHER_GROUP_ID, hasBankAccount: false },
    ]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [INVALID_LEDGER_ID], "payment")
    ).rejects.toThrow("is not a Cash-in-Hand or bank-linked ledger");
  });

  it("interpolates the given usageLabel into the rejection message", async () => {
    findLedgersForValidationMock.mockResolvedValue([
      { id: INVALID_LEDGER_ID, name: "Sundry Creditor", companyId: COMPANY_ID, isActive: true, ledgerGroupId: OTHER_GROUP_ID, hasBankAccount: false },
    ]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [INVALID_LEDGER_ID], "this payment voucher")
    ).rejects.toThrow("cannot be used for this payment voucher");
  });

  it("validates every ledger id in the batch, not just the first", async () => {
    findLedgersForValidationMock.mockResolvedValue([
      { id: CASH_LEDGER_ID, name: "Cash", companyId: COMPANY_ID, isActive: true, ledgerGroupId: CASH_GROUP_ID, hasBankAccount: false },
      { id: INVALID_LEDGER_ID, name: "Sundry Creditor", companyId: COMPANY_ID, isActive: true, ledgerGroupId: OTHER_GROUP_ID, hasBankAccount: false },
    ]);
    await expect(
      assertLedgersAreCashOrBank({} as never, COMPANY_ID, [CASH_LEDGER_ID, INVALID_LEDGER_ID], "payment")
    ).rejects.toThrow("is not a Cash-in-Hand or bank-linked ledger");
  });
});
