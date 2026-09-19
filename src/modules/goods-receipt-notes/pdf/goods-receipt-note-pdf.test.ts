import { describe, expect, it } from "vitest";

import type { GoodsReceiptNoteDetail } from "@/types/goods-receipt-note";
import { buildGoodsReceiptNoteHtml } from "@/modules/goods-receipt-notes/pdf/goods-receipt-note-pdf";

function buildFixture(overrides: Partial<GoodsReceiptNoteDetail> = {}): GoodsReceiptNoteDetail {
  return {
    id: "grn-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    grnNumber: "GRN/2026/0001",
    grnDate: new Date("2026-09-10T00:00:00.000Z"),
    supplierId: "supplier-1",
    purchaseOrderId: "po-1",
    status: "RECEIVED",
    narration: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    supplier: { id: "supplier-1", name: "Acme Supplies", isActive: true },
    purchaseOrder: { id: "po-1", orderNumber: "PO/2026/0001" },
    items: [
      {
        id: "item-1",
        goodsReceiptNoteId: "grn-1",
        lineNumber: 1,
        productId: "prod-1",
        warehouseId: "wh-1",
        quantity: 5,
        rejectedQuantity: 1,
        purchaseOrderItemId: "po-item-1",
        product: { id: "prod-1", name: "Widget", productCode: "WID-001", isActive: true },
        warehouse: { id: "wh-1", name: "Main Warehouse", code: "MAIN", isActive: true },
      },
    ],
    ...overrides,
  };
}

describe("buildGoodsReceiptNoteHtml", () => {
  it("renders the GRN number, supplier name, and line items", () => {
    const html = buildGoodsReceiptNoteHtml(buildFixture());

    expect(html).toContain("GRN/2026/0001");
    expect(html).toContain("Acme Supplies");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("PO/2026/0001");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildGoodsReceiptNoteHtml(buildFixture({ narration: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildGoodsReceiptNoteHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
