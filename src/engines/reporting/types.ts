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
