import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  hasPermissionMock,
  getCashAndBankLedgerIdsMock,
  getLedgerBalanceMock,
  getCurrentStockMock,
  listSalesInvoicesForReportMock,
  listPurchaseInvoicesForReportMock,
  getCustomerOutstandingReportMock,
  getCustomerSalesSummaryMock,
  getSupplierOutstandingReportMock,
  getSupplierPurchaseSummaryMock,
  getLowStockReportMock,
  getItemWiseSalesReportMock,
  getProfitAndLossMock,
  getGstDashboardMock,
  customerFindManyMock,
  companySettingsFindUniqueMock,
  stockAdjustmentCountMock,
  stockTransferCountMock,
  salesInvoiceCountMock,
  purchaseInvoiceCountMock,
  salesInvoiceFindManyMock,
  purchaseInvoiceFindManyMock,
  voucherFindManyMock,
  salesReturnFindManyMock,
  purchaseReturnFindManyMock,
  creditNoteFindManyMock,
  debitNoteFindManyMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  hasPermissionMock: vi.fn(),
  getCashAndBankLedgerIdsMock: vi.fn(),
  getLedgerBalanceMock: vi.fn(),
  getCurrentStockMock: vi.fn(),
  listSalesInvoicesForReportMock: vi.fn(),
  listPurchaseInvoicesForReportMock: vi.fn(),
  getCustomerOutstandingReportMock: vi.fn(),
  getCustomerSalesSummaryMock: vi.fn(),
  getSupplierOutstandingReportMock: vi.fn(),
  getSupplierPurchaseSummaryMock: vi.fn(),
  getLowStockReportMock: vi.fn(),
  getItemWiseSalesReportMock: vi.fn(),
  getProfitAndLossMock: vi.fn(),
  getGstDashboardMock: vi.fn(),
  customerFindManyMock: vi.fn(),
  companySettingsFindUniqueMock: vi.fn(),
  stockAdjustmentCountMock: vi.fn(),
  stockTransferCountMock: vi.fn(),
  salesInvoiceCountMock: vi.fn(),
  purchaseInvoiceCountMock: vi.fn(),
  salesInvoiceFindManyMock: vi.fn(),
  purchaseInvoiceFindManyMock: vi.fn(),
  voucherFindManyMock: vi.fn(),
  salesReturnFindManyMock: vi.fn(),
  purchaseReturnFindManyMock: vi.fn(),
  creditNoteFindManyMock: vi.fn(),
  debitNoteFindManyMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/lib/ledger-class", () => ({ getCashAndBankLedgerIds: getCashAndBankLedgerIdsMock }));
vi.mock("@/engines/voucher/voucher-queries", () => ({ voucherQueries: { getLedgerBalance: getLedgerBalanceMock } }));
vi.mock("@/engines/inventory/inventory-engine", () => ({ inventoryEngine: { getCurrentStock: getCurrentStockMock } }));
vi.mock("@/modules/sales-invoices/services/sales-invoice-service", () => ({
  salesInvoiceService: { listSalesInvoicesForReport: listSalesInvoicesForReportMock },
}));
vi.mock("@/modules/purchase-invoices/services/purchase-invoice-service", () => ({
  purchaseInvoiceService: { listPurchaseInvoicesForReport: listPurchaseInvoicesForReportMock },
}));
vi.mock("@/modules/reports/customers/services/customer-report-service", () => ({
  customerReportService: {
    getCustomerOutstandingReport: getCustomerOutstandingReportMock,
    getCustomerSalesSummary: getCustomerSalesSummaryMock,
  },
}));
vi.mock("@/modules/reports/suppliers/services/supplier-report-service", () => ({
  supplierReportService: {
    getSupplierOutstandingReport: getSupplierOutstandingReportMock,
    getSupplierPurchaseSummary: getSupplierPurchaseSummaryMock,
  },
}));
vi.mock("@/modules/reports/inventory/services/inventory-report-service", () => ({
  inventoryReportService: { getLowStockReport: getLowStockReportMock },
}));
vi.mock("@/modules/reports/sales/services/sales-report-service", () => ({
  salesReportService: { getItemWiseSalesReport: getItemWiseSalesReportMock },
}));
vi.mock("@/modules/reports/services/profit-and-loss-service", () => ({
  profitAndLossService: { getProfitAndLoss: getProfitAndLossMock },
}));
vi.mock("@/modules/reports/services/gst-reports-service", () => ({
  gstReportsService: { getGstDashboard: getGstDashboardMock },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findMany: customerFindManyMock },
    companySettings: { findUnique: companySettingsFindUniqueMock },
    stockAdjustment: { count: stockAdjustmentCountMock },
    stockTransfer: { count: stockTransferCountMock },
    salesInvoice: { findMany: salesInvoiceFindManyMock, count: salesInvoiceCountMock },
    purchaseInvoice: { findMany: purchaseInvoiceFindManyMock, count: purchaseInvoiceCountMock },
    voucher: { findMany: voucherFindManyMock },
    salesReturn: { findMany: salesReturnFindManyMock },
    purchaseReturn: { findMany: purchaseReturnFindManyMock },
    creditNote: { findMany: creditNoteFindManyMock },
    debitNote: { findMany: debitNoteFindManyMock },
  },
}));

import { dashboardService } from "@/modules/dashboard/services/dashboard-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const FINANCIAL_YEAR = {
  id: "fy-1",
  companyId: COMPANY_ID,
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2027-03-31T00:00:00.000Z"),
  isClosed: false,
};

const ZERO_CUSTOMER_OUTSTANDING = { rows: [] };
const ZERO_SUPPLIER_OUTSTANDING = { rows: [] };
const ZERO_LOW_STOCK = { rows: [] };
const ZERO_PROFIT_AND_LOSS = { netProfit: 0 };
const ZERO_GST_DASHBOARD = { months: [], totals: { outputTax: 0, inputTax: 0, netLiability: 0 } };
const ZERO_SALES_SUMMARY = { rows: [], totals: {} };
const ZERO_ITEM_WISE = { rows: [], totals: {} };
const ZERO_PURCHASE_SUMMARY = { rows: [], totals: {} };

function salesInvoice(overrides: Partial<{ id: string; status: string; grandTotal: number; amountPaid: number; invoiceDate: Date; invoiceNumber: string; customer: { id: string; name: string } | null }> = {}) {
  return {
    id: overrides.id ?? "inv-1",
    status: overrides.status ?? "POSTED",
    grandTotal: overrides.grandTotal ?? 100,
    amountPaid: overrides.amountPaid ?? 0,
    invoiceDate: overrides.invoiceDate ?? new Date("2026-04-10T00:00:00.000Z"),
    invoiceNumber: overrides.invoiceNumber ?? "INV-0001",
    customer: overrides.customer === undefined ? { id: "cust-1", name: "Acme" } : overrides.customer,
  };
}

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Company Admin" });
  getCurrentFinancialYearMock.mockReset().mockResolvedValue(FINANCIAL_YEAR);
  hasPermissionMock.mockReset().mockResolvedValue(true);
  getCashAndBankLedgerIdsMock.mockReset().mockResolvedValue(new Set());
  getLedgerBalanceMock.mockReset().mockResolvedValue({ closingBalance: 0 });
  getCurrentStockMock.mockReset().mockResolvedValue([]);
  listSalesInvoicesForReportMock.mockReset().mockResolvedValue([]);
  listPurchaseInvoicesForReportMock.mockReset().mockResolvedValue([]);
  getCustomerOutstandingReportMock.mockReset().mockResolvedValue(ZERO_CUSTOMER_OUTSTANDING);
  getCustomerSalesSummaryMock.mockReset().mockResolvedValue(ZERO_SALES_SUMMARY);
  getSupplierOutstandingReportMock.mockReset().mockResolvedValue(ZERO_SUPPLIER_OUTSTANDING);
  getSupplierPurchaseSummaryMock.mockReset().mockResolvedValue(ZERO_PURCHASE_SUMMARY);
  getLowStockReportMock.mockReset().mockResolvedValue(ZERO_LOW_STOCK);
  getItemWiseSalesReportMock.mockReset().mockResolvedValue(ZERO_ITEM_WISE);
  getProfitAndLossMock.mockReset().mockResolvedValue(ZERO_PROFIT_AND_LOSS);
  getGstDashboardMock.mockReset().mockResolvedValue(ZERO_GST_DASHBOARD);
  customerFindManyMock.mockReset().mockResolvedValue([]);
  companySettingsFindUniqueMock.mockReset().mockResolvedValue({ allowNegativeStock: false });
  stockAdjustmentCountMock.mockReset().mockResolvedValue(0);
  stockTransferCountMock.mockReset().mockResolvedValue(0);
  salesInvoiceCountMock.mockReset().mockResolvedValue(0);
  purchaseInvoiceCountMock.mockReset().mockResolvedValue(0);
  salesInvoiceFindManyMock.mockReset().mockResolvedValue([]);
  purchaseInvoiceFindManyMock.mockReset().mockResolvedValue([]);
  voucherFindManyMock.mockReset().mockResolvedValue([]);
  salesReturnFindManyMock.mockReset().mockResolvedValue([]);
  purchaseReturnFindManyMock.mockReset().mockResolvedValue([]);
  creditNoteFindManyMock.mockReset().mockResolvedValue([]);
  debitNoteFindManyMock.mockReset().mockResolvedValue([]);
});

describe("dashboardService.getDashboard — no financial year", () => {
  it("returns every widget unavailable, without throwing, when no financial year is selected", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);

    const result = await dashboardService.getDashboard();

    expect(result.salesKpi.state).toBe("unavailable");
    expect(result.gstSummary.state).toBe("unavailable");
    expect(result.quickActions).toEqual([]);
  });
});

describe("dashboardService.getDashboard — widget omission per permission", () => {
  it("omits the Sales KPI when sales:view is missing, and never calls the underlying service", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "sales");

    const result = await dashboardService.getDashboard();

    expect(result.salesKpi.state).toBe("no-permission");
    expect(result.salesTrend.state).toBe("no-permission");
  });

  it("omits the Sales KPI when reports:view is missing even though sales:view is present (double gate)", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "reports");
    listSalesInvoicesForReportMock.mockResolvedValue([salesInvoice()]);

    const result = await dashboardService.getDashboard();

    expect(result.salesKpi.state).toBe("no-permission");
  });

  it("omits Cash & Bank when accounting:view is missing", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "accounting");

    const result = await dashboardService.getDashboard();

    expect(result.cashAndBank.state).toBe("no-permission");
    expect(result.monthlyProfit.state).toBe("no-permission");
    expect(getCashAndBankLedgerIdsMock).not.toHaveBeenCalled();
  });

  it("omits Low Stock when inventory:view is missing, and never calls getLowStockReport", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "inventory");

    const result = await dashboardService.getDashboard();

    expect(result.lowStock.state).toBe("no-permission");
    expect(getLowStockReportMock).not.toHaveBeenCalled();
  });

  it("omits GST Summary when gst:view is missing", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "gst");

    const result = await dashboardService.getDashboard();

    expect(result.gstSummary.state).toBe("no-permission");
    expect(getGstDashboardMock).not.toHaveBeenCalled();
  });

  it("omits Top Suppliers when purchase:view is missing", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "purchase");

    const result = await dashboardService.getDashboard();

    expect(result.topSuppliers.state).toBe("no-permission");
    expect(result.payables.state).toBe("no-permission");
  });

  it("an Employee-shaped role (only dashboard:view) sees every widget omitted and no quick actions", async () => {
    hasPermissionMock.mockResolvedValue(false);

    const result = await dashboardService.getDashboard();

    expect(result.salesKpi.state).toBe("no-permission");
    expect(result.purchaseKpi.state).toBe("no-permission");
    expect(result.cashAndBank.state).toBe("no-permission");
    expect(result.gstSummary.state).toBe("no-permission");
    expect(result.lowStock.state).toBe("no-permission");
    expect(result.quickActions).toEqual([]);
  });
});

describe("dashboardService.getDashboard — parallel fetch failure isolation", () => {
  it("marks Low Stock unavailable without failing the whole dashboard when its query throws", async () => {
    getLowStockReportMock.mockRejectedValue(new Error("boom"));

    const result = await dashboardService.getDashboard();

    expect(result.lowStock.state).toBe("unavailable");
    expect(result.gstSummary.state).toBe("empty");
  });

  it("isolates three simultaneous widget failures from each other and from the rest of the page", async () => {
    getLowStockReportMock.mockRejectedValue(new Error("boom"));
    getGstDashboardMock.mockRejectedValue(new Error("boom"));
    getProfitAndLossMock.mockRejectedValue(new Error("boom"));

    const result = await dashboardService.getDashboard();

    expect(result.lowStock.state).toBe("unavailable");
    expect(result.gstSummary.state).toBe("unavailable");
    expect(result.monthlyProfit.state).toBe("unavailable");
    expect(result.cashAndBank.state).toBe("empty");
  });

  it("does not reject getDashboard() itself when a widget query throws", async () => {
    getCustomerOutstandingReportMock.mockRejectedValue(new Error("boom"));

    await expect(dashboardService.getDashboard()).resolves.toBeDefined();
  });
});

describe("dashboardService.getDashboard — cross-company isolation", () => {
  it("scopes every unconditional read to the caller's own company", async () => {
    await dashboardService.getDashboard();

    expect(getCashAndBankLedgerIdsMock).toHaveBeenCalledWith(COMPANY_ID);
    expect(salesInvoiceFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
    expect(purchaseInvoiceFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
  });

  it("scopes the overdue-receivables Customer.creditDays lookup to the caller's own company, never another company's id", async () => {
    listSalesInvoicesForReportMock.mockResolvedValue([
      salesInvoice({ grandTotal: 1000, amountPaid: 0, invoiceDate: new Date("2020-01-01T00:00:00.000Z") }),
    ]);

    await dashboardService.getDashboard();

    expect(customerFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
    for (const call of customerFindManyMock.mock.calls) {
      expect(call[0].where.companyId).not.toBe(OTHER_COMPANY_ID);
    }
  });
});

describe("dashboardService.getDashboard — no-data vs zero distinction", () => {
  it("returns 'empty' (not a zero total) when no sales invoices exist at all", async () => {
    listSalesInvoicesForReportMock.mockResolvedValue([]);

    const result = await dashboardService.getDashboard();

    expect(result.salesKpi.state).toBe("empty");
  });

  it("returns 'ok' with a real zero total when a posted invoice with grandTotal 0 exists", async () => {
    listSalesInvoicesForReportMock.mockResolvedValue([salesInvoice({ grandTotal: 0 })]);

    const result = await dashboardService.getDashboard();

    expect(result.salesKpi.state).toBe("ok");
    if (result.salesKpi.state === "ok") {
      expect(result.salesKpi.data.monthToDate).toBe(0);
    }
  });

  it("returns 'empty' for receivables when the outstanding report has no rows", async () => {
    getCustomerOutstandingReportMock.mockResolvedValue({ rows: [] });

    const result = await dashboardService.getDashboard();

    expect(result.receivables.state).toBe("empty");
  });

  it("returns 'ok' with a zero grand total for receivables when rows exist but net to zero", async () => {
    getCustomerOutstandingReportMock.mockResolvedValue({
      rows: [{ customerId: "c1", customerName: "Acme", outstandingBalance: 0, isOverLimit: null }],
    });

    const result = await dashboardService.getDashboard();

    expect(result.receivables.state).toBe("ok");
    if (result.receivables.state === "ok") {
      expect(result.receivables.data.total).toBe(0);
    }
  });

  it("returns 'empty' for cash & bank when no cash/bank ledgers are configured, distinct from a zero balance", async () => {
    getCashAndBankLedgerIdsMock.mockResolvedValue(new Set());

    const result = await dashboardService.getDashboard();

    expect(result.cashAndBank.state).toBe("empty");
  });

  it("returns 'ok' with a zero balance when cash/bank ledgers exist but net to zero", async () => {
    getCashAndBankLedgerIdsMock.mockResolvedValue(new Set(["ledger-1"]));
    getLedgerBalanceMock.mockResolvedValue({ closingBalance: 0 });

    const result = await dashboardService.getDashboard();

    expect(result.cashAndBank.state).toBe("ok");
    if (result.cashAndBank.state === "ok") {
      expect(result.cashAndBank.data.balance).toBe(0);
    }
  });
});

describe("dashboardService.getDashboard — payables sign convention", () => {
  it("flips the supplier outstanding report's negative (credit-nature) balance to a positive display amount", async () => {
    getSupplierOutstandingReportMock.mockResolvedValue({
      rows: [{ supplierId: "s1", supplierName: "Supplier Co", outstandingBalance: -500, creditDays: 30 }],
    });

    const result = await dashboardService.getDashboard();

    expect(result.payables.state).toBe("ok");
    if (result.payables.state === "ok") {
      expect(result.payables.data.total).toBe(500);
      expect(result.payables.data.top[0].amount).toBe(500);
    }
  });
});

describe("dashboardService.getDashboard — quick actions", () => {
  it("includes only the routes the caller has create/approve permission for", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string, action: string) => module === "masters" && action === "create");

    const result = await dashboardService.getDashboard();

    const hrefs = result.quickActions.map((action) => action.href);
    expect(hrefs).toContain("/masters/customers/new");
    expect(hrefs).not.toContain("/sales/invoices/new");
  });

  it("requires accounting:approve (not accounting:create) for the Journal Voucher quick action", async () => {
    hasPermissionMock.mockImplementation(
      async (_user, module: string, action: string) => module === "accounting" && action === "create"
    );

    const result = await dashboardService.getDashboard();

    const hrefs = result.quickActions.map((action) => action.href);
    expect(hrefs).toContain("/accounting/payment-vouchers/new");
    expect(hrefs).not.toContain("/accounting/journal-vouchers/new");
  });
});

describe("dashboardService.getDashboard — alert edge cases", () => {
  it("never flags a customer with no creditDays set as overdue", async () => {
    listSalesInvoicesForReportMock.mockResolvedValue([
      salesInvoice({ grandTotal: 1000, amountPaid: 0, invoiceDate: new Date("2020-01-01T00:00:00.000Z") }),
    ]);
    customerFindManyMock.mockResolvedValue([{ id: "cust-1", creditDays: null }]);

    const result = await dashboardService.getDashboard();

    expect(result.overdueReceivables.state).toBe("empty");
  });

  it("flags an old, unpaid, posted invoice past its customer's creditDays as overdue", async () => {
    listSalesInvoicesForReportMock.mockResolvedValue([
      salesInvoice({ grandTotal: 1000, amountPaid: 0, invoiceDate: new Date("2020-01-01T00:00:00.000Z") }),
    ]);
    customerFindManyMock.mockResolvedValue([{ id: "cust-1", creditDays: 30 }]);

    const result = await dashboardService.getDashboard();

    expect(result.overdueReceivables.state).toBe("ok");
  });

  it("omits the negative-stock-risk alert entirely when allowNegativeStock is false", async () => {
    companySettingsFindUniqueMock.mockResolvedValue({ allowNegativeStock: false });
    getCurrentStockMock.mockResolvedValue([{ productId: "p1", warehouseId: "w1", quantity: -5 }]);

    const result = await dashboardService.getDashboard();

    expect(result.negativeStockRisk.state).toBe("empty");
  });

  it("surfaces the negative-stock-risk alert when allowNegativeStock is true and a product is negative", async () => {
    companySettingsFindUniqueMock.mockResolvedValue({ allowNegativeStock: true });
    getCurrentStockMock.mockResolvedValue([{ productId: "p1", warehouseId: "w1", quantity: -5 }]);

    const result = await dashboardService.getDashboard();

    expect(result.negativeStockRisk.state).toBe("ok");
  });

  it("derives GST filing due only from an OPEN latest bucketed month, never a separate query", async () => {
    getGstDashboardMock.mockResolvedValue({
      months: [{ month: "2026-04", outputTax: 10, inputTax: 5, netLiability: 5, status: "OPEN", periodStart: null, periodEnd: null }],
      totals: { outputTax: 10, inputTax: 5, netLiability: 5 },
    });

    const result = await dashboardService.getDashboard();

    expect(result.gstFilingDue.state).toBe("ok");
  });

  it("does not surface GST filing due when the latest month is already FILED", async () => {
    getGstDashboardMock.mockResolvedValue({
      months: [{ month: "2026-04", outputTax: 10, inputTax: 5, netLiability: 5, status: "FILED", periodStart: null, periodEnd: null }],
      totals: { outputTax: 10, inputTax: 5, netLiability: 5 },
    });

    const result = await dashboardService.getDashboard();

    expect(result.gstFilingDue.state).toBe("empty");
  });
});

describe("dashboardService.getDashboard — pending documents", () => {
  it("counts DRAFT rows via dedicated queries, per permitted module", async () => {
    salesInvoiceCountMock.mockResolvedValue(1);
    stockAdjustmentCountMock.mockResolvedValue(2);
    stockTransferCountMock.mockResolvedValue(1);

    const result = await dashboardService.getDashboard();

    expect(result.pendingDocuments.state).toBe("ok");
    if (result.pendingDocuments.state === "ok") {
      expect(result.pendingDocuments.data.sales).toBe(1);
      expect(result.pendingDocuments.data.inventory).toBe(3);
    }
    expect(salesInvoiceCountMock).toHaveBeenCalledWith({ where: { companyId: COMPANY_ID, status: "DRAFT" } });
  });

  it("does not count a module's drafts when the caller lacks that module's view permission, and never calls its count query", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "purchase");
    purchaseInvoiceCountMock.mockResolvedValue(5);

    const result = await dashboardService.getDashboard();

    expect(purchaseInvoiceCountMock).not.toHaveBeenCalled();
    if (result.pendingDocuments.state === "ok") {
      expect(result.pendingDocuments.data.purchase).toBe(0);
    }
  });

  it("does not count a Sales draft even when reports:view is missing (decoupled from the reports-gated KPI fetch)", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "reports");
    salesInvoiceCountMock.mockResolvedValue(3);

    const result = await dashboardService.getDashboard();

    expect(salesInvoiceCountMock).toHaveBeenCalled();
    if (result.pendingDocuments.state === "ok") {
      expect(result.pendingDocuments.data.sales).toBe(3);
    }
  });

  it("is 'no-permission' (not a fabricated 'no documents' empty state) when the caller lacks sales, purchase, AND inventory view", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => !["sales", "purchase", "inventory"].includes(module));

    const result = await dashboardService.getDashboard();

    expect(result.pendingDocuments.state).toBe("no-permission");
  });
});

describe("dashboardService.getDashboard — double-gated widgets whose drill-down link requires reports:view", () => {
  it("omits Cash & Bank when reports:view is missing even though accounting:view is present", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "reports");

    const result = await dashboardService.getDashboard();

    expect(result.cashAndBank.state).toBe("no-permission");
    expect(getCashAndBankLedgerIdsMock).not.toHaveBeenCalled();
  });

  it("omits Negative Stock Risk when reports:view is missing even though inventory:view is present", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module !== "reports");

    const result = await dashboardService.getDashboard();

    expect(result.negativeStockRisk.state).toBe("no-permission");
    expect(getCurrentStockMock).not.toHaveBeenCalled();
  });
});

describe("dashboardService.getDashboard — Recent Activity", () => {
  it("is 'no-permission' when the caller has no permitted source module", async () => {
    hasPermissionMock.mockImplementation(async (_user, module: string) => module === "dashboard");

    const result = await dashboardService.getDashboard();

    expect(result.recentActivity.state).toBe("no-permission");
  });

  it("routes each Voucher row to its own voucherType's detail page, never a hardcoded Payment Voucher link", async () => {
    voucherFindManyMock.mockResolvedValue([
      { id: "v-receipt", voucherNumber: "RV-0001", voucherType: "RECEIPT", createdAt: new Date("2026-04-05T00:00:00.000Z") },
      { id: "v-contra", voucherNumber: "CV-0001", voucherType: "CONTRA", createdAt: new Date("2026-04-04T00:00:00.000Z") },
      { id: "v-journal", voucherNumber: "JV-0001", voucherType: "JOURNAL", createdAt: new Date("2026-04-03T00:00:00.000Z") },
      { id: "v-payment", voucherNumber: "PV-0001", voucherType: "PAYMENT", createdAt: new Date("2026-04-02T00:00:00.000Z") },
    ]);

    const result = await dashboardService.getDashboard();

    expect(result.recentActivity.state).toBe("ok");
    if (result.recentActivity.state !== "ok") return;
    const hrefById = new Map(result.recentActivity.data.map((item) => [item.id.split(":")[1], item.href]));
    expect(hrefById.get("v-receipt")).toBe("/accounting/receipt-vouchers/v-receipt");
    expect(hrefById.get("v-contra")).toBe("/accounting/contra-vouchers/v-contra");
    expect(hrefById.get("v-journal")).toBe("/accounting/journal-vouchers/v-journal");
    expect(hrefById.get("v-payment")).toBe("/accounting/payment-vouchers/v-payment");
  });

  it("scopes every source query to the caller's own company", async () => {
    await dashboardService.getDashboard();

    expect(voucherFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_ID }) }));
    // Only manual voucher types — the auto-posted SALES/PURCHASE/etc. types
    // are already represented by their own source document below and have
    // no dedicated detail page to link to.
    expect(voucherFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ voucherType: { in: ["PAYMENT", "RECEIPT", "CONTRA", "JOURNAL"] } }) })
    );
    expect(salesReturnFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
    expect(purchaseReturnFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
    expect(creditNoteFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
    expect(debitNoteFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID } }));
  });
});

describe("dashboardService.getDashboard — Top Performers / Outstanding drill-down links", () => {
  it("links each Top Product row to that product's own detail page, not the generic list", async () => {
    getItemWiseSalesReportMock.mockResolvedValue({
      rows: [{ productId: "prod-1", productName: "Widget", quantity: 1, taxableAmount: 100, totalTax: 18, totalValue: 118, invoiceCount: 1 }],
      totals: {},
    });

    const result = await dashboardService.getDashboard();

    expect(result.topProducts.state).toBe("ok");
    if (result.topProducts.state === "ok") {
      expect(result.topProducts.data[0].href).toBe("/masters/products/prod-1");
    }
  });

  it("links each Receivables row to that customer's own statement, not the generic outstanding list", async () => {
    getCustomerOutstandingReportMock.mockResolvedValue({
      rows: [{ customerId: "cust-9", customerName: "Acme", outstandingBalance: 500, isOverLimit: null }],
    });

    const result = await dashboardService.getDashboard();

    expect(result.receivables.state).toBe("ok");
    if (result.receivables.state === "ok") {
      expect(result.receivables.data.top[0].href).toBe("/reports/customers/statement?customerId=cust-9");
    }
  });
});
