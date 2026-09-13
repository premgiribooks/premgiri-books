import type { LedgerGroup } from "@prisma/client";

import type { TrialBalanceResult } from "@/engines/voucher/types";
import type { LiabilitySettlementReport, LiabilitySettlementRow } from "@/types/liability-settlement";

// 87-liability-settlement.md's Reporting Engine composition layer — pure
// shaping only, no I/O, no companyId parameter. Filters voucherEngine.
// getTrialBalance's already-computed rows to LIABILITY-nature ledgers with a
// real outstanding balance, exactly mirroring balance-sheet.ts's own
// Liabilities-side sign-flip (`-closingBalance`) rather than re-deriving it.

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Business Rules — a row is included only when its `ledgerGroupId` resolves
 * to a LIABILITY-nature group (66-balance-sheet.md's own precedent: a plain
 * `natureType` read, no subtree walk, since every group row already carries
 * its own `natureType`) and its sign-flipped `closingBalance` is strictly
 * positive (a zero or debit-balance liability ledger has nothing to settle).
 * Sorted by Ledger Group name, then Ledger Name, matching Trial Balance's
 * own group-tree ordering convention.
 */
export function buildLiabilitySettlementReport(
  trialBalance: TrialBalanceResult,
  groups: readonly LedgerGroup[]
): LiabilitySettlementReport {
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const rows: LiabilitySettlementRow[] = [];
  for (const row of trialBalance.rows) {
    const group = groupById.get(row.ledgerGroupId);
    if (!group || group.natureType !== "LIABILITY") {
      continue;
    }

    const outstandingAmount = round2(-row.closingBalance);
    if (outstandingAmount <= 0) {
      continue;
    }

    rows.push({
      ledgerId: row.ledgerId,
      ledgerName: row.ledgerName,
      ledgerGroupId: group.id,
      ledgerGroupName: group.name,
      outstandingAmount,
    });
  }

  rows.sort(
    (a, b) => a.ledgerGroupName.localeCompare(b.ledgerGroupName) || a.ledgerName.localeCompare(b.ledgerName)
  );

  const totalOutstanding = round2(rows.reduce((sum, row) => sum + row.outstandingAmount, 0));

  return { rows, totalOutstanding };
}
