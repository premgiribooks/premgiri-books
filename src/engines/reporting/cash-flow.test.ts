import { describe, expect, it } from "vitest";
import type { LedgerGroup } from "@prisma/client";

import { buildCashFlowReport } from "@/engines/reporting/cash-flow";
import type { CashLedgerMovement, CategorizableEntry } from "@/engines/reporting/types";

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

function entry(overrides: Partial<CategorizableEntry> & Pick<CategorizableEntry, "ledgerGroupId" | "entryType" | "amount">): CategorizableEntry {
  return { ...overrides };
}

describe("buildCashFlowReport", () => {
  it("sums Operating + Investing + Financing to exactly netChangeInCash across a fixture spanning a Payment Voucher, a Receipt Voucher, a self-cancelling Contra Voucher, a Fixed Assets purchase, a Capital introduction, and a Sales Invoice settled partly by cash", () => {
    const indirectExpenses = group({ id: "indirect-expenses", name: "Indirect Expenses", natureType: "EXPENSE" });
    const sundryDebtors = group({ id: "sundry-debtors", name: "Sundry Debtors", natureType: "ASSET" });
    const salesAccounts = group({ id: "sales", name: "Sales Accounts", natureType: "INCOME" });
    const fixedAssets = group({ id: "fixed-assets", name: "Fixed Assets", natureType: "ASSET" });
    const capitalAccount = group({ id: "capital", name: "Capital Account", natureType: "LIABILITY" });

    // Cash net change: Payment (-500) + Receipt (+300) + Contra cash leg
    // (-400) + Fixed Assets purchase (-1000) + Capital introduction (+2000)
    // + Sales Invoice cash line (+200) = 600.
    // Bank net change: Contra bank leg (+400).
    const cashLedgerMovements: CashLedgerMovement[] = [
      { ledgerId: "cash", netChange: -500 + 300 - 400 - 1000 + 2000 + 200 },
      { ledgerId: "bank", netChange: 400 },
    ];

    const categorizableEntries: CategorizableEntry[] = [
      // Payment Voucher: Cash -> Expense (Operating).
      entry({ ledgerGroupId: "indirect-expenses", entryType: "DEBIT", amount: 500 }),
      // Receipt Voucher: Cash <- Sundry Debtor (Operating).
      entry({ ledgerGroupId: "sundry-debtors", entryType: "CREDIT", amount: 300 }),
      // Contra Voucher (Cash <-> Bank) has no non-cash entry at all — nothing added here.
      // Fixed Assets purchase paid by cash (Investing).
      entry({ ledgerGroupId: "fixed-assets", entryType: "DEBIT", amount: 1000 }),
      // Capital introduction (Financing).
      entry({ ledgerGroupId: "capital", entryType: "CREDIT", amount: 2000 }),
      // Sales Invoice settled partly by an immediate cash line: Debtor (800) + Sales (1000), net Operating +200.
      entry({ ledgerGroupId: "sundry-debtors", entryType: "DEBIT", amount: 800 }),
      entry({ ledgerGroupId: "sales", entryType: "CREDIT", amount: 1000 }),
    ];

    const report = buildCashFlowReport(cashLedgerMovements, categorizableEntries, [
      indirectExpenses,
      sundryDebtors,
      salesAccounts,
      fixedAssets,
      capitalAccount,
    ]);

    expect(report.netChangeInCash).toBe(1000);
    expect(report.operating).toBe(0);
    expect(report.investing).toBe(-1000);
    expect(report.financing).toBe(2000);
    expect(round(report.operating + report.investing + report.financing)).toBe(report.netChangeInCash);
    expect(report.reconciles).toBe(true);
  });

  it("a Contra Voucher (Cash <-> Bank) contributes to no category and to no net change", () => {
    const cashLedgerMovements: CashLedgerMovement[] = [
      { ledgerId: "cash", netChange: -400 },
      { ledgerId: "bank", netChange: 400 },
    ];

    const report = buildCashFlowReport(cashLedgerMovements, [], []);

    expect(report.netChangeInCash).toBe(0);
    expect(report.operating).toBe(0);
    expect(report.investing).toBe(0);
    expect(report.financing).toBe(0);
    expect(report.reconciles).toBe(true);
  });

  it("classifies a Fixed Assets purchase paid by cash as Investing", () => {
    const fixedAssets = group({ id: "fixed-assets", name: "Fixed Assets", natureType: "ASSET" });
    const cashLedgerMovements: CashLedgerMovement[] = [{ ledgerId: "cash", netChange: -1000 }];
    const categorizableEntries: CategorizableEntry[] = [entry({ ledgerGroupId: "fixed-assets", entryType: "DEBIT", amount: 1000 })];

    const report = buildCashFlowReport(cashLedgerMovements, categorizableEntries, [fixedAssets]);

    expect(report.investing).toBe(-1000);
    expect(report.operating).toBe(0);
    expect(report.financing).toBe(0);
  });

  it("classifies a Capital introduction as Financing", () => {
    const capitalAccount = group({ id: "capital", name: "Capital Account", natureType: "LIABILITY" });
    const cashLedgerMovements: CashLedgerMovement[] = [{ ledgerId: "cash", netChange: 2000 }];
    const categorizableEntries: CategorizableEntry[] = [entry({ ledgerGroupId: "capital", entryType: "CREDIT", amount: 2000 })];

    const report = buildCashFlowReport(cashLedgerMovements, categorizableEntries, [capitalAccount]);

    expect(report.financing).toBe(2000);
    expect(report.operating).toBe(0);
    expect(report.investing).toBe(0);
  });

  it("resolves a 3+-level-deep counter-ledger to its Operating root group (Current Liabilities -> Sundry Creditors)", () => {
    const currentLiabilities = group({ id: "current-liabilities", name: "Current Liabilities", natureType: "LIABILITY" });
    const sundryCreditors = group({
      id: "sundry-creditors",
      name: "Sundry Creditors",
      natureType: "LIABILITY",
      parentGroupId: "current-liabilities",
    });
    const cashLedgerMovements: CashLedgerMovement[] = [{ ledgerId: "cash", netChange: -700 }];
    const categorizableEntries: CategorizableEntry[] = [entry({ ledgerGroupId: "sundry-creditors", entryType: "DEBIT", amount: 700 })];

    const report = buildCashFlowReport(cashLedgerMovements, categorizableEntries, [currentLiabilities, sundryCreditors]);

    expect(report.operating).toBe(-700);
    expect(report.investing).toBe(0);
    expect(report.financing).toBe(0);
  });

  it("flags reconciles false when the categorized totals genuinely disagree with the headline net change", () => {
    // Deliberately corrupted fixture: a categorizable entry with no matching
    // cash-side movement, confirming `reconciles` is a real computed check.
    const indirectExpenses = group({ id: "indirect-expenses", name: "Indirect Expenses", natureType: "EXPENSE" });
    const cashLedgerMovements: CashLedgerMovement[] = [{ ledgerId: "cash", netChange: 0 }];
    const categorizableEntries: CategorizableEntry[] = [entry({ ledgerGroupId: "indirect-expenses", entryType: "DEBIT", amount: 500 })];

    const report = buildCashFlowReport(cashLedgerMovements, categorizableEntries, [indirectExpenses]);

    expect(report.reconciles).toBe(false);
  });
});

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
