import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTrialBalanceMock, findManyLedgerGroupsMock, getCurrentCompanyUserMock, assertPermissionMock, getFinancialYearMock } =
  vi.hoisted(() => ({
    getTrialBalanceMock: vi.fn(),
    findManyLedgerGroupsMock: vi.fn(),
    getCurrentCompanyUserMock: vi.fn(),
    assertPermissionMock: vi.fn(),
    getFinancialYearMock: vi.fn(),
  }));

vi.mock("@/engines/voucher/voucher-queries", () => ({
  voucherQueries: { getTrialBalance: getTrialBalanceMock },
}));
vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: findManyLedgerGroupsMock },
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/modules/financial-year/services/financial-year-service", () => ({
  financialYearService: { getFinancialYear: getFinancialYearMock },
}));

import { liabilitySettlementService } from "@/modules/liability-settlement/services/liability-settlement-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";

function financialYear(overrides: Partial<{ companyId: string; startDate: Date; endDate: Date }> = {}) {
  return {
    id: FY_ID,
    companyId: COMPANY_ID,
    name: "FY 2026-27",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2027-03-31T00:00:00.000Z"),
    isCurrent: true,
    isClosed: false,
    ...overrides,
  };
}

beforeEach(() => {
  getTrialBalanceMock.mockReset();
  findManyLedgerGroupsMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  getFinancialYearMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockResolvedValue(undefined);
  getFinancialYearMock.mockResolvedValue(financialYear());
  getTrialBalanceMock.mockResolvedValue({ rows: [], totalDebit: 0, totalCredit: 0 });
  findManyLedgerGroupsMock.mockResolvedValue([]);
});

describe("liabilitySettlementService.getOutstandingLiabilities", () => {
  it("gates on the accounting:view permission", async () => {
    await liabilitySettlementService.getOutstandingLiabilities({ financialYearId: FY_ID, asOfDate: "2026-04-15" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "accounting", "view");
  });

  it("throws when the financial year does not belong to the caller's company", async () => {
    getFinancialYearMock.mockResolvedValue(financialYear({ companyId: OTHER_COMPANY_ID }));

    await expect(
      liabilitySettlementService.getOutstandingLiabilities({ financialYearId: FY_ID, asOfDate: "2026-04-15" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("throws when the financial year does not exist", async () => {
    getFinancialYearMock.mockResolvedValue(null);

    await expect(
      liabilitySettlementService.getOutstandingLiabilities({ financialYearId: FY_ID, asOfDate: "2026-04-15" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("rejects an as-of date before the financial year's startDate", async () => {
    await expect(
      liabilitySettlementService.getOutstandingLiabilities({ financialYearId: FY_ID, asOfDate: "2026-03-31" })
    ).rejects.toThrow("As-of date must fall within the selected financial year's date range.");
  });

  it("rejects an as-of date after the financial year's endDate", async () => {
    await expect(
      liabilitySettlementService.getOutstandingLiabilities({ financialYearId: FY_ID, asOfDate: "2027-04-01" })
    ).rejects.toThrow("As-of date must fall within the selected financial year's date range.");
  });

  it("fetches the trial balance and ledger groups scoped to the caller's own company", async () => {
    await liabilitySettlementService.getOutstandingLiabilities({ financialYearId: FY_ID, asOfDate: "2026-04-15" });

    expect(getTrialBalanceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, new Date("2026-04-15T00:00:00.000Z"));
    expect(findManyLedgerGroupsMock).toHaveBeenCalledWith(COMPANY_ID);
  });

  it("returns only LIABILITY-nature ledgers with a positive outstanding balance", async () => {
    getTrialBalanceMock.mockResolvedValue({
      rows: [
        {
          ledgerId: "l1",
          ledgerName: "ABC Traders",
          ledgerGroupId: "suppliers",
          openingBalance: 0,
          openingBalanceType: "CREDIT",
          totalDebit: 0,
          totalCredit: 500,
          closingBalance: -500,
        },
        {
          ledgerId: "l2",
          ledgerName: "Cash",
          ledgerGroupId: "cash",
          openingBalance: 0,
          openingBalanceType: "DEBIT",
          totalDebit: 300,
          totalCredit: 0,
          closingBalance: 300,
        },
      ],
      totalDebit: 300,
      totalCredit: 500,
    });
    findManyLedgerGroupsMock.mockResolvedValue([
      {
        id: "suppliers",
        name: "Sundry Creditors",
        companyId: COMPANY_ID,
        parentGroupId: null,
        natureType: "LIABILITY",
        affectsGrossProfit: false,
        isSystemDefined: false,
        isActive: true,
        remarks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "cash",
        name: "Cash-in-Hand",
        companyId: COMPANY_ID,
        parentGroupId: null,
        natureType: "ASSET",
        affectsGrossProfit: false,
        isSystemDefined: false,
        isActive: true,
        remarks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const report = await liabilitySettlementService.getOutstandingLiabilities({
      financialYearId: FY_ID,
      asOfDate: "2026-04-15",
    });

    expect(report.rows).toEqual([
      {
        ledgerId: "l1",
        ledgerName: "ABC Traders",
        ledgerGroupId: "suppliers",
        ledgerGroupName: "Sundry Creditors",
        outstandingAmount: 500,
      },
    ]);
    expect(report.totalOutstanding).toBe(500);
  });
});
