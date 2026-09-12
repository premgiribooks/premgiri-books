import type { LedgerGroup } from "@prisma/client";

import { buildLedgerGroupIndex } from "@/engines/reporting/ledger-classification";
import type {
  LedgerGroupIndex,
  ProfitAndLossLedgerMovement,
  ProfitAndLossReport,
  ProfitAndLossRow,
  ProfitAndLossSection,
} from "@/engines/reporting/types";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The calendar day immediately before `date` (UTC midnight in, UTC midnight
 * out) — used by profitAndLossService to compute the "as-of the day before
 * `from`" boundary for its two-call getTrialBalance diff (65-profit-and-loss.md).
 */
export function dayBefore(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function groupRowsByLedgerGroup(rows: ProfitAndLossLedgerMovement[]): Map<string, ProfitAndLossLedgerMovement[]> {
  const byGroup = new Map<string, ProfitAndLossLedgerMovement[]>();
  for (const row of rows) {
    const bucket = byGroup.get(row.ledgerGroupId) ?? [];
    bucket.push(row);
    byGroup.set(row.ledgerGroupId, bucket);
  }
  return byGroup;
}

/**
 * Splits a company's LedgerGroups into the four Trading/P&L Account buckets
 * by their own natureType + affectsGrossProfit columns (no parent-chain walk
 * needed — every group already carries both, per 64-trial-balance.md's
 * Project Context note, reused here). ASSET/LIABILITY groups fall into none
 * of the four and are dropped.
 */
function partitionLedgerGroups(groups: LedgerGroup[]): {
  directIncome: LedgerGroup[];
  directExpense: LedgerGroup[];
  indirectIncome: LedgerGroup[];
  indirectExpense: LedgerGroup[];
} {
  const directIncome: LedgerGroup[] = [];
  const directExpense: LedgerGroup[] = [];
  const indirectIncome: LedgerGroup[] = [];
  const indirectExpense: LedgerGroup[] = [];

  for (const group of groups) {
    if (group.natureType === "INCOME") {
      (group.affectsGrossProfit ? directIncome : indirectIncome).push(group);
    } else if (group.natureType === "EXPENSE") {
      (group.affectsGrossProfit ? directExpense : indirectExpense).push(group);
    }
  }

  return { directIncome, directExpense, indirectIncome, indirectExpense };
}

/**
 * Recursively builds one group's section within a single bucket: its own
 * ledgers' period values (natural-balance sign already applied by the
 * caller) plus every descendant group's rolled-up subtotal. A ledger with
 * zero period activity (value === 0) is dropped — unlike Trial Balance,
 * which lists every ledger for completeness, a P&L's zero-activity rows are
 * noise, not signal (65-profit-and-loss.md's Business Rules). A group is
 * itself omitted once neither it nor any descendant has a single non-zero
 * row left.
 */
function buildBucketSection(
  groupId: string,
  depth: number,
  rowsByGroup: Map<string, ProfitAndLossLedgerMovement[]>,
  index: LedgerGroupIndex,
  isIncomeNature: boolean
): ProfitAndLossSection | null {
  const entry = index.get(groupId);
  if (!entry) {
    return null;
  }

  const ownRows: ProfitAndLossRow[] = (rowsByGroup.get(groupId) ?? [])
    .map((movement) => ({
      ledgerId: movement.ledgerId,
      ledgerName: movement.ledgerName,
      value: round2(isIncomeNature ? movement.periodCredit - movement.periodDebit : movement.periodDebit - movement.periodCredit),
    }))
    .filter((row) => row.value !== 0);

  const childSections = entry.children
    .map((childId) => buildBucketSection(childId, depth + 1, rowsByGroup, index, isIncomeNature))
    .filter((section): section is ProfitAndLossSection => section !== null);

  if (ownRows.length === 0 && childSections.length === 0) {
    return null;
  }

  const subtotal = round2(
    ownRows.reduce((sum, row) => sum + row.value, 0) + childSections.reduce((sum, section) => sum + section.subtotal, 0)
  );

  return {
    groupId: entry.group.id,
    groupName: entry.group.name,
    depth,
    rows: ownRows,
    subtotal,
    childSections,
  };
}

function buildBucketSections(
  bucketGroups: LedgerGroup[],
  rowsByGroup: Map<string, ProfitAndLossLedgerMovement[]>,
  isIncomeNature: boolean
): ProfitAndLossSection[] {
  const index = buildLedgerGroupIndex(bucketGroups);
  const rootGroups = bucketGroups.filter((group) => !group.parentGroupId || !index.has(group.parentGroupId));

  return rootGroups
    .map((group) => buildBucketSection(group.id, 0, rowsByGroup, index, isIncomeNature))
    .filter((section): section is ProfitAndLossSection => section !== null);
}

function sumSections(sections: ProfitAndLossSection[]): number {
  return sections.reduce((sum, section) => sum + section.subtotal, 0);
}

/**
 * Pure shaping of a company's already-diffed period ledger movements
 * (see profitAndLossService for how those are produced from two
 * voucherEngine.getTrialBalance calls) into the Trading Account / Profit &
 * Loss Account structure with Gross Profit and Net Profit
 * (65-profit-and-loss.md's Business Rules). Never independently sums voucher
 * entries — only the already-diffed periodDebit/periodCredit figures.
 */
export function buildProfitAndLossReport(periodRows: ProfitAndLossLedgerMovement[], groups: LedgerGroup[]): ProfitAndLossReport {
  const { directIncome, directExpense, indirectIncome, indirectExpense } = partitionLedgerGroups(groups);
  const rowsByGroup = groupRowsByLedgerGroup(periodRows);

  const directIncomeSections = buildBucketSections(directIncome, rowsByGroup, true);
  const directExpenseSections = buildBucketSections(directExpense, rowsByGroup, false);
  const indirectIncomeSections = buildBucketSections(indirectIncome, rowsByGroup, true);
  const indirectExpenseSections = buildBucketSections(indirectExpense, rowsByGroup, false);

  const grossProfit = round2(sumSections(directIncomeSections) - sumSections(directExpenseSections));
  const netProfit = round2(grossProfit + sumSections(indirectIncomeSections) - sumSections(indirectExpenseSections));

  return {
    directIncome: directIncomeSections,
    directExpense: directExpenseSections,
    indirectIncome: indirectIncomeSections,
    indirectExpense: indirectExpenseSections,
    grossProfit,
    netProfit,
  };
}
