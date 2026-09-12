import type { LedgerGroup } from "@prisma/client";

import { buildLedgerGroupIndex, getRootGroup } from "@/engines/reporting/ledger-classification";
import type { CashFlowReport, CashLedgerMovement, CategorizableEntry } from "@/engines/reporting/types";

// 67-cash-flow.md's Business Rules — categorization keys off the counter-
// ledger's top-level (root) group name, reusing getRootGroup (64-trial-
// balance.md) unmodified.
const INVESTING_ROOT_GROUP_NAMES = new Set(["Fixed Assets", "Investments"]);
const FINANCING_ROOT_GROUP_NAMES = new Set(["Capital Account", "Reserves & Surplus", "Loans (Liability)"]);

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Pure shaping of already-computed Cash/Bank ledger movements and cash-
 * touching counter-ledger entries into the Operating/Investing/Financing
 * Cash Flow statement (67-cash-flow.md's Business Rules and Engine
 * sections). Never independently sums voucher entries for the headline
 * figure — `netChangeInCash` is the sum of the caller's own
 * `cashLedgerMovements` (each already `closingBalance − openingBalance` from
 * a single `voucherQueries.getLedgerStatement` call).
 *
 * Every `categorizableEntries` row is a non-cash counter-ledger entry of a
 * voucher that touched at least one Cash/Bank ledger (a Contra Voucher,
 * whose only entries are all Cash/Bank-class, has nothing to categorize and
 * so contributes to no category — the correct treatment for an internal
 * transfer between cash equivalents, per spec). A `CREDIT` entry
 * contributes `+amount` to its category (mirroring the cash-side `DEBIT`
 * that increased cash in the same voucher); a `DEBIT` entry contributes
 * `-amount`. A root group that is neither Investing- nor Financing-class
 * falls into Operating, matching the spec's "every other root group" rule
 * (including an entry whose root group cannot be resolved, which should not
 * occur against a complete `groups` list but is treated as Operating rather
 * than silently dropped).
 */
export function buildCashFlowReport(
  cashLedgerMovements: CashLedgerMovement[],
  categorizableEntries: CategorizableEntry[],
  groups: LedgerGroup[]
): CashFlowReport {
  const index = buildLedgerGroupIndex(groups);

  const netChangeInCash = round2(cashLedgerMovements.reduce((sum, movement) => sum + movement.netChange, 0));

  let operating = 0;
  let investing = 0;
  let financing = 0;

  for (const entry of categorizableEntries) {
    const rootGroupName = getRootGroup(entry.ledgerGroupId, index)?.name;
    const signedAmount = entry.entryType === "CREDIT" ? entry.amount : -entry.amount;

    if (rootGroupName && INVESTING_ROOT_GROUP_NAMES.has(rootGroupName)) {
      investing += signedAmount;
    } else if (rootGroupName && FINANCING_ROOT_GROUP_NAMES.has(rootGroupName)) {
      financing += signedAmount;
    } else {
      operating += signedAmount;
    }
  }

  operating = round2(operating);
  investing = round2(investing);
  financing = round2(financing);

  return {
    operating,
    investing,
    financing,
    netChangeInCash,
    reconciles: round2(operating + investing + financing) === netChangeInCash,
  };
}
