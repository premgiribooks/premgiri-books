import { describe, expect, it } from "vitest";
import type { LedgerGroup } from "@prisma/client";

import { buildBalanceSheetReport } from "@/engines/reporting/balance-sheet";
import type { TrialBalanceResult, TrialBalanceRow } from "@/engines/voucher/types";

function group(overrides: Partial<LedgerGroup> & Pick<LedgerGroup, "id" | "name" | "natureType">): LedgerGroup {
  return {
    companyId: "company-1",
    parentGroupId: null,
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

describe("buildBalanceSheetReport", () => {
  it("balances Assets against Liabilities (raw) plus a profitable Net Profit plug", () => {
    const cash = group({ id: "cash", name: "Cash-in-Hand", natureType: "ASSET" });
    const capital = group({ id: "capital", name: "Capital Account", natureType: "LIABILITY" });
    const loans = group({ id: "loans", name: "Loans (Liability)", natureType: "LIABILITY" });

    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Cash", ledgerGroupId: "cash", closingBalance: 15000 }),
      row({ ledgerId: "l2", ledgerName: "Owner's Capital", ledgerGroupId: "capital", closingBalance: -10000 }),
      row({ ledgerId: "l3", ledgerName: "Bank Loan", ledgerGroupId: "loans", closingBalance: -2000 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 15000, totalCredit: 12000 };

    // Assets (15000) === raw Liabilities (10000 + 2000 = 12000) + Net Profit (3000)
    const report = buildBalanceSheetReport(result, 3000, [cash, capital, loans]);

    expect(report.totalAssets).toBe(15000);
    expect(report.totalLiabilities).toBe(15000);
    expect(report.isBalanced).toBe(true);
    expect(report.netProfit).toBe(3000);
  });

  it("balances Assets against Liabilities (raw) plus a loss-making (negative) Net Profit plug", () => {
    const cash = group({ id: "cash", name: "Cash-in-Hand", natureType: "ASSET" });
    const capital = group({ id: "capital", name: "Capital Account", natureType: "LIABILITY" });

    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Cash", ledgerGroupId: "cash", closingBalance: 7000 }),
      row({ ledgerId: "l2", ledgerName: "Owner's Capital", ledgerGroupId: "capital", closingBalance: -10000 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 7000, totalCredit: 10000 };

    // Assets (7000) === raw Liabilities (10000) + Net Loss (-3000)
    const report = buildBalanceSheetReport(result, -3000, [cash, capital]);

    expect(report.totalAssets).toBe(7000);
    expect(report.totalLiabilities).toBe(7000);
    expect(report.isBalanced).toBe(true);
    expect(report.netProfit).toBe(-3000);
  });

  it("sign-flips a LIABILITY-nature ledger's negative debit-positive closingBalance to a positive displayed value", () => {
    const capital = group({ id: "capital", name: "Capital Account", natureType: "LIABILITY" });
    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Owner's Capital", ledgerGroupId: "capital", closingBalance: -5000 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 0, totalCredit: 5000 };

    const report = buildBalanceSheetReport(result, 0, [capital]);

    const capitalSection = report.liabilities.find((section) => section.groupId === "capital");
    expect(capitalSection?.rows[0].value).toBe(5000);
    expect(capitalSection?.subtotal).toBe(5000);
  });

  it("uses an ASSET-nature ledger's positive debit-positive closingBalance directly, unmodified", () => {
    const cash = group({ id: "cash", name: "Cash-in-Hand", natureType: "ASSET" });
    const rows: TrialBalanceRow[] = [row({ ledgerId: "l1", ledgerName: "Cash", ledgerGroupId: "cash", closingBalance: 4200 })];
    const result: TrialBalanceResult = { rows, totalDebit: 4200, totalCredit: 0 };

    const report = buildBalanceSheetReport(result, 0, [cash]);

    expect(report.assets[0].rows[0].value).toBe(4200);
  });

  it("appends the Net Profit figure as a synthetic Profit & Loss Account (Current Period) section under Liabilities", () => {
    const cash = group({ id: "cash", name: "Cash-in-Hand", natureType: "ASSET" });
    const rows: TrialBalanceRow[] = [row({ ledgerId: "l1", ledgerName: "Cash", ledgerGroupId: "cash", closingBalance: 1000 })];
    const result: TrialBalanceResult = { rows, totalDebit: 1000, totalCredit: 0 };

    const report = buildBalanceSheetReport(result, 1000, [cash]);

    const plugSection = report.liabilities.find((section) => section.groupName === "Profit & Loss Account (Current Period)");
    expect(plugSection).toBeDefined();
    expect(plugSection?.subtotal).toBe(1000);
    expect(report.totalLiabilities).toBe(1000);
  });

  it("flags isBalanced false when Assets and Liabilities (plus the Net Profit plug) genuinely disagree", () => {
    // Deliberately corrupted fixture (not achievable via the real UI): a
    // mismatch between the raw voucher data and the supplied netProfit plug,
    // confirming isBalanced is a real computed check, not a hardcoded true.
    const cash = group({ id: "cash", name: "Cash-in-Hand", natureType: "ASSET" });
    const capital = group({ id: "capital", name: "Capital Account", natureType: "LIABILITY" });
    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Cash", ledgerGroupId: "cash", closingBalance: 5000 }),
      row({ ledgerId: "l2", ledgerName: "Owner's Capital", ledgerGroupId: "capital", closingBalance: -5000 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 5000, totalCredit: 5000 };

    const report = buildBalanceSheetReport(result, 999, [cash, capital]);

    expect(report.isBalanced).toBe(false);
  });

  it("rolls up a nested LIABILITY group's subtotal from its own ledgers plus every descendant group", () => {
    const root = group({ id: "current-liabilities", name: "Current Liabilities", natureType: "LIABILITY" });
    const child = group({
      id: "sundry-creditors",
      name: "Sundry Creditors",
      natureType: "LIABILITY",
      parentGroupId: "current-liabilities",
    });
    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Outstanding Expenses", ledgerGroupId: "current-liabilities", closingBalance: -300 }),
      row({ ledgerId: "l2", ledgerName: "Supplier A", ledgerGroupId: "sundry-creditors", closingBalance: -700 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 0, totalCredit: 1000 };

    const report = buildBalanceSheetReport(result, 0, [root, child]);

    const rootSection = report.liabilities.find((section) => section.groupId === "current-liabilities");
    expect(rootSection?.subtotal).toBe(1000);
    expect(rootSection?.childSections[0].subtotal).toBe(700);
  });

  it("discards INCOME/EXPENSE-nature groups entirely from both sides", () => {
    const sales = group({ id: "sales", name: "Sales Accounts", natureType: "INCOME" });
    const rows: TrialBalanceRow[] = [row({ ledgerId: "l1", ledgerName: "Sales", ledgerGroupId: "sales", closingBalance: -5000 })];
    const result: TrialBalanceResult = { rows, totalDebit: 0, totalCredit: 5000 };

    const report = buildBalanceSheetReport(result, 0, [sales]);

    expect(report.assets).toHaveLength(0);
    // Only the synthetic Profit & Loss plug section remains on the Liabilities side.
    expect(report.liabilities).toHaveLength(1);
    expect(report.liabilities[0].groupName).toBe("Profit & Loss Account (Current Period)");
  });
});
