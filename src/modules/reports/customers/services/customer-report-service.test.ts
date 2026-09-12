import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getFinancialYearMock,
  getTrialBalanceMock,
  getLedgerStatementMock,
  getPartyWiseSalesReportMock,
  prismaCustomerFindManyMock,
  prismaCustomerFindUniqueMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getFinancialYearMock: vi.fn(),
  getTrialBalanceMock: vi.fn(),
  getLedgerStatementMock: vi.fn(),
  getPartyWiseSalesReportMock: vi.fn(),
  prismaCustomerFindManyMock: vi.fn(),
  prismaCustomerFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findMany: prismaCustomerFindManyMock, findUnique: prismaCustomerFindUniqueMock },
  },
}));
vi.mock("@/engines/voucher/voucher-queries", () => ({
  voucherQueries: { getTrialBalance: getTrialBalanceMock, getLedgerStatement: getLedgerStatementMock },
}));
vi.mock("@/modules/financial-year/services/financial-year-service", () => ({
  financialYearService: { getFinancialYear: getFinancialYearMock },
}));
vi.mock("@/modules/sales-invoices/services/sales-invoice-service", () => ({
  salesInvoiceService: { getPartyWiseSalesReport: getPartyWiseSalesReportMock },
}));

import { customerReportService } from "@/modules/reports/customers/services/customer-report-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const FINANCIAL_YEAR_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";

function decimal(value: number) {
  return { toNumber: () => value };
}

function customerRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CUSTOMER_ID,
    customerType: "RETAIL",
    mobileNumber: "9876543210",
    gstin: null,
    city: "Pune",
    state: "Maharashtra",
    isActive: true,
    ledgerId: "ledger-1",
    creditLimit: null,
    ledger: { name: "Acme Retail", openingBalance: decimal(0), openingBalanceType: "DEBIT" },
    ...overrides,
  };
}

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  getFinancialYearMock.mockReset();
  getTrialBalanceMock.mockReset();
  getLedgerStatementMock.mockReset();
  getPartyWiseSalesReportMock.mockReset();
  prismaCustomerFindManyMock.mockReset();
  prismaCustomerFindUniqueMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockResolvedValue(undefined);
  getFinancialYearMock.mockResolvedValue({
    id: FINANCIAL_YEAR_ID,
    companyId: COMPANY_ID,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2027-03-31T00:00:00.000Z"),
  });
  getTrialBalanceMock.mockResolvedValue({ rows: [], totalDebit: 0, totalCredit: 0 });
  getLedgerStatementMock.mockResolvedValue({ ledgerId: "ledger-1", openingBalance: 0, lines: [], closingBalance: 0 });
  getPartyWiseSalesReportMock.mockResolvedValue([]);
  prismaCustomerFindManyMock.mockResolvedValue([customerRow()]);
  prismaCustomerFindUniqueMock.mockResolvedValue({ ...customerRow(), companyId: COMPANY_ID });
});

describe("customerReportService", () => {
  it("getCustomerOutstandingReport gates on reports:view, validates the financial year, and delegates to voucherQueries.getTrialBalance", async () => {
    const report = await customerReportService.getCustomerOutstandingReport({
      financialYearId: FINANCIAL_YEAR_ID,
      asOfDate: "2026-04-15",
    });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getTrialBalanceMock).toHaveBeenCalledWith(COMPANY_ID, FINANCIAL_YEAR_ID, new Date("2026-04-15T00:00:00.000Z"));
    expect(prismaCustomerFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
    expect(report.rows).toHaveLength(1);
  });

  it("getCustomerOutstandingReport rejects a cross-company financial year", async () => {
    getFinancialYearMock.mockResolvedValueOnce({
      id: FINANCIAL_YEAR_ID,
      companyId: OTHER_COMPANY_ID,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
    });
    await expect(
      customerReportService.getCustomerOutstandingReport({ financialYearId: FINANCIAL_YEAR_ID, asOfDate: "2026-04-15" })
    ).rejects.toThrow();
    expect(getTrialBalanceMock).not.toHaveBeenCalled();
  });

  it("getCustomerOutstandingReport rejects an as-of date outside the financial year's range", async () => {
    await expect(
      customerReportService.getCustomerOutstandingReport({ financialYearId: FINANCIAL_YEAR_ID, asOfDate: "2025-01-01" })
    ).rejects.toThrow();
    expect(getTrialBalanceMock).not.toHaveBeenCalled();
  });

  it("getCustomerStatement gates on reports:view, resolves the customer's ledgerId, and delegates to voucherQueries.getLedgerStatement", async () => {
    const report = await customerReportService.getCustomerStatement({
      customerId: CUSTOMER_ID,
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getLedgerStatementMock).toHaveBeenCalledWith(
      COMPANY_ID,
      "ledger-1",
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    expect(report.customerName).toBe("Acme Retail");
  });

  it("getCustomerStatement rejects a cross-company customerId, resolving identically to not found", async () => {
    prismaCustomerFindUniqueMock.mockResolvedValueOnce({ ...customerRow(), companyId: OTHER_COMPANY_ID });
    await expect(
      customerReportService.getCustomerStatement({ customerId: CUSTOMER_ID, dateFrom: "2026-04-01", dateTo: "2026-04-30" })
    ).rejects.toThrow();
    expect(getLedgerStatementMock).not.toHaveBeenCalled();
  });

  it("getCustomerSalesSummary gates on reports:view and delegates to salesInvoiceService.getPartyWiseSalesReport", async () => {
    await customerReportService.getCustomerSalesSummary({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getPartyWiseSalesReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("getCustomerSalesSummary excludes the Walk-in/Quick synthetic buckets via the Reporting Engine", async () => {
    getPartyWiseSalesReportMock.mockResolvedValueOnce([
      {
        customerId: CUSTOMER_ID,
        customerMode: "PERMANENT",
        customerName: "Acme Retail",
        invoiceCount: 1,
        taxableAmount: 100,
        cgst: 9,
        sgst: 9,
        igst: 0,
        cess: 0,
        grandTotal: 118,
      },
      {
        customerId: null,
        customerMode: "WALK_IN",
        customerName: null,
        invoiceCount: 1,
        taxableAmount: 50,
        cgst: 4.5,
        sgst: 4.5,
        igst: 0,
        cess: 0,
        grandTotal: 59,
      },
    ]);
    const report = await customerReportService.getCustomerSalesSummary({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].customerId).toBe(CUSTOMER_ID);
  });

  it("getCustomerDirectory gates on reports:view and defaults to active-only customers", async () => {
    const report = await customerReportService.getCustomerDirectory({});
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(prismaCustomerFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
    expect(report.rows).toHaveLength(1);
  });

  it("getCustomerDirectory applies the status:'all' filter by omitting the isActive clause", async () => {
    await customerReportService.getCustomerDirectory({ status: "all" });
    expect(prismaCustomerFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
  });

  it("listCustomerOptions gates on reports:view and scopes to the caller's own company, active only", async () => {
    prismaCustomerFindManyMock.mockResolvedValueOnce([{ id: CUSTOMER_ID, ledger: { name: "Acme Retail" } }]);
    const options = await customerReportService.listCustomerOptions();
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(options).toEqual([{ id: CUSTOMER_ID, name: "Acme Retail" }]);
    expect(prismaCustomerFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
  });
});
