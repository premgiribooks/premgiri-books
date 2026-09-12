import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCashAndBankLedgerIdsMock,
  getLedgerStatementMock,
  findCashTouchingEntriesMock,
  findManyLedgerGroupsMock,
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getFinancialYearMock,
} = vi.hoisted(() => ({
  getCashAndBankLedgerIdsMock: vi.fn(),
  getLedgerStatementMock: vi.fn(),
  findCashTouchingEntriesMock: vi.fn(),
  findManyLedgerGroupsMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getFinancialYearMock: vi.fn(),
}));

vi.mock("@/lib/ledger-class", () => ({ getCashAndBankLedgerIds: getCashAndBankLedgerIdsMock }));
vi.mock("@/engines/voucher/voucher-queries", () => ({
  voucherQueries: { getLedgerStatement: getLedgerStatementMock },
}));
vi.mock("@/modules/vouchers/repositories/voucher-repository", () => ({
  voucherRepository: { findCashTouchingEntries: findCashTouchingEntriesMock },
}));
vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: findManyLedgerGroupsMock },
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/modules/financial-year/services/financial-year-service", () => ({
  financialYearService: { getFinancialYear: getFinancialYearMock },
}));

import { cashFlowService } from "@/modules/reports/services/cash-flow-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const CASH_LEDGER_ID = "33333333-3333-4333-8333-333333333333";
const BANK_LEDGER_ID = "44444444-4444-4444-8444-444444444444";

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
  getCashAndBankLedgerIdsMock.mockReset();
  getLedgerStatementMock.mockReset();
  findCashTouchingEntriesMock.mockReset();
  findManyLedgerGroupsMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  getFinancialYearMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockResolvedValue(undefined);
  getFinancialYearMock.mockResolvedValue(financialYear());
  getCashAndBankLedgerIdsMock.mockResolvedValue(new Set([CASH_LEDGER_ID, BANK_LEDGER_ID]));
  getLedgerStatementMock.mockResolvedValue({ ledgerId: CASH_LEDGER_ID, openingBalance: 0, lines: [], closingBalance: 0 });
  findCashTouchingEntriesMock.mockResolvedValue([]);
  findManyLedgerGroupsMock.mockResolvedValue([]);
});

describe("cashFlowService.getCashFlow", () => {
  it("gates on the reports:view permission", async () => {
    await cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
  });

  it("throws when the financial year does not belong to the caller's company", async () => {
    getFinancialYearMock.mockResolvedValue(financialYear({ companyId: OTHER_COMPANY_ID }));

    await expect(
      cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("throws when the financial year does not exist", async () => {
    getFinancialYearMock.mockResolvedValue(null);

    await expect(
      cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" })
    ).rejects.toThrow("Financial year not found.");
  });

  it("rejects a from date before the financial year's startDate", async () => {
    await expect(
      cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-03-31", to: "2026-04-30" })
    ).rejects.toThrow("From/To dates must fall within the selected financial year's date range.");
  });

  it("rejects a to date after the financial year's endDate", async () => {
    await expect(
      cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2027-04-01" })
    ).rejects.toThrow("From/To dates must fall within the selected financial year's date range.");
  });

  it("accepts from/to on either boundary of the financial year's range", async () => {
    await expect(
      cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2027-03-31" })
    ).resolves.toBeDefined();
  });

  it("calls getLedgerStatement once per Cash/Bank ledger, scoped to the caller's own company and the requested range", async () => {
    await cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" });

    expect(getLedgerStatementMock).toHaveBeenCalledWith(
      COMPANY_ID,
      CASH_LEDGER_ID,
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    expect(getLedgerStatementMock).toHaveBeenCalledWith(
      COMPANY_ID,
      BANK_LEDGER_ID,
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
  });

  it("passes the resolved Cash/Bank ledger id list straight through to findCashTouchingEntries", async () => {
    await cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" });

    expect(findCashTouchingEntriesMock).toHaveBeenCalledWith(
      COMPANY_ID,
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z"),
      expect.arrayContaining([CASH_LEDGER_ID, BANK_LEDGER_ID])
    );
  });

  it("derives each Cash/Bank ledger's net change as closingBalance minus openingBalance, never re-summing entries", async () => {
    getLedgerStatementMock.mockImplementation(async (_companyId: string, ledgerId: string) => ({
      ledgerId,
      openingBalance: 1000,
      lines: [],
      closingBalance: 1600,
    }));

    const report = await cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" });

    expect(report.netChangeInCash).toBe(1200);
  });

  it("fetches ledger groups scoped to the caller's own company", async () => {
    await cashFlowService.getCashFlow({ financialYearId: FY_ID, from: "2026-04-01", to: "2026-04-30" });

    expect(findManyLedgerGroupsMock).toHaveBeenCalledWith(COMPANY_ID);
  });
});
