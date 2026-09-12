import { beforeEach, describe, expect, it, vi } from "vitest";

// 69-purchase-reports.md's Code Standards section calls for "vitest coverage
// for aggregateItemWisePurchases/aggregatePartyWisePurchases correctness
// against a seeded multi-invoice, multi-product, multi-supplier fixture" —
// the service-level tests only assert the repository is CALLED with the
// right arguments (the repository itself is mocked there), so this file
// exercises the actual `groupBy`/`findMany` composition logic directly.
// Mirrors sales-invoice-repository.test.ts's identical convention: mock the
// module-level prisma client's specific model methods rather than a whole
// fake transaction client, since neither new method takes a `tx` parameter.
const { purchaseInvoiceItemMock, purchaseInvoiceMock, productMock, supplierMock } = vi.hoisted(() => ({
  purchaseInvoiceItemMock: { groupBy: vi.fn(), findMany: vi.fn() },
  purchaseInvoiceMock: { groupBy: vi.fn() },
  productMock: { findMany: vi.fn() },
  supplierMock: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchaseInvoiceItem: purchaseInvoiceItemMock,
    purchaseInvoice: purchaseInvoiceMock,
    product: productMock,
    supplier: supplierMock,
  },
}));

import { purchaseInvoiceRepository } from "@/modules/purchase-invoices/repositories/purchase-invoice-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "44444444-4444-4444-8444-444444444444";
const SUPPLIER_A = "55555555-5555-4555-8555-555555555555";

function decimal(value: number) {
  return { toNumber: () => value };
}

const FILTERS_RANGE = { fromDate: new Date("2026-04-01T00:00:00.000Z"), toDate: new Date("2026-04-30T00:00:00.000Z") };

beforeEach(() => {
  purchaseInvoiceItemMock.groupBy.mockReset();
  purchaseInvoiceItemMock.findMany.mockReset();
  purchaseInvoiceMock.groupBy.mockReset();
  productMock.findMany.mockReset();
  supplierMock.findMany.mockReset();
});

describe("purchaseInvoiceRepository.aggregateItemWisePurchases", () => {
  it("returns [] without querying products/pairs when groupBy yields no rows", async () => {
    purchaseInvoiceItemMock.groupBy.mockResolvedValue([]);

    const result = await purchaseInvoiceRepository.aggregateItemWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result).toEqual([]);
    expect(purchaseInvoiceItemMock.findMany).not.toHaveBeenCalled();
    expect(productMock.findMany).not.toHaveBeenCalled();
  });

  it("scopes the groupBy where clause to the caller's company, financial year, POSTED status, and date range", async () => {
    purchaseInvoiceItemMock.groupBy.mockResolvedValue([]);

    await purchaseInvoiceRepository.aggregateItemWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(purchaseInvoiceItemMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["productId"],
        where: expect.objectContaining({
          purchaseInvoice: expect.objectContaining({
            companyId: COMPANY_ID,
            financialYearId: FY_ID,
            status: "POSTED",
            invoiceDate: { gte: FILTERS_RANGE.fromDate, lte: FILTERS_RANGE.toDate },
          }),
        }),
      })
    );
  });

  it("counts DISTINCT invoiceIds per product, never a raw row count (a product billed twice on one invoice must not double-count)", async () => {
    purchaseInvoiceItemMock.groupBy.mockResolvedValue([
      {
        productId: PRODUCT_A,
        _sum: {
          quantity: decimal(15),
          taxableAmount: decimal(1500),
          cgst: decimal(135),
          sgst: decimal(135),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(1770),
        },
      },
    ]);
    // Product A appears on invoice "inv-1" TWICE (two lines, e.g. two
    // batches/warehouses) and on invoice "inv-2" once — three rows, but
    // only two distinct invoices.
    purchaseInvoiceItemMock.findMany.mockResolvedValue([
      { productId: PRODUCT_A, purchaseInvoiceId: "inv-1" },
      { productId: PRODUCT_A, purchaseInvoiceId: "inv-1" },
      { productId: PRODUCT_A, purchaseInvoiceId: "inv-2" },
    ]);
    productMock.findMany.mockResolvedValue([{ id: PRODUCT_A, name: "Widget", productCode: "WID-1" }]);

    const result = await purchaseInvoiceRepository.aggregateItemWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result).toEqual([
      {
        productId: PRODUCT_A,
        productName: "Widget",
        productCode: "WID-1",
        quantity: 15,
        taxableAmount: 1500,
        cgst: 135,
        sgst: 135,
        igst: 0,
        cess: 0,
        totalAmount: 1770,
        invoiceCount: 2,
      },
    ]);
  });

  it("resolves each group's own distinct invoice count independently, keyed by productId", async () => {
    purchaseInvoiceItemMock.groupBy.mockResolvedValue([
      { productId: PRODUCT_A, _sum: { quantity: decimal(5), taxableAmount: decimal(500), cgst: decimal(45), sgst: decimal(45), igst: decimal(0), cess: decimal(0), totalAmount: decimal(590) } },
      { productId: PRODUCT_B, _sum: { quantity: decimal(2), taxableAmount: decimal(200), cgst: decimal(0), sgst: decimal(0), igst: decimal(36), cess: decimal(0), totalAmount: decimal(236) } },
    ]);
    purchaseInvoiceItemMock.findMany.mockResolvedValue([
      { productId: PRODUCT_A, purchaseInvoiceId: "inv-1" },
      { productId: PRODUCT_B, purchaseInvoiceId: "inv-1" },
      { productId: PRODUCT_B, purchaseInvoiceId: "inv-2" },
    ]);
    productMock.findMany.mockResolvedValue([
      { id: PRODUCT_A, name: "Widget", productCode: "WID-1" },
      { id: PRODUCT_B, name: "Gadget", productCode: "GAD-1" },
    ]);

    const result = await purchaseInvoiceRepository.aggregateItemWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result.find((r) => r.productId === PRODUCT_A)?.invoiceCount).toBe(1);
    expect(result.find((r) => r.productId === PRODUCT_B)?.invoiceCount).toBe(2);
  });

  it("falls back to a placeholder name/code for a product the batched lookup didn't resolve (e.g. cross-company drift)", async () => {
    purchaseInvoiceItemMock.groupBy.mockResolvedValue([
      { productId: PRODUCT_A, _sum: { quantity: decimal(1), taxableAmount: decimal(100), cgst: decimal(0), sgst: decimal(0), igst: decimal(0), cess: decimal(0), totalAmount: decimal(100) } },
    ]);
    purchaseInvoiceItemMock.findMany.mockResolvedValue([{ productId: PRODUCT_A, purchaseInvoiceId: "inv-1" }]);
    productMock.findMany.mockResolvedValue([]);

    const result = await purchaseInvoiceRepository.aggregateItemWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result[0]).toMatchObject({ productName: "Unknown product", productCode: "" });
  });

  it("passes the optional productId/warehouseId/supplierId filters through to the groupBy where clause", async () => {
    purchaseInvoiceItemMock.groupBy.mockResolvedValue([]);

    await purchaseInvoiceRepository.aggregateItemWisePurchases(COMPANY_ID, FY_ID, {
      ...FILTERS_RANGE,
      productId: PRODUCT_A,
      warehouseId: "wh-1",
      supplierId: SUPPLIER_A,
    });

    expect(purchaseInvoiceItemMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: PRODUCT_A,
          warehouseId: "wh-1",
          purchaseInvoice: expect.objectContaining({ supplierId: SUPPLIER_A }),
        }),
      })
    );
  });
});

describe("purchaseInvoiceRepository.aggregatePartyWisePurchases", () => {
  it("returns [] without querying suppliers when groupBy yields no rows", async () => {
    purchaseInvoiceMock.groupBy.mockResolvedValue([]);

    const result = await purchaseInvoiceRepository.aggregatePartyWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result).toEqual([]);
    expect(supplierMock.findMany).not.toHaveBeenCalled();
  });

  it("scopes the groupBy where clause to the caller's company, financial year, POSTED status, and date range", async () => {
    purchaseInvoiceMock.groupBy.mockResolvedValue([]);

    await purchaseInvoiceRepository.aggregatePartyWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(purchaseInvoiceMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["supplierId"],
        where: {
          companyId: COMPANY_ID,
          financialYearId: FY_ID,
          status: "POSTED",
          invoiceDate: { gte: FILTERS_RANGE.fromDate, lte: FILTERS_RANGE.toDate },
        },
      })
    );
  });

  it("resolves a supplier's name via the batched supplier lookup", async () => {
    purchaseInvoiceMock.groupBy.mockResolvedValue([
      {
        supplierId: SUPPLIER_A,
        _sum: { taxableAmount: decimal(1000), totalCgst: decimal(90), totalSgst: decimal(90), totalIgst: decimal(0), totalCess: decimal(0), grandTotal: decimal(1180) },
        _count: { _all: 2 },
      },
    ]);
    supplierMock.findMany.mockResolvedValue([{ id: SUPPLIER_A, ledger: { name: "Acme Supplies" } }]);

    const result = await purchaseInvoiceRepository.aggregatePartyWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result).toEqual([
      {
        supplierId: SUPPLIER_A,
        supplierName: "Acme Supplies",
        invoiceCount: 2,
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        cess: 0,
        grandTotal: 1180,
      },
    ]);
    expect(supplierMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [SUPPLIER_A] }, companyId: COMPANY_ID } })
    );
  });

  it("falls back to a placeholder name for a supplierId the batched lookup didn't resolve", async () => {
    purchaseInvoiceMock.groupBy.mockResolvedValue([
      {
        supplierId: SUPPLIER_A,
        _sum: { taxableAmount: decimal(100), totalCgst: decimal(0), totalSgst: decimal(0), totalIgst: decimal(0), totalCess: decimal(0), grandTotal: decimal(100) },
        _count: { _all: 1 },
      },
    ]);
    supplierMock.findMany.mockResolvedValue([]);

    const result = await purchaseInvoiceRepository.aggregatePartyWisePurchases(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result[0].supplierName).toBe("Unknown supplier");
  });
});
