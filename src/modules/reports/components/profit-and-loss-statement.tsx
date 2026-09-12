"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { ProfitAndLossReport, ProfitAndLossRow, ProfitAndLossSection } from "@/engines/reporting/types";

interface ProfitAndLossStatementProps {
  report: ProfitAndLossReport;
}

/**
 * Two-section Trading Account / Profit & Loss Account statement
 * (65-profit-and-loss.md's UI section) — the same nested/expandable Ledger
 * Group tree interaction trial-balance-group-tree.tsx established, adapted
 * for a single signed "value" column per row/section instead of split
 * Debit/Credit columns (this codebase's own precedent of a small dedicated
 * component per report rather than a generic shared one, matching
 * financial-report-filters-schema.ts's per-module duplication note).
 */
export function ProfitAndLossStatement({ report }: ProfitAndLossStatementProps) {
  const isNetLoss = report.netProfit < 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-2xl border border-border p-2">
        <h2 className="px-2 pt-1 text-sm font-semibold text-foreground">Trading Account</h2>
        <ProfitAndLossSectionGroup title="Direct Income" sections={report.directIncome} />
        <ProfitAndLossSectionGroup title="Direct Expense" sections={report.directExpense} />
        <ProfitAndLossTotalRow label="Gross Profit" value={report.grossProfit} />
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border p-2">
        <h2 className="px-2 pt-1 text-sm font-semibold text-foreground">Profit &amp; Loss Account</h2>
        <ProfitAndLossTotalRow label="Gross Profit brought forward" value={report.grossProfit} muted />
        <ProfitAndLossSectionGroup title="Indirect Income" sections={report.indirectIncome} />
        <ProfitAndLossSectionGroup title="Indirect Expense" sections={report.indirectExpense} />
        <div
          className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 font-semibold ${
            isNetLoss ? "text-error" : "text-success"
          }`}
        >
          <span>{isNetLoss ? "Net Loss" : "Net Profit"}</span>
          <span className="font-financial">{Math.abs(report.netProfit).toFixed(2)}</span>
        </div>
      </section>
    </div>
  );
}

interface ProfitAndLossSectionGroupProps {
  title: string;
  sections: ProfitAndLossSection[];
}

function ProfitAndLossSectionGroup({ title, sections }: ProfitAndLossSectionGroupProps) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      {sections.map((section) => (
        <ProfitAndLossSectionRow key={section.groupId} section={section} />
      ))}
    </div>
  );
}

interface ProfitAndLossSectionRowProps {
  section: ProfitAndLossSection;
}

function ProfitAndLossSectionRow({ section }: ProfitAndLossSectionRowProps) {
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
            <ProfitAndLossLedgerRow key={row.ledgerId} row={row} depth={section.depth + 1} />
          ))}
          {section.childSections.map((child) => (
            <ProfitAndLossSectionRow key={child.groupId} section={child} />
          ))}
        </>
      ) : null}
    </div>
  );
}

interface ProfitAndLossLedgerRowProps {
  row: ProfitAndLossRow;
  depth: number;
}

function ProfitAndLossLedgerRow({ row, depth }: ProfitAndLossLedgerRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ paddingLeft: depth * 20 + 8 }}>
      <span className="flex h-5 w-5 shrink-0 items-center" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{row.ledgerName}</span>
      <span className="w-28 shrink-0 text-right font-financial text-sm">{row.value.toFixed(2)}</span>
    </div>
  );
}

interface ProfitAndLossTotalRowProps {
  label: string;
  value: number;
  muted?: boolean;
}

function ProfitAndLossTotalRow({ label, value, muted }: ProfitAndLossTotalRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border-t border-border px-2 py-2 font-medium ${
        muted ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="font-financial">{value.toFixed(2)}</span>
    </div>
  );
}
