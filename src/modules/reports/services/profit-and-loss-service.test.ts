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

import { profitAndLossService } from "@/modules/reports/services/profit-and-loss-service";

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

function ledgerGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    companyId: COMPANY_ID,
    name: "Sales Accounts",
    parentGroupId: null,
    natureType: "INCOME",
    affectsGrossProfit: true,
    isSystemDefined: true,
    isActive: true,
    remarks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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

describe("profitAndLossService.getProfitAndLoss", () => {
  it("gates on the reports:view permission", async () => {
    await profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
  });

  it("throws when the financial year does not belong to the caller's company", async () => {
    getFinancialYearMock.mockResolvedValue(financialYear({ companyId: OTHER_COMPANY_ID }));

    await expect(
      profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("throws when the financial year does not exist", async () => {
    getFinancialYearMock.mockResolvedValue(null);

    await expect(
      profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("rejects a from date before the financial year's startDate", async () => {
    await expect(
      profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-03-31", to: "2026-04-30" })
    ).rejects.toThrow("From/To dates must fall within the selected financial year's date range.");
  });

  it("rejects a to date after the financial year's endDate", async () => {
    await expect(
      profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-04-01", to: "2027-04-01" })
    ).rejects.toThrow("From/To dates must fall within the selected financial year's date range.");
  });

  it("accepts a from/to range on either boundary of the financial year's range", async () => {
    await expect(
      profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-04-01", to: "2027-03-31" })
    ).resolves.toBeDefined();
  });

  it("`from` equal to the FY's own startDate produces the same result as a since-inception P&L", async () => {
    // The FY starts 2026-04-01, so dayBefore(from) is 2026-03-31 — structurally
    // outside the FY, where no voucher can exist (voucher dates are validated
    // against their own FY's range). getTrialBalance must therefore report zero
    // totals as-of that date, and the period figure must equal the ledger's
    // full since-inception total from the as-of-`to` call, unmodified.
    findManyLedgerGroupsMock.mockResolvedValue([ledgerGroup()]);
    getTrialBalanceMock.mockResolvedValueOnce({
      rows: [
        {
          ledgerId: "l1",
          ledgerName: "Sales",
          ledgerGroupId: "group-1",
          openingBalance: 0,
          openingBalanceType: "CREDIT",
          totalDebit: 0,
          totalCredit: 7500,
          closingBalance: -7500,
        },
      ],
      totalDebit: 0,
      totalCredit: 7500,
    });
    getTrialBalanceMock.mockResolvedValueOnce({ rows: [], totalDebit: 0, totalCredit: 0 });

    const report = await profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-06-30" });

    expect(getTrialBalanceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, new Date("2026-03-31T00:00:00.000Z"));
    expect(report.directIncome[0].rows[0].value).toBe(7500);
  });

  it("calls getTrialBalance once as-of `to` and once as-of the day before `from`", async () => {
    await profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-05-01", to: "2026-05-31" });

    expect(getTrialBalanceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, new Date("2026-05-31T00:00:00.000Z"));
    expect(getTrialBalanceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, new Date("2026-04-30T00:00:00.000Z"));
    expect(findManyLedgerGroupsMock).toHaveBeenCalledWith(COMPANY_ID);
  });

  it("isolates period-only movement — prior-period activity before `from` never leaks into the period total", async () => {
    findManyLedgerGroupsMock.mockResolvedValue([ledgerGroup()]);
    getTrialBalanceMock.mockImplementation((_companyId: string, _fyId: string, asOfDate: Date) => {
      // As of `to` (2026-05-31): ledger has accumulated 5000 credit total since FY start.
      // As of the day before `from` (2026-04-30): the same ledger already had 3000 credit
      // from April's activity, which must not leak into this period's total.
      const isAsOfTo = asOfDate.getTime() === new Date("2026-05-31T00:00:00.000Z").getTime();
      return Promise.resolve({
        rows: [
          {
            ledgerId: "l1",
            ledgerName: "Sales",
            ledgerGroupId: "group-1",
            openingBalance: 0,
            openingBalanceType: "CREDIT",
            totalDebit: 0,
            totalCredit: isAsOfTo ? 5000 : 3000,
            closingBalance: isAsOfTo ? -5000 : -3000,
          },
        ],
        totalDebit: 0,
        totalCredit: isAsOfTo ? 5000 : 3000,
      });
    });

    const report = await profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-05-01", to: "2026-05-31" });

    expect(report.directIncome[0].rows[0].value).toBe(2000);
  });

  it("scopes to INCOME/EXPENSE-nature ledgers only, discarding ASSET/LIABILITY rows", async () => {
    findManyLedgerGroupsMock.mockResolvedValue([
      ledgerGroup({ id: "group-1", natureType: "INCOME", affectsGrossProfit: true }),
      ledgerGroup({ id: "group-2", name: "Cash-in-Hand", natureType: "ASSET", affectsGrossProfit: false }),
    ]);
    // First call resolves the as-of-`to` totals; the second (as-of the day
    // before `from`) resolves zero activity, so the diff is non-zero.
    getTrialBalanceMock.mockResolvedValueOnce({
      rows: [
        {
          ledgerId: "l1",
          ledgerName: "Sales",
          ledgerGroupId: "group-1",
          openingBalance: 0,
          openingBalanceType: "CREDIT",
          totalDebit: 0,
          totalCredit: 1000,
          closingBalance: -1000,
        },
        {
          ledgerId: "l2",
          ledgerName: "Cash",
          ledgerGroupId: "group-2",
          openingBalance: 500,
          openingBalanceType: "DEBIT",
          totalDebit: 500,
          totalCredit: 0,
          closingBalance: 500,
        },
      ],
      totalDebit: 500,
      totalCredit: 1000,
    });
    getTrialBalanceMock.mockResolvedValueOnce({ rows: [], totalDebit: 0, totalCredit: 0 });

    const report = await profitAndLossService.getProfitAndLoss({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" });

    expect(report.directIncome[0].rows).toHaveLength(1);
    expect(report.directIncome[0].rows[0].ledgerId).toBe("l1");
  });
});
