import { describe, expect, it } from "vitest";

import {
  buildItemWisePurchaseReport,
  buildPartyWisePurchaseReport,
  buildPurchaseRegister,
  buildPurchaseReturnSummary,
  toItemWisePurchaseExportTable,
  toPartyWisePurchaseExportTable,
  toPurchaseRegisterExportTable,
  toPurchaseReturnSummaryExportTable,
} from "@/engines/reporting/purchase-reports";
import type { ItemWisePurchaseAggregateRow, PartyWisePurchaseAggregateRow, PurchaseInvoiceListRow } from "@/types/purchase-invoice";
import type { PurchaseReturnListRow } from "@/types/purchase-return";

function invoiceRow(overrides: Partial<PurchaseInvoiceListRow> = {}): PurchaseInvoiceListRow {
  return {
    taxableAmount: 1000,
    totalCgst: 90,
    totalSgst: 90,
    totalIgst: 0,
    totalCess: 0,
    grandTotal: 1180,
    amountPaid: 1180,
    supplier: { id: "supp-1", name: "Acme Supplies", isActive: true, creditDays: 30 },
    status: "POSTED",
    ...overrides,
  } as unknown as PurchaseInvoiceListRow;
}

function itemWiseRow(overrides: Partial<ItemWisePurchaseAggregateRow> = {}): ItemWisePurchaseAggregateRow {
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

function partyWiseRow(overrides: Partial<PartyWisePurchaseAggregateRow> = {}): PartyWisePurchaseAggregateRow {
  return {
    supplierId: "supp-1",
    supplierName: "Acme Supplies",
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

function returnRow(overrides: Partial<PurchaseReturnListRow> = {}): PurchaseReturnListRow {
  return {
    id: "ret-1",
    returnNumber: "PR-0001",
    returnDate: new Date("2027-02-10T00:00:00.000Z"),
    grandTotal: 118,
    refundMode: "LEDGER_ADJUSTMENT",
    status: "POSTED",
    purchaseInvoice: { id: "inv-1", invoiceNumber: "PINV-0001", invoiceDate: new Date(), supplierId: "supp-1", supplierName: "Acme Supplies" },
    ...overrides,
  } as unknown as PurchaseReturnListRow;
}

describe("buildPurchaseRegister", () => {
  it("returns zeroed totals for an empty result set", () => {
    const report = buildPurchaseRegister([]);
    expect(report).toEqual({ rows: [], totals: { taxableAmount: 0, totalTax: 0, grandTotal: 0, amountPaid: 0 } });
  });

  it("combines cgst+sgst+igst+cess into a single totalTax figure and sums every column", () => {
    const rows = [invoiceRow(), invoiceRow({ taxableAmount: 500, totalCgst: 0, totalSgst: 0, totalIgst: 90, totalCess: 5, grandTotal: 595, amountPaid: 0 })];
    const report = buildPurchaseRegister(rows);
    expect(report.totals).toEqual({ taxableAmount: 1500, totalTax: 275, grandTotal: 1775, amountPaid: 1180 });
    expect(report.rows).toHaveLength(2);
  });
});

describe("buildItemWisePurchaseReport", () => {
  it("combines each row's separate tax fields into one totalTax figure", () => {
    const report = buildItemWisePurchaseReport([itemWiseRow()]);
    expect(report.rows[0].totalTax).toBe(180);
    expect(report.rows[0].totalValue).toBe(1180);
  });

  it("sums quantity/taxableAmount/totalTax/totalValue across products, excluding invoiceCount from the footer", () => {
    const rows = [itemWiseRow(), itemWiseRow({ productId: "prod-2", quantity: 5, taxableAmount: 500, cgst: 45, sgst: 45, igst: 0, cess: 0, totalAmount: 590, invoiceCount: 1 })];
    const report = buildItemWisePurchaseReport(rows);
    expect(report.totals).toEqual({ quantity: 15, taxableAmount: 1500, totalTax: 270, totalValue: 1770 });
    expect(report.totals).not.toHaveProperty("invoiceCount");
  });

  it("returns an empty report for no rows", () => {
    expect(buildItemWisePurchaseReport([])).toEqual({ rows: [], totals: { quantity: 0, taxableAmount: 0, totalTax: 0, totalValue: 0 } });
  });
});

describe("buildPartyWisePurchaseReport", () => {
  it("keeps the repository-resolved supplierId/supplierName with no synthetic-bucket grouping", () => {
    const report = buildPartyWisePurchaseReport([partyWiseRow()]);
    expect(report.rows[0]).toMatchObject({ supplierId: "supp-1", supplierName: "Acme Supplies", totalTax: 180 });
    expect(report.rows[0]).not.toHaveProperty("groupType");
  });

  it("sums invoiceCount across suppliers in the footer, since every invoice belongs to exactly one supplier", () => {
    const rows = [
      partyWiseRow({ invoiceCount: 2, taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0, grandTotal: 1180 }),
      partyWiseRow({ supplierId: "supp-2", supplierName: "Other Supplies", invoiceCount: 3, taxableAmount: 300, cgst: 27, sgst: 27, igst: 0, cess: 0, grandTotal: 354 }),
    ];
    const report = buildPartyWisePurchaseReport(rows);
    expect(report.totals).toEqual({ invoiceCount: 5, taxableAmount: 1300, totalTax: 234, grandTotal: 1534 });
  });
});

describe("buildPurchaseReturnSummary", () => {
  it("sums grandTotal across every row when no supplierId filter is given", () => {
    const rows = [returnRow(), returnRow({ id: "ret-2", grandTotal: 236, purchaseInvoice: { id: "inv-2", invoiceNumber: "PINV-0002", invoiceDate: new Date(), supplierId: "supp-2", supplierName: "Other Supplies" } as never })];
    const report = buildPurchaseReturnSummary(rows);
    expect(report.rows).toHaveLength(2);
    expect(report.totalGrandTotal).toBe(354);
  });

  it("filters in-memory by the parent invoice's supplierId", () => {
    const rows = [returnRow(), returnRow({ id: "ret-2", grandTotal: 236, purchaseInvoice: { id: "inv-2", invoiceNumber: "PINV-0002", invoiceDate: new Date(), supplierId: "supp-2", supplierName: "Other Supplies" } as never })];
    const report = buildPurchaseReturnSummary(rows, "supp-1");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].id).toBe("ret-1");
    expect(report.totalGrandTotal).toBe(118);
  });

  it("a cross-company/non-matching supplierId naturally yields an empty, not-thrown, report", () => {
    const report = buildPurchaseReturnSummary([returnRow()], "no-such-supplier");
    expect(report.rows).toEqual([]);
    expect(report.totalGrandTotal).toBe(0);
  });
});

describe("toPurchaseRegisterExportTable", () => {
  it("maps each row to its export shape, combining tax fields and using the status display label", () => {
    const rows = [
      invoiceRow({
        invoiceNumber: "PINV-0001",
        supplierInvoiceNumber: "SUP-INV-1",
        invoiceDate: new Date("2027-01-15T00:00:00.000Z"),
        taxableAmount: 1000,
        totalCgst: 90,
        totalSgst: 90,
        totalIgst: 0,
        totalCess: 0,
        grandTotal: 1180,
        amountPaid: 1180,
        status: "POSTED",
        supplier: { id: "supp-1", name: "Acme Supplies", isActive: true, creditDays: 30, ledgerId: "ledger-1" },
      }),
      invoiceRow({
        invoiceNumber: null,
        supplierInvoiceNumber: "SUP-INV-2",
        invoiceDate: new Date("2027-01-20T00:00:00.000Z"),
        taxableAmount: 500,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 90,
        totalCess: 5,
        grandTotal: 595,
        amountPaid: 0,
        status: "DRAFT",
        supplier: { id: "supp-2", name: "Beta Traders", isActive: true, creditDays: 15, ledgerId: "ledger-2" },
      }),
    ];
    const report = buildPurchaseRegister(rows);

    const tables = toPurchaseRegisterExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Purchase Register");
    expect(tables[0].rows).toEqual([
      {
        invoiceNumber: "PINV-0001",
        supplierInvoiceNumber: "SUP-INV-1",
        supplierName: "Acme Supplies",
        invoiceDate: new Date("2027-01-15T00:00:00.000Z"),
        taxableAmount: 1000,
        totalTax: 180,
        grandTotal: 1180,
        amountPaid: 1180,
        status: "Posted",
      },
      {
        invoiceNumber: "—",
        supplierInvoiceNumber: "SUP-INV-2",
        supplierName: "Beta Traders",
        invoiceDate: new Date("2027-01-20T00:00:00.000Z"),
        taxableAmount: 500,
        totalTax: 95,
        grandTotal: 595,
        amountPaid: 0,
        status: "Draft",
      },
    ]);
  });

  it("copies the totals footer straight from report.totals, never re-summing", () => {
    const rows = [
      invoiceRow(),
      invoiceRow({
        taxableAmount: 500,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 90,
        totalCess: 5,
        grandTotal: 595,
        amountPaid: 0,
      }),
    ];
    const report = buildPurchaseRegister(rows);

    const tables = toPurchaseRegisterExportTable(report);

    expect(tables[0].totals).toEqual({
      invoiceNumber: "Period Total",
      supplierInvoiceNumber: null,
      supplierName: null,
      invoiceDate: null,
      taxableAmount: report.totals.taxableAmount,
      totalTax: report.totals.totalTax,
      grandTotal: report.totals.grandTotal,
      amountPaid: report.totals.amountPaid,
      status: null,
    });
  });

  it("returns a valid, empty sheet with a zero-totals footer for an empty report", () => {
    const report = buildPurchaseRegister([]);

    const tables = toPurchaseRegisterExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toEqual([]);
    expect(tables[0].totals).toEqual({
      invoiceNumber: "Period Total",
      supplierInvoiceNumber: null,
      supplierName: null,
      invoiceDate: null,
      taxableAmount: 0,
      totalTax: 0,
      grandTotal: 0,
      amountPaid: 0,
      status: null,
    });
  });
});

describe("toItemWisePurchaseExportTable", () => {
  it("maps each row to its export shape, splitting product name and code into two columns", () => {
    const report = buildItemWisePurchaseReport([itemWiseRow()]);

    const tables = toItemWisePurchaseExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Item-wise Purchases");
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

  it("copies the totals footer straight from report.totals, excluding invoiceCount", () => {
    const rows = [
      itemWiseRow(),
      itemWiseRow({ productId: "prod-2", quantity: 5, taxableAmount: 500, cgst: 45, sgst: 45, igst: 0, cess: 0, totalAmount: 590, invoiceCount: 1 }),
    ];
    const report = buildItemWisePurchaseReport(rows);

    const tables = toItemWisePurchaseExportTable(report);

    expect(tables[0].totals).toEqual({
      productName: "Period Total",
      productCode: null,
      quantity: report.totals.quantity,
      taxableAmount: report.totals.taxableAmount,
      totalTax: report.totals.totalTax,
      totalValue: report.totals.totalValue,
      invoiceCount: null,
    });
  });

  it("returns a valid, empty sheet with a zero-totals footer for an empty report", () => {
    const report = buildItemWisePurchaseReport([]);

    const tables = toItemWisePurchaseExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toEqual([]);
    expect(tables[0].totals).toEqual({
      productName: "Period Total",
      productCode: null,
      quantity: 0,
      taxableAmount: 0,
      totalTax: 0,
      totalValue: 0,
      invoiceCount: null,
    });
  });
});

describe("toPartyWisePurchaseExportTable", () => {
  it("maps each row to its export shape", () => {
    const report = buildPartyWisePurchaseReport([partyWiseRow()]);

    const tables = toPartyWisePurchaseExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Party-wise Purchases");
    expect(tables[0].rows).toEqual([
      {
        supplierName: "Acme Supplies",
        invoiceCount: 2,
        taxableAmount: 1000,
        totalTax: 180,
        grandTotal: 1180,
      },
    ]);
  });

  it("copies the totals footer straight from report.totals, including the summed invoiceCount", () => {
    const rows = [
      partyWiseRow({ invoiceCount: 2, taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0, grandTotal: 1180 }),
      partyWiseRow({ supplierId: "supp-2", supplierName: "Other Supplies", invoiceCount: 3, taxableAmount: 300, cgst: 27, sgst: 27, igst: 0, cess: 0, grandTotal: 354 }),
    ];
    const report = buildPartyWisePurchaseReport(rows);

    const tables = toPartyWisePurchaseExportTable(report);

    expect(tables[0].totals).toEqual({
      supplierName: "Period Total",
      invoiceCount: report.totals.invoiceCount,
      taxableAmount: report.totals.taxableAmount,
      totalTax: report.totals.totalTax,
      grandTotal: report.totals.grandTotal,
    });
  });

  it("returns a valid, empty sheet with a zero-totals footer for an empty report", () => {
    const report = buildPartyWisePurchaseReport([]);

    const tables = toPartyWisePurchaseExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toEqual([]);
    expect(tables[0].totals).toEqual({
      supplierName: "Period Total",
      invoiceCount: 0,
      taxableAmount: 0,
      totalTax: 0,
      grandTotal: 0,
    });
  });
});

describe("toPurchaseReturnSummaryExportTable", () => {
  it("maps each row to its export shape, using display labels for refund mode and status", () => {
    const rows = [returnRow()];
    const report = buildPurchaseReturnSummary(rows);

    const tables = toPurchaseReturnSummaryExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Purchase Return Summary");
    expect(tables[0].rows).toEqual([
      {
        returnNumber: "PR-0001",
        sourceInvoiceNumber: "PINV-0001",
        returnDate: new Date("2027-02-10T00:00:00.000Z"),
        supplierName: "Acme Supplies",
        grandTotal: 118,
        refundMode: "Ledger Adjustment",
        status: "Posted",
      },
    ]);
  });

  it("shows a null returnNumber (an unposted draft) as 'Draft'", () => {
    const rows = [returnRow({ returnNumber: null, refundMode: "CASH_REFUND", status: "DRAFT" } as never)];
    const report = buildPurchaseReturnSummary(rows);

    const tables = toPurchaseReturnSummaryExportTable(report);

    expect(tables[0].rows[0]).toMatchObject({ returnNumber: "Draft", refundMode: "Cash Refund", status: "Draft" });
  });

  it("copies totalGrandTotal straight from report.totalGrandTotal, never re-summing", () => {
    const rows = [
      returnRow(),
      returnRow({ id: "ret-2", grandTotal: 236, purchaseInvoice: { id: "inv-2", invoiceNumber: "PINV-0002", invoiceDate: new Date(), supplierId: "supp-2", supplierName: "Other Supplies" } as never }),
    ];
    const report = buildPurchaseReturnSummary(rows);

    const tables = toPurchaseReturnSummaryExportTable(report);

    expect(tables[0].totals).toEqual({
      returnNumber: "Period Total",
      sourceInvoiceNumber: null,
      returnDate: null,
      supplierName: null,
      grandTotal: report.totalGrandTotal,
      refundMode: null,
      status: null,
    });
  });

  it("returns a valid, empty sheet with a zero total for an empty report", () => {
    const report = buildPurchaseReturnSummary([]);

    const tables = toPurchaseReturnSummaryExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toEqual([]);
    expect(tables[0].totals?.grandTotal).toBe(0);
  });
});
