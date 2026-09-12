import type { CashFlowReport } from "@/engines/reporting/types";

interface CashFlowStatementProps {
  report: CashFlowReport;
}

/**
 * Three-section Cash Flow statement (67-cash-flow.md's UI section) —
 * unlike Trial Balance/Profit & Loss/Balance Sheet, `buildCashFlowReport`
 * produces no ledger-level rows to expand (the direct method's three
 * category totals plus the headline net figure are the entire report), so
 * this is a flat set of totals rather than the shared nested Ledger Group
 * tree interaction those three statements use. A visible reconciliation
 * indicator (`report.reconciles`) sits above the totals, mirroring
 * balance-sheet-statement.tsx's own `isBalanced` indicator.
 */
export function CashFlowStatement({ report }: CashFlowStatementProps) {
  const isNetDecrease = report.netChangeInCash < 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          report.reconciles ? "bg-success/10 text-success" : "bg-error/10 text-error"
        }`}
      >
        {report.reconciles ? "Reconciled" : "Not reconciled — data-integrity check failed"}
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
        <CashFlowActivityRow label="Net Cash from Operating Activities" value={report.operating} />
        <CashFlowActivityRow label="Net Cash from Investing Activities" value={report.investing} />
        <CashFlowActivityRow label="Net Cash from Financing Activities" value={report.financing} />

        <div
          className={`flex items-center justify-between gap-2 rounded-lg border-t border-border px-2 py-2 font-semibold ${
            isNetDecrease ? "text-error" : "text-success"
          }`}
        >
          <span>{isNetDecrease ? "Net Decrease in Cash" : "Net Increase in Cash"}</span>
          <span className="font-financial">{Math.abs(report.netChangeInCash).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

interface CashFlowActivityRowProps {
  label: string;
  value: number;
}

function CashFlowActivityRow({ label, value }: CashFlowActivityRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
      <span className="font-medium text-foreground">{label}</span>
      <span className="w-28 shrink-0 text-right font-financial">{value.toFixed(2)}</span>
    </div>
  );
}
