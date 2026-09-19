import { describe, expect, it } from "vitest";

import type { SalesReturnDetail } from "@/types/sales-return";
import { buildSalesReturnHtml } from "@/modules/sales-returns/pdf/sales-return-pdf";

function buildFixture(overrides: Partial<SalesReturnDetail> = {}): SalesReturnDetail {
  return {
    id: "ret-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    salesInvoiceId: "inv-1",
    returnNumber: "SR/2026/0001",
    returnDate: new Date("2026-09-10T00:00:00.000Z"),
    refundMode: "LEDGER_ADJUSTMENT",
    refundLedgerId: null,
    paymentModeId: null,
    reason: null,
    status: "POSTED",
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
    salesInvoice: {
      id: "inv-1",
      invoiceNumber: "INV/2026/0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      customerMode: "PERMANENT",
      customerId: "cust-1",
      customerName: "Acme Traders",
    },
    refundLedger: null,
    paymentMode: null,
    items: [
      {
        id: "item-1",
        salesReturnId: "ret-1",
        lineNumber: 1,
        salesInvoiceItemId: "inv-item-1",
        quantity: 1,
        taxableAmount: 500,
        cgst: 45,
        sgst: 45,
        igst: 0,
        cess: 0,
        totalAmount: 590,
        salesInvoiceItem: {
          id: "inv-item-1",
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

describe("buildSalesReturnHtml", () => {
  it("renders the return number, party name, line items, and grand total", () => {
    const html = buildSalesReturnHtml(buildFixture());

    expect(html).toContain("SR/2026/0001");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("590.00");
  });

  it("falls back to Walk-in when the source invoice has no customer name", () => {
    const html = buildSalesReturnHtml(
      buildFixture({ salesInvoice: { ...buildFixture().salesInvoice, customerName: null } })
    );

    expect(html).toContain("Walk-in");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildSalesReturnHtml(buildFixture({ reason: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildSalesReturnHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
