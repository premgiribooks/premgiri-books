import { describe, expect, it } from "vitest";
import type { LedgerGroup } from "@prisma/client";

import { buildLiabilitySettlementReport } from "@/engines/reporting/liability-settlement";
import type { TrialBalanceResult, TrialBalanceRow } from "@/engines/voucher/types";

function group(overrides: Partial<LedgerGroup> & Pick<LedgerGroup, "id" | "name">): LedgerGroup {
  return {
    companyId: "company-1",
    parentGroupId: null,
    natureType: "ASSET",
    affectsGrossProfit: false,
    isSystemDefined: false,
    isActive: true,
    remarks: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function row(overrides: Partial<TrialBalanceRow> & Pick<TrialBalanceRow, "ledgerId" | "ledgerName" | "ledgerGroupId">): TrialBalanceRow {
  return {
    openingBalance: 0,
    openingBalanceType: "DEBIT",
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    ...overrides,
  };
}

function result(rows: TrialBalanceRow[]): TrialBalanceResult {
  return { rows, totalDebit: 0, totalCredit: 0 };
}

describe("buildLiabilitySettlementReport", () => {
  it("includes only LIABILITY-nature ledgers with a positive flipped balance", () => {
    const suppliers = group({ id: "suppliers", name: "Sundry Creditors", natureType: "LIABILITY" });
    const capital = group({ id: "capital", name: "Capital Account", natureType: "LIABILITY" });
    const cash = group({ id: "cash", name: "Cash-in-Hand", natureType: "ASSET" });
    const income = group({ id: "income", name: "Sales Accounts", natureType: "INCOME" });
    const expense = group({ id: "expense", name: "Rent", natureType: "EXPENSE" });

    const rows = [
      // Liability with an outstanding balance (credit-natured -> negative closingBalance): included
      row({ ledgerId: "l1", ledgerName: "ABC Traders", ledgerGroupId: "suppliers", closingBalance: -500 }),
      // Liability with a zero flipped balance: excluded
      row({ ledgerId: "l2", ledgerName: "XYZ Suppliers", ledgerGroupId: "suppliers", closingBalance: 0 }),
      // Liability with a debit (overpaid) balance -> negative flipped amount: excluded
      row({ ledgerId: "l3", ledgerName: "Overpaid Supplier", ledgerGroupId: "suppliers", closingBalance: 200 }),
      // Different liability group, also outstanding: included
      row({ ledgerId: "l4", ledgerName: "Term Loan", ledgerGroupId: "capital", closingBalance: -10000 }),
      // Non-liability natures: excluded regardless of sign
      row({ ledgerId: "l5", ledgerName: "Cash", ledgerGroupId: "cash", closingBalance: 300 }),
      row({ ledgerId: "l6", ledgerName: "Sales", ledgerGroupId: "income", closingBalance: -900 }),
      row({ ledgerId: "l7", ledgerName: "Rent Expense", ledgerGroupId: "expense", closingBalance: 150 }),
    ];

    const report = buildLiabilitySettlementReport(result(rows), [suppliers, capital, cash, income, expense]);

    expect(report.rows.map((r) => r.ledgerId)).toEqual(["l4", "l1"]);
    expect(report.rows.find((r) => r.ledgerId === "l1")?.outstandingAmount).toBe(500);
    expect(report.rows.find((r) => r.ledgerId === "l4")?.outstandingAmount).toBe(10000);
  });

  it("sorts by Ledger Group name, then Ledger Name", () => {
    const suppliers = group({ id: "suppliers", name: "Sundry Creditors", natureType: "LIABILITY" });
    const loans = group({ id: "loans", name: "Loans (Liability)", natureType: "LIABILITY" });

    const rows = [
      row({ ledgerId: "l1", ledgerName: "Zenith Supplies", ledgerGroupId: "suppliers", closingBalance: -100 }),
      row({ ledgerId: "l2", ledgerName: "Alpha Traders", ledgerGroupId: "suppliers", closingBalance: -200 }),
      row({ ledgerId: "l3", ledgerName: "Car Loan", ledgerGroupId: "loans", closingBalance: -300 }),
    ];

    const report = buildLiabilitySettlementReport(result(rows), [suppliers, loans]);

    expect(report.rows.map((r) => r.ledgerId)).toEqual(["l3", "l2", "l1"]);
  });

  it("computes the grand total as the sum of every included row's outstandingAmount", () => {
    const suppliers = group({ id: "suppliers", name: "Sundry Creditors", natureType: "LIABILITY" });

    const rows = [
      row({ ledgerId: "l1", ledgerName: "A", ledgerGroupId: "suppliers", closingBalance: -100 }),
      row({ ledgerId: "l2", ledgerName: "B", ledgerGroupId: "suppliers", closingBalance: -250.5 }),
    ];

    const report = buildLiabilitySettlementReport(result(rows), [suppliers]);

    expect(report.totalOutstanding).toBe(350.5);
  });

  it("returns an empty report when no liability ledger has an outstanding balance", () => {
    const suppliers = group({ id: "suppliers", name: "Sundry Creditors", natureType: "LIABILITY" });
    const rows = [row({ ledgerId: "l1", ledgerName: "A", ledgerGroupId: "suppliers", closingBalance: 0 })];

    const report = buildLiabilitySettlementReport(result(rows), [suppliers]);

    expect(report.rows).toEqual([]);
    expect(report.totalOutstanding).toBe(0);
  });

  it("excludes a row whose ledgerGroupId does not resolve to any known group", () => {
    const rows = [row({ ledgerId: "l1", ledgerName: "Orphan", ledgerGroupId: "missing-group", closingBalance: -100 })];

    const report = buildLiabilitySettlementReport(result(rows), []);

    expect(report.rows).toEqual([]);
  });
});
