"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AccountNatureBadge } from "@/modules/ledger-groups/components/account-nature-badge";
import type { TrialBalanceReport, TrialBalanceSection } from "@/engines/reporting/types";
import type { TrialBalanceRow } from "@/engines/voucher/types";

interface TrialBalanceGroupTreeProps {
  report: TrialBalanceReport;
}

/**
 * Nested/expandable Ledger Group tree with Debit/Credit subtotals rolling up
 * from leaf to root, plus a grand total row copied straight from
 * `report.totalDebit`/`totalCredit` (64-trial-balance.md's UI section) —
 * never independently re-summed. Mirrors ledger-group-tree.tsx's own
 * expand/collapse row shape, extended with the amount columns this report
 * needs.
 */
export function TrialBalanceGroupTree({ report }: TrialBalanceGroupTreeProps) {
  if (report.sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No ledgers found for this company.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
      <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs font-medium text-muted-foreground">
        <span>Ledger Group / Ledger</span>
        <div className="flex shrink-0 items-center gap-6">
          <span className="w-28 text-right">Debit</span>
          <span className="w-28 text-right">Credit</span>
        </div>
      </div>

      {report.sections.map((section) => (
        <TrialBalanceSectionRow key={section.groupId} section={section} />
      ))}

      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2 font-medium text-foreground">
        <span>Grand Total</span>
        <div className="flex shrink-0 items-center gap-6 text-right font-financial">
          <span className="w-28">{report.totalDebit.toFixed(2)}</span>
          <span className="w-28">{report.totalCredit.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

interface TrialBalanceSectionRowProps {
  section: TrialBalanceSection;
}

function TrialBalanceSectionRow({ section }: TrialBalanceSectionRowProps) {
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
          <AccountNatureBadge nature={section.natureType} />
        </div>

        <div className="flex shrink-0 items-center gap-6 text-right font-financial">
          <span className="w-28">{section.subtotalDebit.toFixed(2)}</span>
          <span className="w-28">{section.subtotalCredit.toFixed(2)}</span>
        </div>
      </div>

      {expanded ? (
        <>
          {section.rows.map((row) => (
            <TrialBalanceLedgerRow key={row.ledgerId} row={row} depth={section.depth + 1} />
          ))}
          {section.childSections.map((child) => (
            <TrialBalanceSectionRow key={child.groupId} section={child} />
          ))}
        </>
      ) : null}
    </div>
  );
}

interface TrialBalanceLedgerRowProps {
  row: TrialBalanceRow;
  depth: number;
}

function TrialBalanceLedgerRow({ row, depth }: TrialBalanceLedgerRowProps) {
  const debit = row.closingBalance >= 0 ? row.closingBalance : 0;
  const credit = row.closingBalance < 0 ? Math.abs(row.closingBalance) : 0;

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
      style={{ paddingLeft: depth * 20 + 8 }}
    >
      <span className="flex h-5 w-5 shrink-0 items-center" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{row.ledgerName}</span>
      <div className="flex shrink-0 items-center gap-6 text-right font-financial text-sm">
        <span className="w-28">{debit.toFixed(2)}</span>
        <span className="w-28">{credit.toFixed(2)}</span>
      </div>
    </div>
  );
}
