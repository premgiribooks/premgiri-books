import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  listSalesInvoicesForReportMock,
  getItemWiseSalesReportMock,
  getPartyWiseSalesReportMock,
  listSalesReturnsForReportMock,
  prismaCustomerFindManyMock,
  prismaProductFindManyMock,
  prismaWarehouseFindManyMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  listSalesInvoicesForReportMock: vi.fn(),
  getItemWiseSalesReportMock: vi.fn(),
  getPartyWiseSalesReportMock: vi.fn(),
  listSalesReturnsForReportMock: vi.fn(),
  prismaCustomerFindManyMock: vi.fn(),
  prismaProductFindManyMock: vi.fn(),
  prismaWarehouseFindManyMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findMany: prismaCustomerFindManyMock },
    product: { findMany: prismaProductFindManyMock },
    warehouse: { findMany: prismaWarehouseFindManyMock },
  },
}));
vi.mock("@/modules/sales-invoices/services/sales-invoice-service", () => ({
  salesInvoiceService: {
    listSalesInvoicesForReport: listSalesInvoicesForReportMock,
    getItemWiseSalesReport: getItemWiseSalesReportMock,
    getPartyWiseSalesReport: getPartyWiseSalesReportMock,
  },
}));
vi.mock("@/modules/sales-returns/services/sales-return-service", () => ({
  salesReturnService: { listSalesReturnsForReport: listSalesReturnsForReportMock },
}));

import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  listSalesInvoicesForReportMock.mockReset();
  getItemWiseSalesReportMock.mockReset();
  getPartyWiseSalesReportMock.mockReset();
  listSalesReturnsForReportMock.mockReset();
  prismaCustomerFindManyMock.mockReset();
  prismaProductFindManyMock.mockReset();
  prismaWarehouseFindManyMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockResolvedValue(undefined);
  listSalesInvoicesForReportMock.mockResolvedValue([]);
  getItemWiseSalesReportMock.mockResolvedValue([]);
  getPartyWiseSalesReportMock.mockResolvedValue([]);
  listSalesReturnsForReportMock.mockResolvedValue([]);
});

describe("salesReportService", () => {
  it("getSalesRegister gates on reports:view and delegates to salesInvoiceService.listSalesInvoicesForReport", async () => {
    await salesReportService.getSalesRegister({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(listSalesInvoicesForReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
      customerId: undefined,
      status: "POSTED",
    });
  });

  it("getItemWiseSalesReport gates on reports:view and delegates to salesInvoiceService.getItemWiseSalesReport", async () => {
    await salesReportService.getItemWiseSalesReport({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getItemWiseSalesReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
      productId: undefined,
      warehouseId: undefined,
      customerId: undefined,
    });
  });

  it("getPartyWiseSalesReport gates on reports:view and delegates to salesInvoiceService.getPartyWiseSalesReport", async () => {
    await salesReportService.getPartyWiseSalesReport({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getPartyWiseSalesReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("getSalesReturnSummary gates on reports:view and applies the in-memory customerId filter via the Reporting Engine", async () => {
    const customerId1 = "11111111-1111-4111-8111-111111111111";
    const customerId2 = "22222222-2222-4222-8222-222222222222";
    listSalesReturnsForReportMock.mockResolvedValueOnce([
      { id: "ret-1", grandTotal: 100, salesInvoice: { customerId: customerId1 } },
      { id: "ret-2", grandTotal: 200, salesInvoice: { customerId: customerId2 } },
    ]);
    const report = await salesReportService.getSalesReturnSummary({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      customerId: customerId1,
    });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(report.rows).toHaveLength(1);
    expect(report.totalGrandTotal).toBe(100);
  });

  it("rejects an invalid filter set (dateTo before dateFrom) before ever calling the owning service", async () => {
    await expect(
      salesReportService.getSalesRegister({ dateFrom: "2026-04-30", dateTo: "2026-04-01" })
    ).rejects.toThrow();
    expect(listSalesInvoicesForReportMock).not.toHaveBeenCalled();
  });

  it("listCustomerOptions/listProductOptions/listWarehouseOptions each gate on reports:view and scope to the caller's own company", async () => {
    prismaCustomerFindManyMock.mockResolvedValueOnce([{ id: "cust-1", ledger: { name: "Acme Co" } }]);
    prismaProductFindManyMock.mockResolvedValueOnce([{ id: "prod-1", name: "Widget", productCode: "WID-1" }]);
    prismaWarehouseFindManyMock.mockResolvedValueOnce([{ id: "wh-1", name: "Main Warehouse" }]);

    const customers = await salesReportService.listCustomerOptions();
    const products = await salesReportService.listProductOptions();
    const warehouses = await salesReportService.listWarehouseOptions();

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(customers).toEqual([{ id: "cust-1", name: "Acme Co" }]);
    expect(products).toEqual([{ id: "prod-1", name: "Widget", productCode: "WID-1" }]);
    expect(warehouses).toEqual([{ id: "wh-1", name: "Main Warehouse" }]);
    expect(prismaCustomerFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
  });
});
