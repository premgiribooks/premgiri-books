import { describe, expect, it } from "vitest";

import type { SalesInvoiceDetail } from "@/types/sales-invoice";
import { buildSalesInvoiceHtml } from "@/modules/sales-invoices/pdf/sales-invoice-pdf";

function buildFixture(overrides: Partial<SalesInvoiceDetail> = {}): SalesInvoiceDetail {
  return {
    id: "inv-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    invoiceNumber: "INV/2026/0001",
    invoiceDate: new Date("2026-09-10T00:00:00.000Z"),
    customerMode: "PERMANENT",
    customerId: "cust-1",
    quickCustomerName: null,
    quickCustomerMobile: null,
    quickCustomerGstin: null,
    quickCustomerAddress: null,
    placeOfSupplyStateCode: "27",
    salesOrderId: null,
    deliveryChallanId: null,
    status: "POSTED",
    narration: null,
    subtotal: 1000,
    totalDiscount: 0,
    taxableAmount: 1000,
    totalCgst: 90,
    totalSgst: 90,
    totalIgst: 0,
    totalCess: 0,
    roundOff: 0,
    grandTotal: 1180,
    amountPaid: 1180,
    voucherId: "voucher-1",
    createdByUserId: "user-1",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    customer: {
      id: "cust-1",
      name: "Acme Traders",
      isActive: true,
      creditLimit: null,
      ledgerId: "ledger-1",
    },
    salesOrder: null,
    deliveryChallan: null,
    items: [
      {
        id: "item-1",
        salesInvoiceId: "inv-1",
        lineNumber: 1,
        productId: "prod-1",
        warehouseId: "wh-1",
        quantity: 2,
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
        isTaxOverridden: false,
        overriddenCgst: null,
        overriddenSgst: null,
        overriddenIgst: null,
        overriddenCess: null,
        overrideReason: null,
        overriddenByUserId: null,
        product: { id: "prod-1", name: "Widget", productCode: "WID-001", isActive: true },
        warehouse: { id: "wh-1", name: "Main Warehouse", code: "MAIN", isActive: true },
      },
    ],
    payments: [
      {
        id: "pay-1",
        salesInvoiceId: "inv-1",
        ledgerId: "ledger-cash",
        paymentModeId: "mode-cash",
        amount: 1180,
        reference: null,
        ledger: { id: "ledger-cash", name: "Cash-in-Hand" },
        paymentMode: { id: "mode-cash", name: "Cash" },
      },
    ],
    ...overrides,
  };
}

describe("buildSalesInvoiceHtml", () => {
  it("renders the invoice number, party name, line items, and grand total", () => {
    const html = buildSalesInvoiceHtml(buildFixture());

    expect(html).toContain("INV/2026/0001");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("1180.00");
  });

  it("falls back to the quick customer name when there is no linked customer", () => {
    const html = buildSalesInvoiceHtml(
      buildFixture({ customer: null, customerMode: "QUICK", quickCustomerName: "Walk-in Buyer" })
    );

    expect(html).toContain("Walk-in Buyer");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildSalesInvoiceHtml(
      buildFixture({ narration: "<script>alert('x')</script>" })
    );

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildSalesInvoiceHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
