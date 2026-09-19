import { describe, expect, it } from "vitest";

import type { SalesOrderDetail } from "@/types/sales-order";
import { buildSalesOrderHtml } from "@/modules/sales-orders/pdf/sales-order-pdf";

function buildFixture(overrides: Partial<SalesOrderDetail> = {}): SalesOrderDetail {
  return {
    id: "so-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    orderNumber: "SO/2026/0001",
    orderDate: new Date("2026-09-10T00:00:00.000Z"),
    expectedDeliveryDate: new Date("2026-09-15T00:00:00.000Z"),
    customerId: "cust-1",
    placeOfSupplyStateCode: "27",
    status: "CONFIRMED",
    narration: null,
    quotationId: null,
    subtotal: 1000,
    totalDiscount: 0,
    taxableAmount: 1000,
    totalCgst: 90,
    totalSgst: 90,
    totalIgst: 0,
    totalCess: 0,
    grandTotal: 1180,
    createdByUserId: "user-1",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    customer: {
      id: "cust-1",
      name: "Acme Traders",
      isActive: true,
    },
    items: [
      {
        id: "item-1",
        salesOrderId: "so-1",
        lineNumber: 1,
        productId: "prod-1",
        quantity: 2,
        deliveredQuantity: 0,
        rate: 500,
        discountPercent: 0,
        discountAmount: 0,
        ratePercent: 18,
        cessPercent: 0,
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        cess: 0,
        totalAmount: 1180,
        product: { id: "prod-1", name: "Widget", productCode: "WID-001", isActive: true },
      },
    ],
    ...overrides,
  };
}

describe("buildSalesOrderHtml", () => {
  it("renders the order number, customer name, line items, and grand total", () => {
    const html = buildSalesOrderHtml(buildFixture());

    expect(html).toContain("SO/2026/0001");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("1180.00");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildSalesOrderHtml(buildFixture({ narration: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildSalesOrderHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
