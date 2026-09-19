import { describe, expect, it } from "vitest";

import {
  buildSupplierDirectory,
  buildSupplierOutstandingReport,
  buildSupplierPurchaseSummary,
  buildSupplierStatement,
  toSupplierDirectoryExportTable,
  toSupplierOutstandingExportTable,
  toSupplierPurchaseSummaryExportTable,
  toSupplierStatementExportTable,
} from "@/engines/reporting/supplier-reports";
import type { LedgerStatementResult, TrialBalanceResult } from "@/engines/voucher/types";
import type { PartyWisePurchaseAggregateRow } from "@/types/purchase-invoice";
import type { PartyWisePurchaseReport } from "@/types/purchase-report";
import type {
  SupplierDirectoryReport,
  SupplierOutstandingReport,
  SupplierReportRow,
  SupplierStatementReport,
} from "@/types/supplier-report";

function supplierRow(overrides: Partial<SupplierReportRow> = {}): SupplierReportRow {
  return {
    id: "supp-1",
    displayName: "Acme Wholesale",
    mobileNumber: "9876543210",
    gstin: null,
    city: "Pune",
    state: "Maharashtra",
    isActive: true,
    ledgerId: "ledger-1",
    creditDays: 30,
    openingBalance: 0,
    openingBalanceType: "DEBIT",
    ...overrides,
  };
}

describe("buildSupplierOutstandingReport", () => {
  it("joins each supplier to getTrialBalance's own row by ledgerId", () => {
    const trialBalance: TrialBalanceResult = {
      rows: [
        {
          ledgerId: "ledger-1",
          ledgerName: "Acme Wholesale",
          ledgerGroupId: "grp-1",
          openingBalance: 0,
          openingBalanceType: "DEBIT",
          totalDebit: 2000,
          totalCredit: 5000,
          closingBalance: -3000,
        },
      ],
      totalDebit: 0,
      totalCredit: 3000,
    };

    const report = buildSupplierOutstandingReport(trialBalance, [supplierRow()]);
    expect(report.rows).toEqual([
      {
        supplierId: "supp-1",
        supplierName: "Acme Wholesale",
        outstandingBalance: -3000,
        creditDays: 30,
      },
    ]);
  });

  it("falls back to the supplier's own signed opening balance when its ledger has no matching trial balance row", () => {
    const trialBalance: TrialBalanceResult = { rows: [], totalDebit: 0, totalCredit: 0 };

    const debitRow = buildSupplierOutstandingReport(trialBalance, [
      supplierRow({ openingBalance: 500, openingBalanceType: "DEBIT" }),
    ]);
    expect(debitRow.rows[0].outstandingBalance).toBe(500);

    const creditRow = buildSupplierOutstandingReport(trialBalance, [
      supplierRow({ openingBalance: 500, openingBalanceType: "CREDIT" }),
    ]);
    expect(creditRow.rows[0].outstandingBalance).toBe(-500);
  });

  it("carries creditDays through as informational-only, never a comparison flag", () => {
    const trialBalance: TrialBalanceResult = { rows: [], totalDebit: 0, totalCredit: 0 };
    const report = buildSupplierOutstandingReport(trialBalance, [supplierRow({ creditDays: null })]);
    expect(report.rows[0].creditDays).toBeNull();
    expect(report.rows[0]).not.toHaveProperty("isOverLimit");
    expect(report.rows[0]).not.toHaveProperty("creditLimit");
  });
});

describe("buildSupplierStatement", () => {
  it("maps getLedgerStatement's own lines into separate Debit/Credit columns, humanizing the voucher type", () => {
    const statement: LedgerStatementResult = {
      ledgerId: "ledger-1",
      openingBalance: 1000,
      lines: [
        {
          voucherId: "v1",
          voucherNumber: "PL-0001",
          voucherType: "PURCHASE",
          voucherDate: new Date("2026-04-05T00:00:00.000Z"),
          narration: "Invoice INV-0001",
          entryType: "CREDIT",
          amount: 500,
          runningBalance: 500,
        },
        {
          voucherId: "v2",
          voucherNumber: "PV-0001",
          voucherType: "PAYMENT",
          voucherDate: new Date("2026-04-10T00:00:00.000Z"),
          narration: null,
          entryType: "DEBIT",
          amount: 300,
          runningBalance: 800,
        },
      ],
      closingBalance: 800,
    };

    const report = buildSupplierStatement({ id: "supp-1", displayName: "Acme Wholesale" }, statement);
    expect(report.supplierId).toBe("supp-1");
    expect(report.openingBalance).toBe(1000);
    expect(report.closingBalance).toBe(800);
    expect(report.lines).toEqual([
      {
        voucherId: "v1",
        voucherNumber: "PL-0001",
        voucherType: "PURCHASE",
        voucherTypeLabel: "Purchase Voucher",
        voucherDate: new Date("2026-04-05T00:00:00.000Z"),
        narration: "Invoice INV-0001",
        debit: 0,
        credit: 500,
        runningBalance: 500,
      },
      {
        voucherId: "v2",
        voucherNumber: "PV-0001",
        voucherType: "PAYMENT",
        voucherTypeLabel: "Payment Voucher",
        voucherDate: new Date("2026-04-10T00:00:00.000Z"),
        narration: null,
        debit: 300,
        credit: 0,
        runningBalance: 800,
      },
    ]);
  });
});

describe("buildSupplierPurchaseSummary", () => {
  function aggregateRow(overrides: Partial<PartyWisePurchaseAggregateRow> = {}): PartyWisePurchaseAggregateRow {
    return {
      supplierId: "supp-1",
      supplierName: "Acme Wholesale",
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

  it("passes purchaseInvoiceService.getPartyWisePurchaseReport's own rows through unmodified, no synthetic-bucket filtering", () => {
    const report = buildSupplierPurchaseSummary([aggregateRow(), aggregateRow({ supplierId: "supp-2", supplierName: "Beta Traders" })]);
    expect(report.rows).toHaveLength(2);
    expect(report.rows[0]).toEqual({
      supplierId: "supp-1",
      supplierName: "Acme Wholesale",
      invoiceCount: 2,
      taxableAmount: 1000,
      totalTax: 180,
      grandTotal: 1180,
    });
    expect(report.totals.invoiceCount).toBe(4);
  });
});

describe("buildSupplierDirectory", () => {
  it("presents each supplier row's own display fields", () => {
    const report = buildSupplierDirectory([supplierRow(), supplierRow({ id: "supp-2", displayName: "Beta Traders" })]);
    expect(report.rows).toEqual([
      {
        id: "supp-1",
        displayName: "Acme Wholesale",
        mobileNumber: "9876543210",
        gstin: null,
        city: "Pune",
        state: "Maharashtra",
        creditDays: 30,
        isActive: true,
      },
      {
        id: "supp-2",
        displayName: "Beta Traders",
        mobileNumber: "9876543210",
        gstin: null,
        city: "Pune",
        state: "Maharashtra",
        creditDays: 30,
        isActive: true,
      },
    ]);
  });
});

describe("toSupplierStatementExportTable", () => {
  function statementReport(overrides: Partial<SupplierStatementReport> = {}): SupplierStatementReport {
    return {
      supplierId: "supp-1",
      supplierName: "Acme Wholesale",
      openingBalance: 1000,
      lines: [
        {
          voucherId: "v1",
          voucherNumber: "PL-0001",
          voucherType: "PURCHASE",
          voucherTypeLabel: "Purchase Voucher",
          voucherDate: new Date("2026-04-05T00:00:00.000Z"),
          narration: "Invoice INV-0001",
          debit: 0,
          credit: 500,
          runningBalance: 500,
        },
        {
          voucherId: "v2",
          voucherNumber: "PV-0001",
          voucherType: "PAYMENT",
          voucherTypeLabel: "Payment Voucher",
          voucherDate: new Date("2026-04-10T00:00:00.000Z"),
          narration: null,
          debit: 300,
          credit: 0,
          runningBalance: 800,
        },
      ],
      closingBalance: 800,
      ...overrides,
    };
  }

  it("prepends an Opening Balance row carrying the report's own openingBalance", () => {
    const tables = toSupplierStatementExportTable(statementReport());

    expect(tables[0].rows[0]).toEqual({
      date: null,
      voucherType: "",
      voucherNumber: "",
      narration: "Opening Balance",
      debit: null,
      credit: null,
      runningBalance: 1000,
    });
  });

  it("maps one row per statement line, with correct Debit/Credit/Running Balance values", () => {
    const tables = toSupplierStatementExportTable(statementReport());

    expect(tables[0].rows.slice(1)).toEqual([
      {
        date: new Date("2026-04-05T00:00:00.000Z"),
        voucherType: "Purchase Voucher",
        voucherNumber: "PL-0001",
        narration: "Invoice INV-0001",
        debit: 0,
        credit: 500,
        runningBalance: 500,
      },
      {
        date: new Date("2026-04-10T00:00:00.000Z"),
        voucherType: "Payment Voucher",
        voucherNumber: "PV-0001",
        narration: "",
        debit: 300,
        credit: 0,
        runningBalance: 800,
      },
    ]);
  });

  it("carries the Closing Balance totals footer straight from the report, never re-summed", () => {
    // Deliberately mismatched with the lines' own running balance, mirroring
    // trial-balance.test.ts's own "never recomputes" precedent.
    const tables = toSupplierStatementExportTable(statementReport({ closingBalance: 999 }));

    expect(tables[0].totals).toEqual({
      date: null,
      voucherType: "",
      voucherNumber: "",
      narration: "Closing Balance",
      debit: null,
      credit: null,
      runningBalance: 999,
    });
  });

  it("sets the sheet's title to the supplier's own name", () => {
    const tables = toSupplierStatementExportTable(statementReport({ supplierName: "Beta Traders" }));

    expect(tables[0].sheetName).toBe("Supplier Statement");
    expect(tables[0].title).toBe("Beta Traders");
  });
});

describe("toSupplierOutstandingExportTable", () => {
  function outstandingReport(overrides: Partial<SupplierOutstandingReport> = {}): SupplierOutstandingReport {
    return {
      rows: [
        { supplierId: "supp-1", supplierName: "Acme Wholesale", outstandingBalance: -3000, creditDays: 30 },
        { supplierId: "supp-2", supplierName: "Beta Traders", outstandingBalance: 500, creditDays: null },
      ],
      ...overrides,
    };
  }

  it("mirrors SupplierOutstandingTable's own column set exactly, with no totals footer", () => {
    const tables = toSupplierOutstandingExportTable(outstandingReport());

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Supplier Outstanding");
    expect(tables[0].columns).toEqual([
      { key: "supplierName", header: "Supplier", type: "string" },
      { key: "outstandingBalance", header: "Outstanding Balance", type: "currency" },
      { key: "creditDays", header: "Credit Days", type: "number" },
    ]);
    expect(tables[0].rows).toEqual([
      { supplierName: "Acme Wholesale", outstandingBalance: -3000, creditDays: 30 },
      { supplierName: "Beta Traders", outstandingBalance: 500, creditDays: null },
    ]);
    expect(tables[0].totals).toBeUndefined();
  });

  it("returns an empty rows array for an empty report", () => {
    const tables = toSupplierOutstandingExportTable(outstandingReport({ rows: [] }));
    expect(tables[0].rows).toEqual([]);
  });
});

describe("toSupplierDirectoryExportTable", () => {
  function directoryReport(overrides: Partial<SupplierDirectoryReport> = {}): SupplierDirectoryReport {
    return {
      rows: [
        {
          id: "supp-1",
          displayName: "Acme Wholesale",
          mobileNumber: "9876543210",
          gstin: "27AAAAA0000A1Z5",
          city: "Pune",
          state: "Maharashtra",
          creditDays: 30,
          isActive: true,
        },
        {
          id: "supp-2",
          displayName: "Beta Traders",
          mobileNumber: null,
          gstin: null,
          city: null,
          state: null,
          creditDays: null,
          isActive: false,
        },
      ],
      ...overrides,
    };
  }

  it("mirrors SupplierDirectoryTable's own column set exactly, combining City/State and labeling status", () => {
    const tables = toSupplierDirectoryExportTable(directoryReport());

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Supplier Directory");
    expect(tables[0].columns).toEqual([
      { key: "displayName", header: "Name", type: "string" },
      { key: "mobileNumber", header: "Mobile", type: "string" },
      { key: "gstin", header: "GSTIN", type: "string" },
      { key: "creditDays", header: "Credit Days", type: "number" },
      { key: "cityState", header: "City / State", type: "string" },
      { key: "status", header: "Status", type: "string" },
    ]);
    expect(tables[0].rows).toEqual([
      {
        displayName: "Acme Wholesale",
        mobileNumber: "9876543210",
        gstin: "27AAAAA0000A1Z5",
        creditDays: 30,
        cityState: "Pune, Maharashtra",
        status: "Active",
      },
      {
        displayName: "Beta Traders",
        mobileNumber: "",
        gstin: "",
        creditDays: null,
        cityState: "",
        status: "Inactive",
      },
    ]);
    expect(tables[0].totals).toBeUndefined();
  });
});

describe("toSupplierPurchaseSummaryExportTable", () => {
  function purchaseSummaryReport(overrides: Partial<PartyWisePurchaseReport> = {}): PartyWisePurchaseReport {
    return {
      rows: [
        { supplierId: "supp-1", supplierName: "Acme Wholesale", invoiceCount: 2, taxableAmount: 1000, totalTax: 180, grandTotal: 1180 },
        { supplierId: "supp-2", supplierName: "Beta Traders", invoiceCount: 1, taxableAmount: 500, totalTax: 90, grandTotal: 590 },
      ],
      totals: { invoiceCount: 3, taxableAmount: 1500, totalTax: 270, grandTotal: 1770 },
      ...overrides,
    };
  }

  it("mirrors PartyWisePurchaseTable's own column set exactly", () => {
    const tables = toSupplierPurchaseSummaryExportTable(purchaseSummaryReport());

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Supplier Purchase Summary");
    expect(tables[0].columns).toEqual([
      { key: "supplierName", header: "Supplier", type: "string" },
      { key: "invoiceCount", header: "Invoice Count", type: "number" },
      { key: "taxableAmount", header: "Taxable Value", type: "currency" },
      { key: "totalTax", header: "Total Tax", type: "currency" },
      { key: "grandTotal", header: "Grand Total", type: "currency" },
    ]);
    expect(tables[0].rows).toEqual([
      { supplierName: "Acme Wholesale", invoiceCount: 2, taxableAmount: 1000, totalTax: 180, grandTotal: 1180 },
      { supplierName: "Beta Traders", invoiceCount: 1, taxableAmount: 500, totalTax: 90, grandTotal: 590 },
    ]);
  });

  it("carries the totals footer straight from report.totals, never re-summed", () => {
    // Deliberately mismatched with the rows' own sum, mirroring
    // trial-balance.test.ts's own "never recomputes" precedent.
    const tables = toSupplierPurchaseSummaryExportTable(
      purchaseSummaryReport({ totals: { invoiceCount: 99, taxableAmount: 99, totalTax: 99, grandTotal: 99 } })
    );

    expect(tables[0].totals).toEqual({
      supplierName: "Period Total",
      invoiceCount: 99,
      taxableAmount: 99,
      totalTax: 99,
      grandTotal: 99,
    });
  });
});
