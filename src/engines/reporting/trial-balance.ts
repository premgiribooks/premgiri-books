import type { LedgerGroup } from "@prisma/client";

import type { TrialBalanceResult, TrialBalanceRow } from "@/engines/voucher/types";
import { buildLedgerGroupIndex } from "@/engines/reporting/ledger-classification";
import type { LedgerGroupIndex, TrialBalanceReport, TrialBalanceSection } from "@/engines/reporting/types";
import type { ReportExportTable } from "@/types/report-export";

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
 * Recursively builds one group's section: its own ledger rows (Debit/Credit
 * split by the same debit-positive-closingBalance convention
 * getTrialBalance's own totalDebit/totalCredit already use) plus every
 * descendant group's rolled-up subtotal. Returns null when neither this
 * group nor any descendant has a single ledger assigned anywhere in its
 * subtree — an empty branch adds no signal to a Trial Balance and is
 * omitted entirely (64-trial-balance.md's Business Rules).
 */
function buildSection(
  groupId: string,
  depth: number,
  rowsByGroup: Map<string, TrialBalanceRow[]>,
  index: LedgerGroupIndex
): TrialBalanceSection | null {
  const entry = index.get(groupId);
  if (!entry) {
    return null;
  }

  const ownRows = rowsByGroup.get(groupId) ?? [];
  const childSections = entry.children
    .map((childId) => buildSection(childId, depth + 1, rowsByGroup, index))
    .filter((section): section is TrialBalanceSection => section !== null);

  if (ownRows.length === 0 && childSections.length === 0) {
    return null;
  }

  const ownDebit = ownRows.filter((row) => row.closingBalance >= 0).reduce((sum, row) => sum + row.closingBalance, 0);
  const ownCredit = ownRows
    .filter((row) => row.closingBalance < 0)
    .reduce((sum, row) => sum + Math.abs(row.closingBalance), 0);

  const subtotalDebit = round2(ownDebit + childSections.reduce((sum, section) => sum + section.subtotalDebit, 0));
  const subtotalCredit = round2(ownCredit + childSections.reduce((sum, section) => sum + section.subtotalCredit, 0));

  return {
    groupId: entry.group.id,
    groupName: entry.group.name,
    natureType: entry.group.natureType,
    depth,
    rows: ownRows,
    subtotalDebit,
    subtotalCredit,
    childSections,
  };
}

/**
 * Pure shaping of voucherEngine.getTrialBalance's already-computed output
 * into a group-hierarchy tree with rolled-up subtotals. Never recomputes any
 * ledger-balance arithmetic — totalDebit/totalCredit are copied straight
 * from `result`, exactly matching its own grand total by construction
 * (64-trial-balance.md's Business Rules).
 */
export function buildTrialBalanceReport(result: TrialBalanceResult, groups: LedgerGroup[]): TrialBalanceReport {
  const index = buildLedgerGroupIndex(groups);
  const rowsByGroup = groupRowsByLedgerGroup(result.rows);

  const rootGroups = groups.filter((group) => !group.parentGroupId || !index.has(group.parentGroupId));
  const sections = rootGroups
    .map((group) => buildSection(group.id, 0, rowsByGroup, index))
    .filter((section): section is TrialBalanceSection => section !== null);

  return {
    sections,
    totalDebit: result.totalDebit,
    totalCredit: result.totalCredit,
  };
}

type TrialBalanceExportRow = Record<string, string | number | null>;

function flattenSection(section: TrialBalanceSection, rows: TrialBalanceExportRow[]): void {
  rows.push({
    particulars: section.groupName,
    indentLevel: section.depth,
    debit: section.subtotalDebit,
    credit: section.subtotalCredit,
  });

  for (const row of section.rows) {
    rows.push({
      particulars: row.ledgerName,
      indentLevel: section.depth + 1,
      debit: row.closingBalance >= 0 ? row.closingBalance : 0,
      credit: row.closingBalance < 0 ? Math.abs(row.closingBalance) : 0,
    });
  }

  for (const child of section.childSections) {
    flattenSection(child, rows);
  }
}

/**
 * Flattens the group-hierarchy tree buildTrialBalanceReport produces into
 * the flat rows-plus-totals-footer shape src/lib/excel-export.ts's shared
 * contract understands (77-excel-export.md's Business Rules: flattening a
 * presentation tree into export rows is the calling report's own shaping
 * concern, never the shared utility's). Row order and figures mirror
 * TrialBalanceGroupTree's own depth-first render exactly — a group's own
 * subtotal row, then its own ledger rows, then child sections recursively.
 */
export function toTrialBalanceExportTable(report: TrialBalanceReport): ReportExportTable[] {
  const rows: TrialBalanceExportRow[] = [];
  for (const section of report.sections) {
    flattenSection(section, rows);
  }

  return [
    {
      sheetName: "Trial Balance",
      columns: [
        { key: "particulars", header: "Particulars", type: "string" },
        { key: "indentLevel", header: "Indent Level", type: "number" },
        { key: "debit", header: "Debit", type: "currency" },
        { key: "credit", header: "Credit", type: "currency" },
      ],
      rows,
      totals: { particulars: "Grand Total", indentLevel: null, debit: report.totalDebit, credit: report.totalCredit },
    },
  ];
}
