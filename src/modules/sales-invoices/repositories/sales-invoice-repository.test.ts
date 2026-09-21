import { beforeEach, describe, expect, it, vi } from "vitest";

// 68-sales-reports.md's Code Standards section calls for "vitest coverage
// for aggregateItemWiseSales/aggregatePartyWiseSales correctness against a
// seeded multi-invoice, multi-product, multi-customer fixture" — the
// service-level tests only assert the repository is CALLED with the right
// arguments (the repository itself is mocked there), so this file exercises
// the actual `groupBy`/`findMany` composition logic directly. Mirrors
// attendance-repository.test.ts's convention: mock the module-level prisma
// client's specific model methods rather than a whole fake transaction
// client, since neither new method takes a `tx` parameter.
const { salesInvoiceItemMock, salesInvoiceMock, productMock, customerMock } = vi.hoisted(() => ({
  salesInvoiceItemMock: { groupBy: vi.fn(), findMany: vi.fn() },
  salesInvoiceMock: { groupBy: vi.fn() },
  productMock: { findMany: vi.fn() },
  customerMock: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesInvoiceItem: salesInvoiceItemMock,
    salesInvoice: salesInvoiceMock,
    product: productMock,
    customer: customerMock,
  },
}));

import { salesInvoiceRepository } from "@/modules/sales-invoices/repositories/sales-invoice-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_A = "55555555-5555-4555-8555-555555555555";

function decimal(value: number) {
  return { toNumber: () => value };
}

const FILTERS_RANGE = { fromDate: new Date("2026-04-01T00:00:00.000Z"), toDate: new Date("2026-04-30T00:00:00.000Z") };

beforeEach(() => {
  salesInvoiceItemMock.groupBy.mockReset();
  salesInvoiceItemMock.findMany.mockReset();
  salesInvoiceMock.groupBy.mockReset();
  productMock.findMany.mockReset();
  customerMock.findMany.mockReset();
});

describe("salesInvoiceRepository.aggregateItemWiseSales", () => {
  it("returns [] without querying products/pairs when groupBy yields no rows", async () => {
    salesInvoiceItemMock.groupBy.mockResolvedValue([]);

    const result = await salesInvoiceRepository.aggregateItemWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result).toEqual([]);
    expect(salesInvoiceItemMock.findMany).not.toHaveBeenCalled();
    expect(productMock.findMany).not.toHaveBeenCalled();
  });

  it("scopes the groupBy where clause to the caller's company, financial year, POSTED status, and date range", async () => {
    salesInvoiceItemMock.groupBy.mockResolvedValue([]);

    await salesInvoiceRepository.aggregateItemWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(salesInvoiceItemMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["productId"],
        where: expect.objectContaining({
          salesInvoice: expect.objectContaining({
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
    salesInvoiceItemMock.groupBy.mockResolvedValue([
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
    salesInvoiceItemMock.findMany.mockResolvedValue([
      { productId: PRODUCT_A, salesInvoiceId: "inv-1" },
      { productId: PRODUCT_A, salesInvoiceId: "inv-1" },
      { productId: PRODUCT_A, salesInvoiceId: "inv-2" },
    ]);
    productMock.findMany.mockResolvedValue([{ id: PRODUCT_A, name: "Widget", productCode: "WID-1" }]);

    const result = await salesInvoiceRepository.aggregateItemWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

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
    salesInvoiceItemMock.groupBy.mockResolvedValue([
      { productId: PRODUCT_A, _sum: { quantity: decimal(5), taxableAmount: decimal(500), cgst: decimal(45), sgst: decimal(45), igst: decimal(0), cess: decimal(0), totalAmount: decimal(590) } },
      { productId: PRODUCT_B, _sum: { quantity: decimal(2), taxableAmount: decimal(200), cgst: decimal(0), sgst: decimal(0), igst: decimal(36), cess: decimal(0), totalAmount: decimal(236) } },
    ]);
    salesInvoiceItemMock.findMany.mockResolvedValue([
      { productId: PRODUCT_A, salesInvoiceId: "inv-1" },
      { productId: PRODUCT_B, salesInvoiceId: "inv-1" },
      { productId: PRODUCT_B, salesInvoiceId: "inv-2" },
    ]);
    productMock.findMany.mockResolvedValue([
      { id: PRODUCT_A, name: "Widget", productCode: "WID-1" },
      { id: PRODUCT_B, name: "Gadget", productCode: "GAD-1" },
    ]);

    const result = await salesInvoiceRepository.aggregateItemWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result.find((r) => r.productId === PRODUCT_A)?.invoiceCount).toBe(1);
    expect(result.find((r) => r.productId === PRODUCT_B)?.invoiceCount).toBe(2);
  });

  it("falls back to a placeholder name/code for a product the batched lookup didn't resolve (e.g. cross-company drift)", async () => {
    salesInvoiceItemMock.groupBy.mockResolvedValue([
      { productId: PRODUCT_A, _sum: { quantity: decimal(1), taxableAmount: decimal(100), cgst: decimal(0), sgst: decimal(0), igst: decimal(0), cess: decimal(0), totalAmount: decimal(100) } },
    ]);
    salesInvoiceItemMock.findMany.mockResolvedValue([{ productId: PRODUCT_A, salesInvoiceId: "inv-1" }]);
    productMock.findMany.mockResolvedValue([]);

    const result = await salesInvoiceRepository.aggregateItemWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result[0]).toMatchObject({ productName: "Unknown product", productCode: "" });
  });

  it("passes the optional productId/warehouseId/customerId filters through to the groupBy where clause", async () => {
    salesInvoiceItemMock.groupBy.mockResolvedValue([]);

    await salesInvoiceRepository.aggregateItemWiseSales(COMPANY_ID, FY_ID, {
      ...FILTERS_RANGE,
      productId: PRODUCT_A,
      warehouseId: "wh-1",
      customerId: CUSTOMER_A,
    });

    expect(salesInvoiceItemMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: PRODUCT_A,
          warehouseAllocations: { some: { warehouseId: "wh-1" } },
          salesInvoice: expect.objectContaining({ customerId: CUSTOMER_A }),
        }),
      })
    );
  });
});

describe("salesInvoiceRepository.aggregatePartyWiseSales", () => {
  it("returns [] without querying customers when groupBy yields no rows", async () => {
    salesInvoiceMock.groupBy.mockResolvedValue([]);

    const result = await salesInvoiceRepository.aggregatePartyWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result).toEqual([]);
    expect(customerMock.findMany).not.toHaveBeenCalled();
  });

  it("scopes the groupBy where clause to the caller's company, financial year, POSTED status, and date range", async () => {
    salesInvoiceMock.groupBy.mockResolvedValue([]);

    await salesInvoiceRepository.aggregatePartyWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(salesInvoiceMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["customerId", "customerMode"],
        where: {
          companyId: COMPANY_ID,
          financialYearId: FY_ID,
          status: "POSTED",
          invoiceDate: { gte: FILTERS_RANGE.fromDate, lte: FILTERS_RANGE.toDate },
        },
      })
    );
  });

  it("resolves a real customer's name via the batched customer lookup", async () => {
    salesInvoiceMock.groupBy.mockResolvedValue([
      {
        customerId: CUSTOMER_A,
        customerMode: "PERMANENT",
        _sum: { taxableAmount: decimal(1000), totalCgst: decimal(90), totalSgst: decimal(90), totalIgst: decimal(0), totalCess: decimal(0), grandTotal: decimal(1180) },
        _count: { _all: 2 },
      },
    ]);
    customerMock.findMany.mockResolvedValue([{ id: CUSTOMER_A, ledger: { name: "Acme Co" } }]);

    const result = await salesInvoiceRepository.aggregatePartyWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result).toEqual([
      {
        customerId: CUSTOMER_A,
        customerMode: "PERMANENT",
        customerName: "Acme Co",
        invoiceCount: 2,
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        cess: 0,
        grandTotal: 1180,
      },
    ]);
    expect(customerMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [CUSTOMER_A] }, companyId: COMPANY_ID } })
    );
  });

  it("keeps a null-customerId WALK_IN group and a null-customerId QUICK group as two distinct rows with a null customerName", async () => {
    salesInvoiceMock.groupBy.mockResolvedValue([
      {
        customerId: null,
        customerMode: "WALK_IN",
        _sum: { taxableAmount: decimal(300), totalCgst: decimal(27), totalSgst: decimal(27), totalIgst: decimal(0), totalCess: decimal(0), grandTotal: decimal(354) },
        _count: { _all: 3 },
      },
      {
        customerId: null,
        customerMode: "QUICK",
        _sum: { taxableAmount: decimal(200), totalCgst: decimal(18), totalSgst: decimal(18), totalIgst: decimal(0), totalCess: decimal(0), grandTotal: decimal(236) },
        _count: { _all: 1 },
      },
    ]);

    const result = await salesInvoiceRepository.aggregatePartyWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(customerMock.findMany).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result.every((row) => row.customerId === null && row.customerName === null)).toBe(true);
    expect(result.find((row) => row.customerMode === "WALK_IN")?.invoiceCount).toBe(3);
    expect(result.find((row) => row.customerMode === "QUICK")?.invoiceCount).toBe(1);
  });

  it("falls back to a placeholder name for a customerId the batched lookup didn't resolve", async () => {
    salesInvoiceMock.groupBy.mockResolvedValue([
      {
        customerId: CUSTOMER_A,
        customerMode: "PERMANENT",
        _sum: { taxableAmount: decimal(100), totalCgst: decimal(0), totalSgst: decimal(0), totalIgst: decimal(0), totalCess: decimal(0), grandTotal: decimal(100) },
        _count: { _all: 1 },
      },
    ]);
    customerMock.findMany.mockResolvedValue([]);

    const result = await salesInvoiceRepository.aggregatePartyWiseSales(COMPANY_ID, FY_ID, FILTERS_RANGE);

    expect(result[0].customerName).toBe("Unknown customer");
  });
});
