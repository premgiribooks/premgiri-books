import { describe, expect, it } from "vitest";

import {
  buildSupplierDirectory,
  buildSupplierOutstandingReport,
  buildSupplierPurchaseSummary,
  buildSupplierStatement,
} from "@/engines/reporting/supplier-reports";
import type { LedgerStatementResult, TrialBalanceResult } from "@/engines/voucher/types";
import type { PartyWisePurchaseAggregateRow } from "@/types/purchase-invoice";
import type { SupplierReportRow } from "@/types/supplier-report";

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
