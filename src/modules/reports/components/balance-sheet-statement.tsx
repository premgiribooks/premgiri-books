"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { BalanceSheetReport, BalanceSheetRow, BalanceSheetSection } from "@/engines/reporting/types";

interface BalanceSheetStatementProps {
  report: BalanceSheetReport;
}

/**
 * Two-column Indian/Tally-style Balance Sheet (66-balance-sheet.md's UI
 * section) — Liabilities on the left, Assets on the right, each side reusing
 * the same nested/expandable Ledger Group tree interaction
 * trial-balance-group-tree.tsx and profit-and-loss-statement.tsx already
 * established, with a single signed "value" column per row/section. A
 * visible balanced/unbalanced indicator (`report.isBalanced`) sits above the
 * grand-total rows rather than being silently assumed true.
 */
export function BalanceSheetStatement({ report }: BalanceSheetStatementProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          report.isBalanced ? "bg-success/10 text-success" : "bg-error/10 text-error"
        }`}
      >
        {report.isBalanced ? "Balanced" : "Not balanced — data-integrity check failed"}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BalanceSheetColumn title="Liabilities" sections={report.liabilities} total={report.totalLiabilities} />
        <BalanceSheetColumn title="Assets" sections={report.assets} total={report.totalAssets} />
      </div>
    </div>
  );
}

interface BalanceSheetColumnProps {
  title: string;
  sections: BalanceSheetSection[];
  total: number;
}

function BalanceSheetColumn({ title, sections, total }: BalanceSheetColumnProps) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
      <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs font-medium text-muted-foreground">
        <span>{title}</span>
        <span className="w-28 shrink-0 text-right">Amount</span>
      </div>

      {sections.length === 0 ? (
        <p className="px-2 py-4 text-sm text-muted-foreground">No ledgers found under {title.toLowerCase()}.</p>
      ) : (
        sections.map((section) => <BalanceSheetSectionRow key={section.groupId} section={section} />)
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2 font-medium text-foreground">
        <span>Total</span>
        <span className="w-28 shrink-0 text-right font-financial">{total.toFixed(2)}</span>
      </div>
    </div>
  );
}

interface BalanceSheetSectionRowProps {
  section: BalanceSheetSection;
}

function BalanceSheetSectionRow({ section }: BalanceSheetSectionRowProps) {
  const [expanded, setExpanded] = React.useState(true);
  const hasContent = section.rows.length > 0 || section.childSections.length > 0;

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/40"
        style={{ paddingLeft: section.depth * 20 + 8 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasContent ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? "Collapse group" : "Expand group"}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span className="truncate font-medium text-foreground">{section.groupName}</span>
        </div>

        <span className="w-28 shrink-0 text-right font-financial">{section.subtotal.toFixed(2)}</span>
      </div>

      {expanded ? (
        <>
          {section.rows.map((row) => (
            <BalanceSheetLedgerRow key={row.ledgerId} row={row} depth={section.depth + 1} />
          ))}
          {section.childSections.map((child) => (
            <BalanceSheetSectionRow key={child.groupId} section={child} />
          ))}
        </>
      ) : null}
    </div>
  );
}

interface BalanceSheetLedgerRowProps {
  row: BalanceSheetRow;
  depth: number;
}

function BalanceSheetLedgerRow({ row, depth }: BalanceSheetLedgerRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ paddingLeft: depth * 20 + 8 }}>
      <span className="flex h-5 w-5 shrink-0 items-center" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{row.ledgerName}</span>
      <span className="w-28 shrink-0 text-right font-financial text-sm">{row.value.toFixed(2)}</span>
    </div>
  );
}
