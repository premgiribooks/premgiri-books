import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  listPurchaseInvoicesForReportMock,
  getItemWisePurchaseReportMock,
  getPartyWisePurchaseReportMock,
  listPurchaseReturnsForReportMock,
  prismaSupplierFindManyMock,
  prismaProductFindManyMock,
  prismaWarehouseFindManyMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  listPurchaseInvoicesForReportMock: vi.fn(),
  getItemWisePurchaseReportMock: vi.fn(),
  getPartyWisePurchaseReportMock: vi.fn(),
  listPurchaseReturnsForReportMock: vi.fn(),
  prismaSupplierFindManyMock: vi.fn(),
  prismaProductFindManyMock: vi.fn(),
  prismaWarehouseFindManyMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: { findMany: prismaSupplierFindManyMock },
    product: { findMany: prismaProductFindManyMock },
    warehouse: { findMany: prismaWarehouseFindManyMock },
  },
}));
vi.mock("@/modules/purchase-invoices/services/purchase-invoice-service", () => ({
  purchaseInvoiceService: {
    listPurchaseInvoicesForReport: listPurchaseInvoicesForReportMock,
    getItemWisePurchaseReport: getItemWisePurchaseReportMock,
    getPartyWisePurchaseReport: getPartyWisePurchaseReportMock,
  },
}));
vi.mock("@/modules/purchase-returns/services/purchase-return-service", () => ({
  purchaseReturnService: { listPurchaseReturnsForReport: listPurchaseReturnsForReportMock },
}));

import { purchaseReportService } from "@/modules/reports/purchase/services/purchase-report-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  listPurchaseInvoicesForReportMock.mockReset();
  getItemWisePurchaseReportMock.mockReset();
  getPartyWisePurchaseReportMock.mockReset();
  listPurchaseReturnsForReportMock.mockReset();
  prismaSupplierFindManyMock.mockReset();
  prismaProductFindManyMock.mockReset();
  prismaWarehouseFindManyMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockResolvedValue(undefined);
  listPurchaseInvoicesForReportMock.mockResolvedValue([]);
  getItemWisePurchaseReportMock.mockResolvedValue([]);
  getPartyWisePurchaseReportMock.mockResolvedValue([]);
  listPurchaseReturnsForReportMock.mockResolvedValue([]);
});

describe("purchaseReportService", () => {
  it("getPurchaseRegister gates on reports:view and delegates to purchaseInvoiceService.listPurchaseInvoicesForReport", async () => {
    await purchaseReportService.getPurchaseRegister({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(listPurchaseInvoicesForReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
      supplierId: undefined,
      status: "POSTED",
    });
  });

  it("getItemWisePurchaseReport gates on reports:view and delegates to purchaseInvoiceService.getItemWisePurchaseReport", async () => {
    await purchaseReportService.getItemWisePurchaseReport({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getItemWisePurchaseReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
      productId: undefined,
      warehouseId: undefined,
      supplierId: undefined,
    });
  });

  it("getPartyWisePurchaseReport gates on reports:view and delegates to purchaseInvoiceService.getPartyWisePurchaseReport", async () => {
    await purchaseReportService.getPartyWisePurchaseReport({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getPartyWisePurchaseReportMock).toHaveBeenCalledWith({
      fromDate: new Date("2026-04-01T00:00:00.000Z"),
      toDate: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("getPurchaseReturnSummary gates on reports:view and applies the in-memory supplierId filter via the Reporting Engine", async () => {
    const supplierId1 = "11111111-1111-4111-8111-111111111111";
    const supplierId2 = "22222222-2222-4222-8222-222222222222";
    listPurchaseReturnsForReportMock.mockResolvedValueOnce([
      { id: "ret-1", grandTotal: 100, purchaseInvoice: { supplierId: supplierId1 } },
      { id: "ret-2", grandTotal: 200, purchaseInvoice: { supplierId: supplierId2 } },
    ]);
    const report = await purchaseReportService.getPurchaseReturnSummary({
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      supplierId: supplierId1,
    });
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(report.rows).toHaveLength(1);
    expect(report.totalGrandTotal).toBe(100);
  });

  it("rejects an invalid filter set (dateTo before dateFrom) before ever calling the owning service", async () => {
    await expect(
      purchaseReportService.getPurchaseRegister({ dateFrom: "2026-04-30", dateTo: "2026-04-01" })
    ).rejects.toThrow();
    expect(listPurchaseInvoicesForReportMock).not.toHaveBeenCalled();
  });

  it("listSupplierOptions/listProductOptions/listWarehouseOptions each gate on reports:view and scope to the caller's own company", async () => {
    prismaSupplierFindManyMock.mockResolvedValueOnce([{ id: "supp-1", ledger: { name: "Acme Supplies" } }]);
    prismaProductFindManyMock.mockResolvedValueOnce([{ id: "prod-1", name: "Widget", productCode: "WID-1" }]);
    prismaWarehouseFindManyMock.mockResolvedValueOnce([{ id: "wh-1", name: "Main Warehouse" }]);

    const suppliers = await purchaseReportService.listSupplierOptions();
    const products = await purchaseReportService.listProductOptions();
    const warehouses = await purchaseReportService.listWarehouseOptions();

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(suppliers).toEqual([{ id: "supp-1", name: "Acme Supplies" }]);
    expect(products).toEqual([{ id: "prod-1", name: "Widget", productCode: "WID-1" }]);
    expect(warehouses).toEqual([{ id: "wh-1", name: "Main Warehouse" }]);
    expect(prismaSupplierFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
  });
});
