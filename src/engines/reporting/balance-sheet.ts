import type { LedgerGroup } from "@prisma/client";

import type { TrialBalanceResult, TrialBalanceRow } from "@/engines/voucher/types";
import { buildLedgerGroupIndex } from "@/engines/reporting/ledger-classification";
import type { BalanceSheetReport, BalanceSheetSection, LedgerGroupIndex } from "@/engines/reporting/types";

const PROFIT_AND_LOSS_PLUG_ID = "profit-and-loss-current-period";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function groupRowsByLedgerGroup(rows: TrialBalanceRow[]): Map<string, TrialBalanceRow[]> {
  const byGroup = new Map<string, TrialBalanceRow[]>();
  for (const row of rows) {
    const bucket = byGroup.get(row.ledgerGroupId) ?? [];
    bucket.push(row);
    byGroup.set(row.ledgerGroupId, bucket);
  }
  return byGroup;
}

/**
 * Recursively builds one group's section within a single side (Assets or
 * Liabilities): its own ledgers' `closingBalance`, sign-applied per side
 * (`sign = 1` for Assets, `sign = -1` for Liabilities — 66-balance-sheet.md's
 * Business Rules), plus every descendant group's rolled-up subtotal. Mirrors
 * trial-balance.ts's buildSection, adapted to a single signed "value" column
 * instead of a split Debit/Credit pair, matching profit-and-loss.ts's own
 * section shape.
 */
function buildSection(
  groupId: string,
  depth: number,
  rowsByGroup: Map<string, TrialBalanceRow[]>,
  index: LedgerGroupIndex,
  sign: 1 | -1
): BalanceSheetSection | null {
  const entry = index.get(groupId);
  if (!entry) {
    return null;
  }

  const ownRows = (rowsByGroup.get(groupId) ?? []).map((row) => ({
    ledgerId: row.ledgerId,
    ledgerName: row.ledgerName,
    value: round2(sign * row.closingBalance),
  }));

  const childSections = entry.children
    .map((childId) => buildSection(childId, depth + 1, rowsByGroup, index, sign))
    .filter((section): section is BalanceSheetSection => section !== null);

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

/** Builds every root-level section for one side (ASSET or LIABILITY groups only). */
function buildSideSections(
  natureType: "ASSET" | "LIABILITY",
  rowsByGroup: Map<string, TrialBalanceRow[]>,
  groups: LedgerGroup[],
  sign: 1 | -1
): BalanceSheetSection[] {
  const natureGroups = groups.filter((group) => group.natureType === natureType);
  const index = buildLedgerGroupIndex(natureGroups);
  const rootGroups = natureGroups.filter((group) => !group.parentGroupId || !index.has(group.parentGroupId));

  return rootGroups
    .map((group) => buildSection(group.id, 0, rowsByGroup, index, sign))
    .filter((section): section is BalanceSheetSection => section !== null);
}

function sumSections(sections: BalanceSheetSection[]): number {
  return round2(sections.reduce((sum, section) => sum + section.subtotal, 0));
}

/**
 * Pure shaping of voucherEngine.getTrialBalance's already-computed output
 * (via `result`) plus 65-profit-and-loss.md's own `netProfit` figure into the
 * Indian/Tally-style two-sided Balance Sheet (66-balance-sheet.md's Business
 * Rules). Never independently recomputes Net Profit — `netProfit` is taken
 * as-is from the caller (profitAndLossService's own output).
 *
 * Assets side = every ASSET-nature ledger's `closingBalance`, used directly.
 * Liabilities side (raw) = every LIABILITY-nature ledger's `closingBalance`,
 * sign-flipped. The current-period Net Profit/Loss is appended to the
 * Liabilities side as a synthetic "Profit & Loss Account (Current Period)"
 * section (a profit increases owner's equity; a loss is shown as a negative
 * figure, never hidden) — `totalLiabilities` therefore always includes it,
 * matching the balancing identity `Σ Assets === Σ Liabilities (raw) + Net
 * Profit plug`.
 */
export function buildBalanceSheetReport(result: TrialBalanceResult, netProfit: number, groups: LedgerGroup[]): BalanceSheetReport {
  const rowsByGroup = groupRowsByLedgerGroup(result.rows);

  const assets = buildSideSections("ASSET", rowsByGroup, groups, 1);
  const rawLiabilities = buildSideSections("LIABILITY", rowsByGroup, groups, -1);

  const profitAndLossPlugSection: BalanceSheetSection = {
    groupId: PROFIT_AND_LOSS_PLUG_ID,
    groupName: "Profit & Loss Account (Current Period)",
    depth: 0,
    rows: [
      {
        ledgerId: PROFIT_AND_LOSS_PLUG_ID,
        ledgerName: "Profit & Loss Account (Current Period)",
        value: round2(netProfit),
      },
    ],
    subtotal: round2(netProfit),
    childSections: [],
  };

  const liabilities = [...rawLiabilities, profitAndLossPlugSection];

  const totalAssets = sumSections(assets);
  const totalLiabilities = sumSections(liabilities);

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    netProfit: round2(netProfit),
    isBalanced: totalAssets === totalLiabilities,
  };
}
