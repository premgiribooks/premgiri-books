import { describe, expect, it } from "vitest";

import {
  buildCustomerDirectory,
  buildCustomerOutstandingReport,
  buildCustomerSalesSummary,
  buildCustomerStatement,
} from "@/engines/reporting/customer-reports";
import type { LedgerStatementResult, TrialBalanceResult } from "@/engines/voucher/types";
import type { PartyWiseSalesAggregateRow } from "@/types/sales-invoice";
import type { CustomerReportRow } from "@/types/customer-report";

function customerRow(overrides: Partial<CustomerReportRow> = {}): CustomerReportRow {
  return {
    id: "cust-1",
    displayName: "Acme Retail",
    customerType: "RETAIL",
    mobileNumber: "9876543210",
    gstin: null,
    city: "Pune",
    state: "Maharashtra",
    isActive: true,
    ledgerId: "ledger-1",
    creditLimit: null,
    openingBalance: 0,
    openingBalanceType: "DEBIT",
    ...overrides,
  };
}

describe("buildCustomerOutstandingReport", () => {
  it("joins each customer to getTrialBalance's own row by ledgerId", () => {
    const trialBalance: TrialBalanceResult = {
      rows: [
        {
          ledgerId: "ledger-1",
          ledgerName: "Acme Retail",
          ledgerGroupId: "grp-1",
          openingBalance: 0,
          openingBalanceType: "DEBIT",
          totalDebit: 5000,
          totalCredit: 2000,
          closingBalance: 3000,
        },
      ],
      totalDebit: 3000,
      totalCredit: 0,
    };

    const report = buildCustomerOutstandingReport(trialBalance, [customerRow()]);
    expect(report.rows).toEqual([
      {
        customerId: "cust-1",
        customerName: "Acme Retail",
        customerType: "RETAIL",
        outstandingBalance: 3000,
        creditLimit: null,
        isOverLimit: null,
      },
    ]);
  });

  it("falls back to the customer's own signed opening balance when its ledger has no matching trial balance row", () => {
    const trialBalance: TrialBalanceResult = { rows: [], totalDebit: 0, totalCredit: 0 };

    const debitRow = buildCustomerOutstandingReport(trialBalance, [
      customerRow({ openingBalance: 500, openingBalanceType: "DEBIT" }),
    ]);
    expect(debitRow.rows[0].outstandingBalance).toBe(500);

    const creditRow = buildCustomerOutstandingReport(trialBalance, [
      customerRow({ openingBalance: 500, openingBalanceType: "CREDIT" }),
    ]);
    expect(creditRow.rows[0].outstandingBalance).toBe(-500);
  });

  it("flags Over Limit exactly when outstandingBalance exceeds creditLimit, and stays not-applicable (null) when unset", () => {
    const makeTrialBalance = (closingBalance: number): TrialBalanceResult => ({
      rows: [
        {
          ledgerId: "ledger-1",
          ledgerName: "Acme Retail",
          ledgerGroupId: "grp-1",
          openingBalance: 0,
          openingBalanceType: "DEBIT",
          totalDebit: closingBalance,
          totalCredit: 0,
          closingBalance,
        },
      ],
      totalDebit: closingBalance,
      totalCredit: 0,
    });

    const noLimit = buildCustomerOutstandingReport(makeTrialBalance(1000), [customerRow({ creditLimit: null })]);
    expect(noLimit.rows[0].isOverLimit).toBeNull();

    const underLimit = buildCustomerOutstandingReport(makeTrialBalance(1000), [customerRow({ creditLimit: 2000 })]);
    expect(underLimit.rows[0].isOverLimit).toBe(false);

    const atLimit = buildCustomerOutstandingReport(makeTrialBalance(2000), [customerRow({ creditLimit: 2000 })]);
    expect(atLimit.rows[0].isOverLimit).toBe(false);

    const overLimit = buildCustomerOutstandingReport(makeTrialBalance(2500), [customerRow({ creditLimit: 2000 })]);
    expect(overLimit.rows[0].isOverLimit).toBe(true);
  });
});

describe("buildCustomerStatement", () => {
  it("maps getLedgerStatement's own lines into separate Debit/Credit columns, humanizing the voucher type", () => {
    const statement: LedgerStatementResult = {
      ledgerId: "ledger-1",
      openingBalance: 1000,
      lines: [
        {
          voucherId: "v1",
          voucherNumber: "SL-0001",
          voucherType: "SALES",
          voucherDate: new Date("2026-04-05T00:00:00.000Z"),
          narration: "Invoice INV-0001",
          entryType: "DEBIT",
          amount: 500,
          runningBalance: 1500,
        },
        {
          voucherId: "v2",
          voucherNumber: "RV-0001",
          voucherType: "RECEIPT",
          voucherDate: new Date("2026-04-10T00:00:00.000Z"),
          narration: null,
          entryType: "CREDIT",
          amount: 300,
          runningBalance: 1200,
        },
      ],
      closingBalance: 1200,
    };

    const report = buildCustomerStatement({ id: "cust-1", displayName: "Acme Retail" }, statement);
    expect(report.customerId).toBe("cust-1");
    expect(report.openingBalance).toBe(1000);
    expect(report.closingBalance).toBe(1200);
    expect(report.lines).toEqual([
      {
        voucherId: "v1",
        voucherNumber: "SL-0001",
        voucherType: "SALES",
        voucherTypeLabel: "Sales Voucher",
        voucherDate: new Date("2026-04-05T00:00:00.000Z"),
        narration: "Invoice INV-0001",
        debit: 500,
        credit: 0,
        runningBalance: 1500,
      },
      {
        voucherId: "v2",
        voucherNumber: "RV-0001",
        voucherType: "RECEIPT",
        voucherTypeLabel: "Receipt Voucher",
        voucherDate: new Date("2026-04-10T00:00:00.000Z"),
        narration: null,
        debit: 0,
        credit: 300,
        runningBalance: 1200,
      },
    ]);
  });
});

describe("buildCustomerSalesSummary", () => {
  function aggregateRow(overrides: Partial<PartyWiseSalesAggregateRow> = {}): PartyWiseSalesAggregateRow {
    return {
      customerId: "cust-1",
      customerMode: "PERMANENT",
      customerName: "Acme Retail",
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

  it("excludes the Walk-in/Quick-Customer synthetic buckets (customerId null), keeping only real customers", () => {
    const report = buildCustomerSalesSummary([
      aggregateRow(),
      aggregateRow({ customerId: null, customerMode: "WALK_IN", customerName: null }),
      aggregateRow({ customerId: null, customerMode: "QUICK", customerName: null }),
    ]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].customerId).toBe("cust-1");
    expect(report.rows[0].groupType).toBe("CUSTOMER");
  });
});

describe("buildCustomerDirectory", () => {
  it("presents each customer row's own display fields", () => {
    const report = buildCustomerDirectory([customerRow(), customerRow({ id: "cust-2", displayName: "Beta Traders" })]);
    expect(report.rows).toEqual([
      {
        id: "cust-1",
        displayName: "Acme Retail",
        customerType: "RETAIL",
        mobileNumber: "9876543210",
        gstin: null,
        city: "Pune",
        state: "Maharashtra",
        isActive: true,
      },
      {
        id: "cust-2",
        displayName: "Beta Traders",
        customerType: "RETAIL",
        mobileNumber: "9876543210",
        gstin: null,
        city: "Pune",
        state: "Maharashtra",
        isActive: true,
      },
    ]);
  });
});
