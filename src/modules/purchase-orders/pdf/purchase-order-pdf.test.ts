import { describe, expect, it } from "vitest";

import type { PurchaseOrderDetail } from "@/types/purchase-order";
import { buildPurchaseOrderHtml } from "@/modules/purchase-orders/pdf/purchase-order-pdf";

function buildFixture(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: "po-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    orderNumber: "PO/2026/0001",
    orderDate: new Date("2026-09-10T00:00:00.000Z"),
    expectedDeliveryDate: new Date("2026-09-20T00:00:00.000Z"),
    supplierId: "supplier-1",
    placeOfSupplyStateCode: "27",
    status: "CONFIRMED",
    narration: null,
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
    supplier: { id: "supplier-1", name: "Acme Supplies", isActive: true },
    items: [
      {
        id: "item-1",
        purchaseOrderId: "po-1",
        lineNumber: 1,
        productId: "prod-1",
        quantity: 2,
        receivedQuantity: 0,
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

describe("buildPurchaseOrderHtml", () => {
  it("renders the order number, supplier name, line items, and grand total", () => {
    const html = buildPurchaseOrderHtml(buildFixture());

    expect(html).toContain("PO/2026/0001");
    expect(html).toContain("Acme Supplies");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("1180.00");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildPurchaseOrderHtml(buildFixture({ narration: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildPurchaseOrderHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
