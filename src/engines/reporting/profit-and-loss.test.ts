import { describe, expect, it } from "vitest";
import type { LedgerGroup } from "@prisma/client";

import { buildProfitAndLossReport, dayBefore, toProfitAndLossExportTable } from "@/engines/reporting/profit-and-loss";
import type { ProfitAndLossLedgerMovement, ProfitAndLossReport } from "@/engines/reporting/types";

function group(overrides: Partial<LedgerGroup> & Pick<LedgerGroup, "id" | "name" | "natureType" | "affectsGrossProfit">): LedgerGroup {
  return {
    companyId: "company-1",
    parentGroupId: null,
    isSystemDefined: false,
    isActive: true,
    remarks: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function movement(
  overrides: Partial<ProfitAndLossLedgerMovement> & Pick<ProfitAndLossLedgerMovement, "ledgerId" | "ledgerName" | "ledgerGroupId">
): ProfitAndLossLedgerMovement {
  return {
    periodDebit: 0,
    periodCredit: 0,
    ...overrides,
  };
}

describe("dayBefore", () => {
  it("returns the calendar day immediately before the given UTC-midnight date", () => {
    expect(dayBefore(new Date("2026-04-01T00:00:00.000Z")).toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("rolls back across a month boundary", () => {
    expect(dayBefore(new Date("2026-05-01T00:00:00.000Z")).toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });
});

describe("buildProfitAndLossReport", () => {
  it("computes Gross Profit and Net Profit against a fixture spanning Direct and Indirect Income/Expense groups", () => {
    const salesAccounts = group({ id: "sales", name: "Sales Accounts", natureType: "INCOME", affectsGrossProfit: true });
    const purchaseAccounts = group({ id: "purchase", name: "Purchase Accounts", natureType: "EXPENSE", affectsGrossProfit: true });
    const indirectIncomes = group({ id: "ind-inc", name: "Indirect Incomes", natureType: "INCOME", affectsGrossProfit: false });
    const indirectExpenses = group({ id: "ind-exp", name: "Indirect Expenses", natureType: "EXPENSE", affectsGrossProfit: false });

    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Sales", ledgerGroupId: "sales", periodCredit: 10000 }),
      movement({ ledgerId: "l2", ledgerName: "Purchases", ledgerGroupId: "purchase", periodDebit: 6000 }),
      movement({ ledgerId: "l3", ledgerName: "Interest Received", ledgerGroupId: "ind-inc", periodCredit: 500 }),
      movement({ ledgerId: "l4", ledgerName: "Rent", ledgerGroupId: "ind-exp", periodDebit: 1200 }),
    ];

    const report = buildProfitAndLossReport(rows, [salesAccounts, purchaseAccounts, indirectIncomes, indirectExpenses]);

    // Gross Profit = Direct Income (10000) - Direct Expense (6000) = 4000
    expect(report.grossProfit).toBe(4000);
    // Net Profit = Gross Profit (4000) + Indirect Income (500) - Indirect Expense (1200) = 3300
    expect(report.netProfit).toBe(3300);

    expect(report.directIncome).toHaveLength(1);
    expect(report.directIncome[0].subtotal).toBe(10000);
    expect(report.directExpense[0].subtotal).toBe(6000);
    expect(report.indirectIncome[0].subtotal).toBe(500);
    expect(report.indirectExpense[0].subtotal).toBe(1200);
  });

  it("nets a return/reversal within an Income-nature ledger as credit minus debit", () => {
    const salesAccounts = group({ id: "sales", name: "Sales Accounts", natureType: "INCOME", affectsGrossProfit: true });
    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Sales", ledgerGroupId: "sales", periodCredit: 1000, periodDebit: 200 }),
    ];

    const report = buildProfitAndLossReport(rows, [salesAccounts]);

    expect(report.directIncome[0].rows[0].value).toBe(800);
  });

  it("nets a return/reversal within an Expense-nature ledger as debit minus credit", () => {
    const purchaseAccounts = group({ id: "purchase", name: "Purchase Accounts", natureType: "EXPENSE", affectsGrossProfit: true });
    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Purchases", ledgerGroupId: "purchase", periodDebit: 1000, periodCredit: 200 }),
    ];

    const report = buildProfitAndLossReport(rows, [purchaseAccounts]);

    expect(report.directExpense[0].rows[0].value).toBe(800);
  });

  it("displays a negative Expense-ledger period value (more credits than debits) as negative, not clamped to zero", () => {
    const indirectExpenses = group({ id: "ind-exp", name: "Indirect Expenses", natureType: "EXPENSE", affectsGrossProfit: false });
    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Refund Correction", ledgerGroupId: "ind-exp", periodDebit: 100, periodCredit: 400 }),
    ];

    const report = buildProfitAndLossReport(rows, [indirectExpenses]);

    expect(report.indirectExpense[0].rows[0].value).toBe(-300);
    expect(report.indirectExpense[0].subtotal).toBe(-300);
  });

  it("omits a zero-activity group from the rendered report without affecting Gross/Net Profit", () => {
    const salesAccounts = group({ id: "sales", name: "Sales Accounts", natureType: "INCOME", affectsGrossProfit: true });
    const emptyIndirectIncome = group({ id: "ind-inc", name: "Indirect Incomes", natureType: "INCOME", affectsGrossProfit: false });
    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Sales", ledgerGroupId: "sales", periodCredit: 1000 }),
      movement({ ledgerId: "l2", ledgerName: "Dormant Income Ledger", ledgerGroupId: "ind-inc", periodCredit: 0, periodDebit: 0 }),
    ];

    const report = buildProfitAndLossReport(rows, [salesAccounts, emptyIndirectIncome]);

    expect(report.indirectIncome).toHaveLength(0);
    expect(report.grossProfit).toBe(1000);
    expect(report.netProfit).toBe(1000);
  });

  it("rolls up a nested group's subtotal from its own ledgers plus every descendant group within the same bucket", () => {
    const root = group({ id: "root", name: "Direct Incomes", natureType: "INCOME", affectsGrossProfit: true });
    const child = group({ id: "child", name: "Service Income", natureType: "INCOME", affectsGrossProfit: true, parentGroupId: "root" });
    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Consulting", ledgerGroupId: "root", periodCredit: 100 }),
      movement({ ledgerId: "l2", ledgerName: "Installation", ledgerGroupId: "child", periodCredit: 50 }),
    ];

    const report = buildProfitAndLossReport(rows, [root, child]);

    expect(report.directIncome).toHaveLength(1);
    expect(report.directIncome[0].subtotal).toBe(150);
    expect(report.directIncome[0].childSections[0].subtotal).toBe(50);
  });

  it("discards ASSET/LIABILITY-nature groups entirely", () => {
    const cash = group({ id: "cash", name: "Cash-in-Hand", natureType: "ASSET", affectsGrossProfit: false });
    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Cash", ledgerGroupId: "cash", periodDebit: 500 }),
    ];

    const report = buildProfitAndLossReport(rows, [cash]);

    expect(report.directIncome).toHaveLength(0);
    expect(report.directExpense).toHaveLength(0);
    expect(report.indirectIncome).toHaveLength(0);
    expect(report.indirectExpense).toHaveLength(0);
    expect(report.grossProfit).toBe(0);
    expect(report.netProfit).toBe(0);
  });
});

describe("toProfitAndLossExportTable", () => {
  it("builds a Trading Account sheet and a Profit & Loss Account sheet, mirroring the on-screen statement's own layout", () => {
    const salesAccounts = group({ id: "sales", name: "Sales Accounts", natureType: "INCOME", affectsGrossProfit: true });
    const purchaseAccounts = group({ id: "purchase", name: "Purchase Accounts", natureType: "EXPENSE", affectsGrossProfit: true });
    const indirectIncomes = group({ id: "ind-inc", name: "Indirect Incomes", natureType: "INCOME", affectsGrossProfit: false });
    const indirectExpenses = group({ id: "ind-exp", name: "Indirect Expenses", natureType: "EXPENSE", affectsGrossProfit: false });

    const rows: ProfitAndLossLedgerMovement[] = [
      movement({ ledgerId: "l1", ledgerName: "Sales", ledgerGroupId: "sales", periodCredit: 10000 }),
      movement({ ledgerId: "l2", ledgerName: "Purchases", ledgerGroupId: "purchase", periodDebit: 6000 }),
      movement({ ledgerId: "l3", ledgerName: "Interest Received", ledgerGroupId: "ind-inc", periodCredit: 500 }),
      movement({ ledgerId: "l4", ledgerName: "Rent", ledgerGroupId: "ind-exp", periodDebit: 1200 }),
    ];

    const report = buildProfitAndLossReport(rows, [salesAccounts, purchaseAccounts, indirectIncomes, indirectExpenses]);
    const tables = toProfitAndLossExportTable(report);

    expect(tables).toHaveLength(2);

    const tradingAccount = tables[0];
    expect(tradingAccount.sheetName).toBe("Trading Account");
    expect(tradingAccount.rows).toEqual([
      { particulars: "Direct Income", indentLevel: 0, amount: null },
      { particulars: "Sales Accounts", indentLevel: 1, amount: 10000 },
      { particulars: "Sales", indentLevel: 2, amount: 10000 },
      { particulars: "Direct Expense", indentLevel: 0, amount: null },
      { particulars: "Purchase Accounts", indentLevel: 1, amount: 6000 },
      { particulars: "Purchases", indentLevel: 2, amount: 6000 },
    ]);
    expect(tradingAccount.totals).toEqual({ particulars: "Gross Profit", indentLevel: null, amount: 4000 });

    const profitAndLossAccount = tables[1];
    expect(profitAndLossAccount.sheetName).toBe("Profit & Loss Account");
    expect(profitAndLossAccount.rows).toEqual([
      { particulars: "Gross Profit brought forward", indentLevel: 0, amount: 4000 },
      { particulars: "Indirect Income", indentLevel: 0, amount: null },
      { particulars: "Indirect Incomes", indentLevel: 1, amount: 500 },
      { particulars: "Interest Received", indentLevel: 2, amount: 500 },
      { particulars: "Indirect Expense", indentLevel: 0, amount: null },
      { particulars: "Indirect Expenses", indentLevel: 1, amount: 1200 },
      { particulars: "Rent", indentLevel: 2, amount: 1200 },
    ]);
    expect(profitAndLossAccount.totals).toEqual({ particulars: "Net Profit", indentLevel: null, amount: 3300 });
  });

  it("labels the Profit & Loss Account footer 'Net Loss' when netProfit is negative, and omits empty buckets", () => {
    const report: ProfitAndLossReport = {
      directIncome: [],
      directExpense: [],
      indirectIncome: [],
      indirectExpense: [],
      grossProfit: 0,
      netProfit: -500,
    };

    const tables = toProfitAndLossExportTable(report);

    expect(tables[0].rows).toEqual([]);
    expect(tables[1].rows).toEqual([{ particulars: "Gross Profit brought forward", indentLevel: 0, amount: 0 }]);
    expect(tables[1].totals).toEqual({ particulars: "Net Loss", indentLevel: null, amount: -500 });
  });
});
