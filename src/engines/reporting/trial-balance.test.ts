import { describe, expect, it } from "vitest";
import type { LedgerGroup } from "@prisma/client";

import { buildTrialBalanceReport } from "@/engines/reporting/trial-balance";
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

describe("buildTrialBalanceReport", () => {
  it("rolls up a parent's subtotal from its own ledgers plus every descendant group's subtotal", () => {
    const root = group({ id: "root", name: "Fixed Assets", natureType: "ASSET" });
    const child = group({ id: "child", name: "Plant & Machinery", parentGroupId: "root", natureType: "ASSET" });
    const grandchild = group({
      id: "grandchild",
      name: "Machinery - Unit A",
      parentGroupId: "child",
      natureType: "ASSET",
    });

    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Land", ledgerGroupId: "root", closingBalance: 100 }),
      row({ ledgerId: "l2", ledgerName: "Furniture", ledgerGroupId: "child", closingBalance: 50 }),
      row({ ledgerId: "l3", ledgerName: "Lathe Machine", ledgerGroupId: "grandchild", closingBalance: 25 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 175, totalCredit: 0 };

    const report = buildTrialBalanceReport(result, [root, child, grandchild]);

    expect(report.sections).toHaveLength(1);
    const rootSection = report.sections[0];
    expect(rootSection.groupId).toBe("root");
    expect(rootSection.subtotalDebit).toBe(175);
    expect(rootSection.childSections).toHaveLength(1);

    const childSection = rootSection.childSections[0];
    expect(childSection.groupId).toBe("child");
    expect(childSection.subtotalDebit).toBe(75);
    expect(childSection.childSections[0].subtotalDebit).toBe(25);
  });

  it("never recomputes the grand total — it is copied straight from the input TrialBalanceResult", () => {
    const root = group({ id: "root", name: "Fixed Assets" });
    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Land", ledgerGroupId: "root", closingBalance: 100 }),
    ];
    // Deliberately mismatched totals — the report must reflect these exactly, not the row sum.
    const result: TrialBalanceResult = { rows, totalDebit: 999, totalCredit: 111 };

    const report = buildTrialBalanceReport(result, [root]);

    expect(report.totalDebit).toBe(999);
    expect(report.totalCredit).toBe(111);
  });

  it("omits a group with no ledgers anywhere in its own subtree", () => {
    const populated = group({ id: "populated", name: "Current Assets" });
    const empty = group({ id: "empty", name: "Investments" });
    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Cash", ledgerGroupId: "populated", closingBalance: 10 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 10, totalCredit: 0 };

    const report = buildTrialBalanceReport(result, [populated, empty]);

    expect(report.sections.map((section) => section.groupId)).toEqual(["populated"]);
  });

  it("includes a group with at least one zero-activity ledger, with a correct zero subtotal", () => {
    const populated = group({ id: "populated", name: "Current Assets" });
    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Dormant Ledger", ledgerGroupId: "populated", closingBalance: 0 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 0, totalCredit: 0 };

    const report = buildTrialBalanceReport(result, [populated]);

    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].subtotalDebit).toBe(0);
    expect(report.sections[0].subtotalCredit).toBe(0);
    expect(report.sections[0].rows).toHaveLength(1);
  });

  it("splits a group's own rows into Debit/Credit by the debit-positive closingBalance sign", () => {
    const root = group({ id: "root", name: "Loans" });
    const rows: TrialBalanceRow[] = [
      row({ ledgerId: "l1", ledgerName: "Receivable", ledgerGroupId: "root", closingBalance: 40 }),
      row({ ledgerId: "l2", ledgerName: "Payable", ledgerGroupId: "root", closingBalance: -30 }),
    ];
    const result: TrialBalanceResult = { rows, totalDebit: 40, totalCredit: 30 };

    const report = buildTrialBalanceReport(result, [root]);

    expect(report.sections[0].subtotalDebit).toBe(40);
    expect(report.sections[0].subtotalCredit).toBe(30);
  });
});
