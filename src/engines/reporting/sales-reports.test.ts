import { describe, expect, it } from "vitest";

import {
  buildItemWiseSalesReport,
  buildPartyWiseSalesReport,
  buildSalesRegister,
  buildSalesReturnSummary,
} from "@/engines/reporting/sales-reports";
import type { ItemWiseSalesAggregateRow, PartyWiseSalesAggregateRow, SalesInvoiceListRow } from "@/types/sales-invoice";
import type { SalesReturnListRow } from "@/types/sales-return";

function invoiceRow(overrides: Partial<SalesInvoiceListRow> = {}): SalesInvoiceListRow {
  return {
    taxableAmount: 1000,
    totalCgst: 90,
    totalSgst: 90,
    totalIgst: 0,
    totalCess: 0,
    grandTotal: 1180,
    amountPaid: 1180,
    customer: { id: "cust-1", name: "Acme Co", isActive: true, creditLimit: null },
    customerMode: "PERMANENT",
    quickCustomerName: null,
    status: "POSTED",
    ...overrides,
  } as unknown as SalesInvoiceListRow;
}

function itemWiseRow(overrides: Partial<ItemWiseSalesAggregateRow> = {}): ItemWiseSalesAggregateRow {
  return {
    productId: "prod-1",
    productName: "Widget",
    productCode: "WID-1",
    quantity: 10,
    taxableAmount: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    cess: 0,
    totalAmount: 1180,
    invoiceCount: 2,
    ...overrides,
  };
}

function partyWiseRow(overrides: Partial<PartyWiseSalesAggregateRow> = {}): PartyWiseSalesAggregateRow {
  return {
    customerId: "cust-1",
    customerMode: "PERMANENT",
    customerName: "Acme Co",
    invoiceCount: 2,
    taxableAmount: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    cess: 0,
    grandTotal: 1180,
    ...overrides,
  };
}

function returnRow(overrides: Partial<SalesReturnListRow> = {}): SalesReturnListRow {
  return {
    id: "ret-1",
    returnNumber: "SR-0001",
    grandTotal: 118,
    salesInvoice: { id: "inv-1", invoiceNumber: "INV-0001", invoiceDate: new Date(), customerMode: "PERMANENT", customerId: "cust-1", customerName: "Acme Co" },
    ...overrides,
  } as unknown as SalesReturnListRow;
}

describe("buildSalesRegister", () => {
  it("returns zeroed totals for an empty result set", () => {
    const report = buildSalesRegister([]);
    expect(report).toEqual({ rows: [], totals: { taxableAmount: 0, totalTax: 0, grandTotal: 0, amountPaid: 0 } });
  });

  it("combines cgst+sgst+igst+cess into a single totalTax figure and sums every column", () => {
    const rows = [invoiceRow(), invoiceRow({ taxableAmount: 500, totalCgst: 0, totalSgst: 0, totalIgst: 90, totalCess: 5, grandTotal: 595, amountPaid: 0 })];
    const report = buildSalesRegister(rows);
    expect(report.totals).toEqual({ taxableAmount: 1500, totalTax: 275, grandTotal: 1775, amountPaid: 1180 });
    expect(report.rows).toHaveLength(2);
  });
});

describe("buildItemWiseSalesReport", () => {
  it("combines each row's separate tax fields into one totalTax figure", () => {
    const report = buildItemWiseSalesReport([itemWiseRow()]);
    expect(report.rows[0].totalTax).toBe(180);
    expect(report.rows[0].totalValue).toBe(1180);
  });

  it("sums quantity/taxableAmount/totalTax/totalValue across products, excluding invoiceCount from the footer", () => {
    const rows = [itemWiseRow(), itemWiseRow({ productId: "prod-2", quantity: 5, taxableAmount: 500, cgst: 45, sgst: 45, igst: 0, cess: 0, totalAmount: 590, invoiceCount: 1 })];
    const report = buildItemWiseSalesReport(rows);
    expect(report.totals).toEqual({ quantity: 15, taxableAmount: 1500, totalTax: 270, totalValue: 1770 });
    expect(report.totals).not.toHaveProperty("invoiceCount");
  });

  it("returns an empty report for no rows", () => {
    expect(buildItemWiseSalesReport([])).toEqual({ rows: [], totals: { quantity: 0, taxableAmount: 0, totalTax: 0, totalValue: 0 } });
  });
});

describe("buildPartyWiseSalesReport", () => {
  it("classifies a non-null customerId row as CUSTOMER, keeping the repository-resolved name", () => {
    const report = buildPartyWiseSalesReport([partyWiseRow()]);
    expect(report.rows[0]).toMatchObject({ groupType: "CUSTOMER", customerId: "cust-1", customerName: "Acme Co", totalTax: 180 });
  });

  it("labels a null-customerId WALK_IN row as the 'Walk-in Sales' synthetic bucket", () => {
    const report = buildPartyWiseSalesReport([partyWiseRow({ customerId: null, customerMode: "WALK_IN", customerName: null })]);
    expect(report.rows[0]).toMatchObject({ groupType: "WALK_IN", customerId: null, customerName: "Walk-in Sales" });
  });

  it("labels a null-customerId QUICK row as the 'Quick Customer Sales (unconverted)' synthetic bucket", () => {
    const report = buildPartyWiseSalesReport([partyWiseRow({ customerId: null, customerMode: "QUICK", customerName: null })]);
    expect(report.rows[0]).toMatchObject({ groupType: "QUICK_UNCONVERTED", customerId: null, customerName: "Quick Customer Sales (unconverted)" });
  });

  it("sums invoiceCount across groups in the footer, since every invoice belongs to exactly one group", () => {
    const rows = [
      partyWiseRow({ invoiceCount: 2, taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0, grandTotal: 1180 }),
      partyWiseRow({ customerId: null, customerMode: "WALK_IN", customerName: null, invoiceCount: 3, taxableAmount: 300, cgst: 27, sgst: 27, igst: 0, cess: 0, grandTotal: 354 }),
    ];
    const report = buildPartyWiseSalesReport(rows);
    expect(report.totals).toEqual({ invoiceCount: 5, taxableAmount: 1300, totalTax: 234, grandTotal: 1534 });
  });
});

describe("buildSalesReturnSummary", () => {
  it("sums grandTotal across every row when no customerId filter is given", () => {
    const rows = [returnRow(), returnRow({ id: "ret-2", grandTotal: 236, salesInvoice: { id: "inv-2", invoiceNumber: "INV-0002", invoiceDate: new Date(), customerMode: "PERMANENT", customerId: "cust-2", customerName: "Other Co" } as never })];
    const report = buildSalesReturnSummary(rows);
    expect(report.rows).toHaveLength(2);
    expect(report.totalGrandTotal).toBe(354);
  });

  it("filters in-memory by the parent invoice's customerId", () => {
    const rows = [returnRow(), returnRow({ id: "ret-2", grandTotal: 236, salesInvoice: { id: "inv-2", invoiceNumber: "INV-0002", invoiceDate: new Date(), customerMode: "PERMANENT", customerId: "cust-2", customerName: "Other Co" } as never })];
    const report = buildSalesReturnSummary(rows, "cust-1");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].id).toBe("ret-1");
    expect(report.totalGrandTotal).toBe(118);
  });

  it("a cross-company/non-matching customerId naturally yields an empty, not-thrown, report", () => {
    const report = buildSalesReturnSummary([returnRow()], "no-such-customer");
    expect(report.rows).toEqual([]);
    expect(report.totalGrandTotal).toBe(0);
  });
});
