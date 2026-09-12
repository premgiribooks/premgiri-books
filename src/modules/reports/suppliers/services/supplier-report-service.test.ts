import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getFinancialYearMock,
  getTrialBalanceMock,
  getLedgerStatementMock,
  getPartyWisePurchaseReportMock,
  prismaSupplierFindManyMock,
  prismaSupplierFindUniqueMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getFinancialYearMock: vi.fn(),
  getTrialBalanceMock: vi.fn(),
  getLedgerStatementMock: vi.fn(),
  getPartyWisePurchaseReportMock: vi.fn(),
  prismaSupplierFindManyMock: vi.fn(),
  prismaSupplierFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: { findMany: prismaSupplierFindManyMock, findUnique: prismaSupplierFindUniqueMock },
  },
}));
vi.mock("@/engines/voucher/voucher-queries", () => ({
  voucherQueries: { getTrialBalance: getTrialBalanceMock, getLedgerStatement: getLedgerStatementMock },
}));
vi.mock("@/modules/financial-year/services/financial-year-service", () => ({
  financialYearService: { getFinancialYear: getFinancialYearMock },
}));
vi.mock("@/modules/purchase-invoices/services/purchase-invoice-service", () => ({
  purchaseInvoiceService: { getPartyWisePurchaseReport: getPartyWisePurchaseReportMock },
}));

import { supplierReportService } from "@/modules/reports/suppliers/services/supplier-report-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const FINANCIAL_YEAR_ID = "33333333-3333-4333-8333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-8444-444444444444";

function decimal(value: number) {
  return { toNumber: () => value };
}

function supplierRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SUPPLIER_ID,
    mobileNumber: "9876543210",
    gstin: null,
    city: "Pune",
    state: "Maharashtra",
    isActive: true,
    ledgerId: "ledger-1",
    creditDays: 30,
    ledger: { name: "Acme Wholesale", openingBalance: decimal(0), openingBalanceType: "DEBIT" },
    ...overrides,
  };
}

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  getFinancialYearMock.mockReset();
  getTrialBalanceMock.mockReset();
  getLedgerStatementMock.mockReset();
  getPartyWisePurchaseReportMock.mockReset();
  prismaSupplierFindManyMock.mockReset();
  prismaSupplierFindUniqueMock.mockReset();

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
  getPartyWisePurchaseReportMock.mockResolvedValue([]);
  prismaSupplierFindManyMock.mockResolvedValue([supplierRow()]);
  prismaSupplierFindUniqueMock.mockResolvedValue({ ...supplierRow(), companyId: COMPANY_ID });
});

describe("supplierReportService", () => {
  it("getSupplierOutstandingReport gates on reports:view, validates the financial year, and delegates to voucherQueries.getTrialBalance", async () => {
    const report = await supplierReportService.getSupplierOutstandingReport({
      financialYearId: FINANCIAL_YEAR_ID,
      asOfDate: "2026-04-15",
    });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getTrialBalanceMock).toHaveBeenCalledWith(COMPANY_ID, FINANCIAL_YEAR_ID, new Date("2026-04-15T00:00:00.000Z"));
    expect(prismaSupplierFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).not.toHaveProperty("isOverLimit");
  });

  it("getSupplierOutstandingReport rejects a cross-company financial year", async () => {
    getFinancialYearMock.mockResolvedValueOnce({
      id: FINANCIAL_YEAR_ID,
      companyId: OTHER_COMPANY_ID,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
    });
    await expect(
      supplierReportService.getSupplierOutstandingReport({ financialYearId: FINANCIAL_YEAR_ID, asOfDate: "2026-04-15" })
    ).rejects.toThrow();
    expect(getTrialBalanceMock).not.toHaveBeenCalled();
  });

  it("getSupplierOutstandingReport rejects an as-of date outside the financial year's range", async () => {
    await expect(
      supplierReportService.getSupplierOutstandingReport({ financialYearId: FINANCIAL_YEAR_ID, asOfDate: "2025-01-01" })
    ).rejects.toThrow();
    expect(getTrialBalanceMock).not.toHaveBeenCalled();
  });

  it("getSupplierStatement gates on reports:view, resolves the supplier's ledgerId, and delegates to voucherQueries.getLedgerStatement", async () => {
    const report = await supplierReportService.getSupplierStatement({
      supplierId: SUPPLIER_ID,
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
    expect(report.supplierName).toBe("Acme Wholesale");
  });

  it("getSupplierStatement rejects a cross-company supplierId, resolving identically to not found", async () => {
    prismaSupplierFindUniqueMock.mockResolvedValueOnce({ ...supplierRow(), companyId: OTHER_COMPANY_ID });
    await expect(
      supplierReportService.getSupplierStatement({ supplierId: SUPPLIER_ID, dateFrom: "2026-04-01", dateTo: "2026-04-30" })
    ).rejects.toThrow();
    expect(getLedgerStatementMock).not.toHaveBeenCalled();
  });

  it("getSupplierPurchaseSummary gates on reports:view and delegates to purchaseInvoiceService.getPartyWisePurchaseReport", async () => {
    await supplierReportService.getSupplierPurchaseSummary({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getPartyWisePurchaseReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("getSupplierPurchaseSummary passes every row through unmodified (no synthetic-bucket filtering)", async () => {
    getPartyWisePurchaseReportMock.mockResolvedValueOnce([
      {
        supplierId: SUPPLIER_ID,
        supplierName: "Acme Wholesale",
        invoiceCount: 1,
        taxableAmount: 100,
        cgst: 9,
        sgst: 9,
        igst: 0,
        cess: 0,
        grandTotal: 118,
      },
    ]);
    const report = await supplierReportService.getSupplierPurchaseSummary({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].supplierId).toBe(SUPPLIER_ID);
  });

  it("getSupplierDirectory gates on reports:view and defaults to active-only suppliers", async () => {
    const report = await supplierReportService.getSupplierDirectory({});
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(prismaSupplierFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
    expect(report.rows).toHaveLength(1);
  });

  it("getSupplierDirectory applies the status:'all' filter by omitting the isActive clause", async () => {
    await supplierReportService.getSupplierDirectory({ status: "all" });
    expect(prismaSupplierFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
  });

  it("listSupplierOptions gates on reports:view and scopes to the caller's own company, active only", async () => {
    prismaSupplierFindManyMock.mockResolvedValueOnce([{ id: SUPPLIER_ID, ledger: { name: "Acme Wholesale" } }]);
    const options = await supplierReportService.listSupplierOptions();
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(options).toEqual([{ id: SUPPLIER_ID, name: "Acme Wholesale" }]);
    expect(prismaSupplierFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
  });
});
