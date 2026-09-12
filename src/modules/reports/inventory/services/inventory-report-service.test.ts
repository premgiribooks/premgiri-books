import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getCurrentStockMock,
  getStockLedgerMock,
  getStockValuationMock,
  prismaProductFindManyMock,
  prismaWarehouseFindManyMock,
  prismaSalesInvoiceFindManyMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getCurrentStockMock: vi.fn(),
  getStockLedgerMock: vi.fn(),
  getStockValuationMock: vi.fn(),
  prismaProductFindManyMock: vi.fn(),
  prismaWarehouseFindManyMock: vi.fn(),
  prismaSalesInvoiceFindManyMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: prismaProductFindManyMock },
    warehouse: { findMany: prismaWarehouseFindManyMock },
    salesInvoice: { findMany: prismaSalesInvoiceFindManyMock },
    purchaseInvoice: { findMany: vi.fn().mockResolvedValue([]) },
    salesReturn: { findMany: vi.fn().mockResolvedValue([]) },
    purchaseReturn: { findMany: vi.fn().mockResolvedValue([]) },
    creditNote: { findMany: vi.fn().mockResolvedValue([]) },
    debitNote: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/engines/inventory/inventory-engine", () => ({
  inventoryEngine: {
    getCurrentStock: getCurrentStockMock,
    getStockLedger: getStockLedgerMock,
    getStockValuation: getStockValuationMock,
  },
}));

import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function decimal(value: number) {
  return { toNumber: () => value };
}

function productRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "prod-1",
    name: "Widget",
    productCode: "WID-1",
    isActive: true,
    minStockLevel: decimal(10),
    unit: { name: "Nos" },
    ...overrides,
  };
}

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  getCurrentStockMock.mockReset();
  getStockLedgerMock.mockReset();
  getStockValuationMock.mockReset();
  prismaProductFindManyMock.mockReset();
  prismaWarehouseFindManyMock.mockReset();
  prismaSalesInvoiceFindManyMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockResolvedValue(undefined);
  getCurrentStockMock.mockResolvedValue([]);
  getStockValuationMock.mockResolvedValue({ rows: [], totalValue: 0 });
  prismaProductFindManyMock.mockResolvedValue([productRow()]);
  prismaWarehouseFindManyMock.mockResolvedValue([{ id: "wh-1", name: "Main Warehouse" }]);
  prismaSalesInvoiceFindManyMock.mockResolvedValue([]);
});

describe("inventoryReportService", () => {
  it("getCurrentStockReport gates on reports:view and scopes product/warehouse lookups to the caller's own company", async () => {
    getCurrentStockMock.mockResolvedValueOnce([{ productId: "prod-1", warehouseId: "wh-1", quantity: 25 }]);

    const report = await inventoryReportService.getCurrentStockReport({});

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getCurrentStockMock).toHaveBeenCalledWith(COMPANY_ID, { productId: undefined, warehouseId: undefined });
    expect(prismaProductFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, productType: "TRADING" } })
    );
    expect(report.rows).toEqual([
      {
        productId: "prod-1",
        productName: "Widget",
        productCode: "WID-1",
        unitName: "Nos",
        warehouseId: "wh-1",
        warehouseName: "Main Warehouse",
        quantity: 25,
      },
    ]);
  });

  it("a cross-company warehouseId naturally yields an empty report, never an error", async () => {
    getCurrentStockMock.mockResolvedValueOnce([]);
    const report = await inventoryReportService.getCurrentStockReport({
      warehouseId: "33333333-3333-4333-8333-333333333333",
    });
    expect(report.rows).toEqual([]);
  });

  it("getStockLedgerReport rejects an invalid filter set before ever calling inventoryEngine", async () => {
    await expect(
      inventoryReportService.getStockLedgerReport({
        productId: "00000000-0000-4000-8000-000000000000",
        dateFrom: "2026-04-30",
        dateTo: "2026-04-01",
      } as never)
    ).rejects.toThrow();
    expect(getStockLedgerMock).not.toHaveBeenCalled();
  });

  it("getStockLedgerReport resolves a real document number via a single batched lookup for the referenceType present", async () => {
    prismaProductFindManyMock.mockResolvedValueOnce([productRow({ id: "00000000-0000-4000-8000-000000000000" })]);
    getStockLedgerMock.mockResolvedValueOnce({
      productId: "00000000-0000-4000-8000-000000000000",
      closingBalance: 5,
      lines: [
        {
          id: "line-1",
          transactionType: "SALES",
          direction: "OUT",
          quantity: 5,
          unitCost: 100,
          transactionDate: new Date("2026-04-01T00:00:00.000Z"),
          warehouseId: "wh-1",
          referenceType: "SALES_INVOICE",
          referenceId: "inv-1",
          batchId: null,
          narration: null,
          runningBalance: 5,
        },
      ],
    });
    prismaSalesInvoiceFindManyMock.mockResolvedValueOnce([{ id: "inv-1", invoiceNumber: "INV-0001" }]);

    const report = await inventoryReportService.getStockLedgerReport({
      productId: "00000000-0000-4000-8000-000000000000",
    } as never);

    expect(prismaSalesInvoiceFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, id: { in: ["inv-1"] } } })
    );
    expect(report.lines[0].referenceLabel).toBe("Sales Invoice #INV-0001");
    expect(report.productName).toBe("Widget");
  });

  it("getStockValuationReport gates on reports:view and delegates to inventoryEngine.getStockValuation", async () => {
    getStockValuationMock.mockResolvedValueOnce({
      rows: [{ productId: "prod-1", productName: "Widget", quantity: 10, unitCost: 50, value: 500, isUnvalued: false }],
      totalValue: 500,
    });
    const report = await inventoryReportService.getStockValuationReport({});
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(report.rows[0].productCode).toBe("WID-1");
    expect(report.totalValue).toBe(500);
  });

  it("getLowStockReport joins getCurrentStock against minStockLevel and excludes products with no threshold set", async () => {
    prismaProductFindManyMock.mockResolvedValueOnce([
      productRow({ id: "prod-1", minStockLevel: decimal(10) }),
      productRow({ id: "prod-2", name: "Gadget", productCode: "GAD-1", minStockLevel: null }),
    ]);
    getCurrentStockMock.mockResolvedValueOnce([
      { productId: "prod-1", warehouseId: "wh-1", quantity: 3 },
      { productId: "prod-2", warehouseId: "wh-1", quantity: 1 },
    ]);

    const report = await inventoryReportService.getLowStockReport({});
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ productId: "prod-1", currentStock: 3, minStockLevel: 10, shortfall: 7 });
  });

  it("listProductOptions/listWarehouseOptions each gate on reports:view and scope to the caller's own company", async () => {
    const products = await inventoryReportService.listProductOptions();
    const warehouses = await inventoryReportService.listWarehouseOptions();

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(products).toEqual([{ id: "prod-1", name: "Widget", productCode: "WID-1" }]);
    expect(warehouses).toEqual([{ id: "wh-1", name: "Main Warehouse" }]);
    expect(prismaWarehouseFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
  });
});
