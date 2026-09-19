import { describe, expect, it } from "vitest";

import type { CreditNoteDetail } from "@/types/credit-note";
import { buildCreditNoteHtml } from "@/modules/credit-notes/pdf/credit-note-pdf";

function buildFixture(overrides: Partial<CreditNoteDetail> = {}): CreditNoteDetail {
  return {
    id: "cn-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    noteNumber: "CN/2026/0001",
    noteDate: new Date("2026-09-10T00:00:00.000Z"),
    customerId: "cust-1",
    salesInvoiceId: "inv-1",
    placeOfSupplyStateCode: "27",
    refundMode: "LEDGER_ADJUSTMENT",
    refundLedgerId: null,
    paymentModeId: null,
    reason: "Price adjustment",
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
    customer: { id: "cust-1", name: "Acme Traders" },
    salesInvoice: { id: "inv-1", invoiceNumber: "INV/2026/0001", invoiceDate: new Date("2026-09-01T00:00:00.000Z") },
    refundLedger: null,
    paymentMode: null,
    items: [
      {
        id: "item-1",
        creditNoteId: "cn-1",
        lineNumber: 1,
        description: "Rate correction",
        taxableAmount: 500,
        ratePercent: 18,
        cessPercent: 0,
        cgst: 45,
        sgst: 45,
        igst: 0,
        cess: 0,
        totalAmount: 590,
      },
    ],
    ...overrides,
  };
}

describe("buildCreditNoteHtml", () => {
  it("renders the note number, party name, line items, and grand total", () => {
    const html = buildCreditNoteHtml(buildFixture());

    expect(html).toContain("CN/2026/0001");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("Rate correction");
    expect(html).toContain("590.00");
  });

  it("omits the linked invoice reference when there is no linked sales invoice", () => {
    const html = buildCreditNoteHtml(buildFixture({ salesInvoice: null, salesInvoiceId: null }));

    expect(html).not.toContain("Against Invoice");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildCreditNoteHtml(buildFixture({ reason: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildCreditNoteHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
