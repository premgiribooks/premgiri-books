import { describe, expect, it } from "vitest";

import type { DeliveryChallanDetail } from "@/types/delivery-challan";
import { buildDeliveryChallanHtml } from "@/modules/delivery-challans/pdf/delivery-challan-pdf";

function buildFixture(overrides: Partial<DeliveryChallanDetail> = {}): DeliveryChallanDetail {
  return {
    id: "dc-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    challanNumber: "DC/2026/0001",
    challanDate: new Date("2026-09-10T00:00:00.000Z"),
    customerId: "cust-1",
    salesOrderId: null,
    status: "DISPATCHED",
    narration: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    customer: {
      id: "cust-1",
      name: "Acme Traders",
      isActive: true,
    },
    salesOrder: null,
    items: [
      {
        id: "item-1",
        deliveryChallanId: "dc-1",
        lineNumber: 1,
        productId: "prod-1",
        warehouseId: "wh-1",
        quantity: 5,
        salesOrderItemId: null,
        product: { id: "prod-1", name: "Widget", productCode: "WID-001", isActive: true },
        warehouse: { id: "wh-1", name: "Main Warehouse", code: "MAIN", isActive: true },
      },
    ],
    ...overrides,
  };
}

describe("buildDeliveryChallanHtml", () => {
  it("renders the challan number, customer name, and line items", () => {
    const html = buildDeliveryChallanHtml(buildFixture());

    expect(html).toContain("DC/2026/0001");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("Main Warehouse");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildDeliveryChallanHtml(buildFixture({ narration: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildDeliveryChallanHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
