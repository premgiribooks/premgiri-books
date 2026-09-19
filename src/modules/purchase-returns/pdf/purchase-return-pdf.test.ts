import { describe, expect, it } from "vitest";

import type { PurchaseReturnDetail } from "@/types/purchase-return";
import { buildPurchaseReturnHtml } from "@/modules/purchase-returns/pdf/purchase-return-pdf";

function buildFixture(overrides: Partial<PurchaseReturnDetail> = {}): PurchaseReturnDetail {
  return {
    id: "pr-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    returnNumber: "PRET/2026/0001",
    returnDate: new Date("2026-09-10T00:00:00.000Z"),
    purchaseInvoiceId: "pinv-1",
    refundMode: "LEDGER_ADJUSTMENT",
    refundLedgerId: null,
    paymentModeId: null,
    status: "POSTED",
    reason: null,
    taxableAmount: 500,
    totalCgst: 45,
    totalSgst: 45,
    totalIgst: 0,
    totalCess: 0,
    grandTotal: 590,
    voucherId: "voucher-1",
    createdByUserId: "user-1",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    purchaseInvoice: {
      id: "pinv-1",
      invoiceNumber: "PINV/2026/0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      supplierId: "supplier-1",
      supplierName: "Acme Supplies",
    },
    refundLedger: null,
    paymentMode: null,
    items: [
      {
        id: "item-1",
        purchaseReturnId: "pr-1",
        lineNumber: 1,
        purchaseInvoiceItemId: "pinv-item-1",
        quantity: 1,
        taxableAmount: 500,
        cgst: 45,
        sgst: 45,
        igst: 0,
        cess: 0,
        totalAmount: 590,
        purchaseInvoiceItem: {
          id: "pinv-item-1",
          productId: "prod-1",
          productName: "Widget",
          productCode: "WID-001",
          warehouseId: "wh-1",
          warehouseName: "Main Warehouse",
        },
      },
    ],
    ...overrides,
  };
}

describe("buildPurchaseReturnHtml", () => {
  it("renders the return number, supplier name, line items, and grand total", () => {
    const html = buildPurchaseReturnHtml(buildFixture());

    expect(html).toContain("PRET/2026/0001");
    expect(html).toContain("Acme Supplies");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("590.00");
  });

  it("falls back to a draft label when returnNumber has not been assigned yet", () => {
    const html = buildPurchaseReturnHtml(buildFixture({ returnNumber: null, status: "DRAFT" }));

    expect(html).toContain("Draft");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildPurchaseReturnHtml(buildFixture({ reason: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildPurchaseReturnHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
