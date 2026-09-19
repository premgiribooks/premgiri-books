import { describe, expect, it } from "vitest";

import {
  buildItemWiseSalesReport,
  buildPartyWiseSalesReport,
  buildSalesRegister,
  buildSalesReturnSummary,
  toItemWiseSalesExportTable,
  toPartyWiseSalesExportTable,
  toSalesRegisterExportTable,
  toSalesReturnSummaryExportTable,
} from "@/engines/reporting/sales-reports";
import type { ItemWiseSalesAggregateRow, PartyWiseSalesAggregateRow, SalesInvoiceListRow } from "@/types/sales-invoice";
import type { SalesReturnListRow } from "@/types/sales-return";

function invoiceRow(overrides: Partial<SalesInvoiceListRow> = {}): SalesInvoiceListRow {
  return {
    invoiceNumber: "INV-0001",
    invoiceDate: new Date("2027-01-15"),
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
    returnDate: new Date("2027-02-10"),
    grandTotal: 118,
    refundMode: "LEDGER_ADJUSTMENT",
    status: "POSTED",
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

describe("toSalesRegisterExportTable", () => {
  it("maps a real-Customer row's fields, combining cgst+sgst+igst+cess into one Total Tax figure, and labels status the same way the on-screen badge does", () => {
    const report = buildSalesRegister([
      invoiceRow({
        invoiceNumber: "INV-0001",
        invoiceDate: new Date("2027-01-15"),
        status: "POSTED",
      }),
    ]);

    const tables = toSalesRegisterExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Sales Register");
    expect(tables[0].rows).toEqual([
      {
        invoiceNumber: "INV-0001",
        invoiceDate: new Date("2027-01-15"),
        customerName: "Acme Co",
        taxableAmount: 1000,
        totalTax: 180,
        grandTotal: 1180,
        amountPaid: 1180,
        status: "Posted",
      },
    ]);
  });

  it("falls back to the Walk-in/Quick Customer label for a null-customer row, mirroring sales-register-table.tsx's customerLabel exactly", () => {
    const report = buildSalesRegister([
      invoiceRow({
        invoiceNumber: "INV-0002",
        customer: null,
        customerMode: "WALK_IN",
        quickCustomerName: null,
        status: "DRAFT",
      }),
      invoiceRow({
        invoiceNumber: "INV-0003",
        customer: null,
        customerMode: "QUICK",
        quickCustomerName: "Ramesh",
        status: "CANCELLED",
      }),
    ]);

    const tables = toSalesRegisterExportTable(report);

    expect(tables[0].rows[0]).toMatchObject({ customerName: "Walk-in", status: "Draft" });
    expect(tables[0].rows[1]).toMatchObject({ customerName: "Ramesh", status: "Cancelled" });
  });

  it("carries the totals footer straight from report.totals — never re-summed", () => {
    const report = buildSalesRegister([
      invoiceRow({ taxableAmount: 500, totalCgst: 0, totalSgst: 0, totalIgst: 90, totalCess: 5, grandTotal: 595, amountPaid: 0 }),
    ]);

    const tables = toSalesRegisterExportTable(report);

    expect(tables[0].totals).toEqual({
      invoiceNumber: "Total",
      invoiceDate: null,
      customerName: "",
      taxableAmount: report.totals.taxableAmount,
      totalTax: report.totals.totalTax,
      grandTotal: report.totals.grandTotal,
      amountPaid: report.totals.amountPaid,
      status: "",
    });
  });

  it("produces a valid, empty sheet with a zero-totals footer for an empty rows: [] report", () => {
    const report = buildSalesRegister([]);

    const tables = toSalesRegisterExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toEqual([]);
    expect(tables[0].totals).toEqual({
      invoiceNumber: "Total",
      invoiceDate: null,
      customerName: "",
      taxableAmount: 0,
      totalTax: 0,
      grandTotal: 0,
      amountPaid: 0,
      status: "",
    });
  });
});

describe("toItemWiseSalesExportTable", () => {
  it("maps each product row's fields, combining cgst+sgst+igst+cess into one Total Tax figure", () => {
    const report = buildItemWiseSalesReport([itemWiseRow()]);

    const tables = toItemWiseSalesExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Item-wise Sales");
    expect(tables[0].rows).toEqual([
      {
        productName: "Widget",
        productCode: "WID-1",
        quantity: 10,
        taxableAmount: 1000,
        totalTax: 180,
        totalValue: 1180,
        invoiceCount: 2,
      },
    ]);
  });

  it("carries the totals footer straight from report.totals, leaving invoiceCount blank — never re-summed", () => {
    const report = buildItemWiseSalesReport([itemWiseRow(), itemWiseRow({ productId: "prod-2", quantity: 5 })]);

    const tables = toItemWiseSalesExportTable(report);

    expect(tables[0].totals).toEqual({
      productName: "Period Total",
      productCode: "",
      quantity: report.totals.quantity,
      taxableAmount: report.totals.taxableAmount,
      totalTax: report.totals.totalTax,
      totalValue: report.totals.totalValue,
      invoiceCount: null,
    });
  });

  it("produces a valid, empty sheet with a zero-totals footer for no rows", () => {
    const tables = toItemWiseSalesExportTable(buildItemWiseSalesReport([]));

    expect(tables[0].rows).toEqual([]);
    expect(tables[0].totals).toMatchObject({ quantity: 0, taxableAmount: 0, totalTax: 0, totalValue: 0 });
  });
});

describe("toPartyWiseSalesExportTable", () => {
  it("maps a real-Customer row's fields, and labels the synthetic Walk-in/Quick buckets via customerName", () => {
    const report = buildPartyWiseSalesReport([
      partyWiseRow(),
      partyWiseRow({ customerId: null, customerMode: "WALK_IN", customerName: null, invoiceCount: 1, taxableAmount: 100, cgst: 9, sgst: 9, igst: 0, cess: 0, grandTotal: 118 }),
    ]);

    const tables = toPartyWiseSalesExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Party-wise Sales");
    expect(tables[0].rows[0]).toEqual({ customerName: "Acme Co", invoiceCount: 2, taxableAmount: 1000, totalTax: 180, grandTotal: 1180 });
    expect(tables[0].rows[1]).toMatchObject({ customerName: "Walk-in Sales" });
  });

  it("carries the totals footer straight from report.totals, including the summed invoiceCount — never re-summed", () => {
    const report = buildPartyWiseSalesReport([partyWiseRow(), partyWiseRow({ customerId: "cust-2", customerName: "Other Co" })]);

    const tables = toPartyWiseSalesExportTable(report);

    expect(tables[0].totals).toEqual({
      customerName: "Period Total",
      invoiceCount: report.totals.invoiceCount,
      taxableAmount: report.totals.taxableAmount,
      totalTax: report.totals.totalTax,
      grandTotal: report.totals.grandTotal,
    });
  });
});

describe("toSalesReturnSummaryExportTable", () => {
  it("maps each return row's fields, labeling refund mode and status via their own display maps", () => {
    const report = buildSalesReturnSummary([returnRow()]);

    const tables = toSalesReturnSummaryExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Sales Return Summary");
    expect(tables[0].rows).toEqual([
      {
        returnNumber: "SR-0001",
        invoiceNumber: "INV-0001",
        returnDate: new Date("2027-02-10"),
        customerName: "Acme Co",
        grandTotal: 118,
        refundMode: "Ledger Adjustment",
        status: "Posted",
      },
    ]);
  });

  it("falls back to 'Draft' for a null returnNumber and '—' for a missing customer name", () => {
    const report = buildSalesReturnSummary([
      returnRow({ returnNumber: null, salesInvoice: { id: "inv-1", invoiceNumber: "INV-0001", invoiceDate: new Date(), customerMode: "WALK_IN", customerId: null, customerName: null } as never }),
    ]);

    const tables = toSalesReturnSummaryExportTable(report);

    expect(tables[0].rows[0]).toMatchObject({ returnNumber: "Draft", customerName: "—" });
  });

  it("carries the totals footer straight from report.totalGrandTotal — never re-summed", () => {
    const report = buildSalesReturnSummary([returnRow(), returnRow({ id: "ret-2", grandTotal: 236 })]);

    const tables = toSalesReturnSummaryExportTable(report);

    expect(tables[0].totals).toEqual({
      returnNumber: "Total",
      invoiceNumber: "",
      returnDate: null,
      customerName: "",
      grandTotal: report.totalGrandTotal,
      refundMode: "",
      status: "",
    });
  });
});
