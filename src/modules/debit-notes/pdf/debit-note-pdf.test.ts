import { describe, expect, it } from "vitest";

import type { DebitNoteDetail } from "@/types/debit-note";
import { buildDebitNoteHtml } from "@/modules/debit-notes/pdf/debit-note-pdf";

function buildFixture(overrides: Partial<DebitNoteDetail> = {}): DebitNoteDetail {
  return {
    id: "dn-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    noteNumber: "DN/2026/0001",
    noteDate: new Date("2026-09-10T00:00:00.000Z"),
    customerId: "cust-1",
    salesInvoiceId: "inv-1",
    placeOfSupplyStateCode: "27",
    reason: "Undercharged freight",
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
    items: [
      {
        id: "item-1",
        debitNoteId: "dn-1",
        lineNumber: 1,
        description: "Freight adjustment",
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

describe("buildDebitNoteHtml", () => {
  it("renders the note number, party name, line items, and grand total", () => {
    const html = buildDebitNoteHtml(buildFixture());

    expect(html).toContain("DN/2026/0001");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("Freight adjustment");
    expect(html).toContain("590.00");
  });

  it("omits the linked invoice reference when there is no linked sales invoice", () => {
    const html = buildDebitNoteHtml(buildFixture({ salesInvoice: null, salesInvoiceId: null }));

    expect(html).not.toContain("Against Invoice");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildDebitNoteHtml(buildFixture({ reason: "<script>alert('x')</script>" }));

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildDebitNoteHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
