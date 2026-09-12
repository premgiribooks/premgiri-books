import type { AccountNature, LedgerGroup } from "@prisma/client";

import type { TrialBalanceRow } from "@/engines/voucher/types";

export type { AccountNature, LedgerGroup };

/** One company-scoped LedgerGroup plus its direct child ids, keyed by group id. */
export interface LedgerGroupIndexEntry {
  group: LedgerGroup;
  children: string[];
}

/** Built once per report call by buildLedgerGroupIndex, reused by every
 * grouping/rollup function in this batch (64-67). */
export type LedgerGroupIndex = Map<string, LedgerGroupIndexEntry>;

export interface TrialBalanceSection {
  groupId: string;
  groupName: string;
  natureType: AccountNature;
  depth: number;
  rows: TrialBalanceRow[];
  subtotalDebit: number;
  subtotalCredit: number;
  childSections: TrialBalanceSection[];
}

export interface TrialBalanceReport {
  sections: TrialBalanceSection[];
  /** Copied straight from voucherEngine.getTrialBalance's own result — never recomputed. */
  totalDebit: number;
  totalCredit: number;
}

/** One ledger's diffed period movement — see profit-and-loss.ts for how this is derived from two getTrialBalance calls. */
export interface ProfitAndLossLedgerMovement {
  ledgerId: string;
  ledgerName: string;
  ledgerGroupId: string;
  periodDebit: number;
  periodCredit: number;
}

export interface ProfitAndLossRow {
  ledgerId: string;
  ledgerName: string;
  /** Presentation value for the period, sign per natural-balance convention — may be negative. */
  value: number;
}

export interface ProfitAndLossSection {
  groupId: string;
  groupName: string;
  depth: number;
  rows: ProfitAndLossRow[];
  subtotal: number;
  childSections: ProfitAndLossSection[];
}

export interface ProfitAndLossReport {
  directIncome: ProfitAndLossSection[];
  directExpense: ProfitAndLossSection[];
  indirectIncome: ProfitAndLossSection[];
  indirectExpense: ProfitAndLossSection[];
  grossProfit: number;
  netProfit: number;
}

export interface BalanceSheetRow {
  ledgerId: string;
  ledgerName: string;
  /** Presentation value, sign already applied per side (Assets: closingBalance direct; Liabilities: sign-flipped). */
  value: number;
}

export interface BalanceSheetSection {
  groupId: string;
  groupName: string;
  depth: number;
  rows: BalanceSheetRow[];
  subtotal: number;
  childSections: BalanceSheetSection[];
}

export interface BalanceSheetReport {
  assets: BalanceSheetSection[];
  /** Includes the synthetic "Profit & Loss Account (Current Period)" section appended after every real LIABILITY group. */
  liabilities: BalanceSheetSection[];
  totalAssets: number;
  totalLiabilities: number;
  netProfit: number;
  isBalanced: boolean;
}

/** One Cash/Bank ledger's signed period movement (`closingBalance − openingBalance`), from a single getLedgerStatement call. */
export interface CashLedgerMovement {
  ledgerId: string;
  netChange: number;
}

/** One non-cash counter-ledger VoucherEntry belonging to a cash-touching voucher, before categorization. */
export interface CategorizableEntry {
  ledgerGroupId: string;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
}

export interface CashFlowReport {
  /** Σ of every categorized entry's signed amount whose counter-ledger root group is neither Investing- nor Financing-class. */
  operating: number;
  /** Σ of every categorized entry's signed amount whose counter-ledger root group is "Fixed Assets" or "Investments". */
  investing: number;
  /** Σ of every categorized entry's signed amount whose counter-ledger root group is "Capital Account", "Reserves & Surplus", or "Loans (Liability)". */
  financing: number;
  /** Σ of every Cash/Bank ledger's period movement — the headline figure the three categories must sum to. */
  netChangeInCash: number;
  /** `round2(operating + investing + financing) === netChangeInCash` — a genuine computed integrity check, not assumed true. */
  reconciles: boolean;
}
