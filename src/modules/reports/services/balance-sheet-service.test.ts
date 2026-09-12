import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getTrialBalanceMock,
  findManyLedgerGroupsMock,
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getFinancialYearMock,
  getProfitAndLossMock,
} = vi.hoisted(() => ({
  getTrialBalanceMock: vi.fn(),
  findManyLedgerGroupsMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getFinancialYearMock: vi.fn(),
  getProfitAndLossMock: vi.fn(),
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
vi.mock("@/modules/reports/services/profit-and-loss-service", () => ({
  profitAndLossService: { getProfitAndLoss: getProfitAndLossMock },
}));

import { balanceSheetService } from "@/modules/reports/services/balance-sheet-service";

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
  getProfitAndLossMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockResolvedValue(undefined);
  getFinancialYearMock.mockResolvedValue(financialYear());
  getTrialBalanceMock.mockResolvedValue({ rows: [], totalDebit: 0, totalCredit: 0 });
  findManyLedgerGroupsMock.mockResolvedValue([]);
  getProfitAndLossMock.mockResolvedValue({
    directIncome: [],
    directExpense: [],
    indirectIncome: [],
    indirectExpense: [],
    grossProfit: 0,
    netProfit: 0,
  });
});

describe("balanceSheetService.getBalanceSheet", () => {
  it("gates on the reports:view permission", async () => {
    await balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-04-15" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
  });

  it("throws when the financial year does not belong to the caller's company", async () => {
    getFinancialYearMock.mockResolvedValue(financialYear({ companyId: OTHER_COMPANY_ID }));

    await expect(
      balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-04-15" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("throws when the financial year does not exist", async () => {
    getFinancialYearMock.mockResolvedValue(null);

    await expect(
      balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-04-15" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("rejects an as-of date before the financial year's startDate", async () => {
    await expect(
      balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-03-31" })
    ).rejects.toThrow("As-of date must fall within the selected financial year's date range.");
  });

  it("rejects an as-of date after the financial year's endDate", async () => {
    await expect(
      balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2027-04-01" })
    ).rejects.toThrow("As-of date must fall within the selected financial year's date range.");
  });

  it("accepts an as-of date on either boundary of the financial year's range", async () => {
    await expect(
      balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-04-01" })
    ).resolves.toBeDefined();
    await expect(
      balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2027-03-31" })
    ).resolves.toBeDefined();
  });

  it("calls profitAndLossService.getProfitAndLoss with the FY's own startDate through asOfDate, never recomputing Net Profit itself", async () => {
    await balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-06-30" });

    expect(getProfitAndLossMock).toHaveBeenCalledWith({
      financialYearId: FY_ID,
      from: "2026-04-01",
      to: "2026-06-30",
    });
  });

  it("fetches the trial balance and ledger groups scoped to the caller's own company", async () => {
    await balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-04-15" });

    expect(getTrialBalanceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, new Date("2026-04-15T00:00:00.000Z"));
    expect(findManyLedgerGroupsMock).toHaveBeenCalledWith(COMPANY_ID);
  });

  it("passes profitAndLossService's own netProfit straight through to the built report", async () => {
    getProfitAndLossMock.mockResolvedValue({
      directIncome: [],
      directExpense: [],
      indirectIncome: [],
      indirectExpense: [],
      grossProfit: 4200,
      netProfit: 4200,
    });

    const report = await balanceSheetService.getBalanceSheet({ financialYearId: FY_ID, asOfDate: "2026-04-15" });

    expect(report.netProfit).toBe(4200);
  });
});
