import type { GstRegisterTotals } from "@/types/gst-report";

interface ItcRegisterReconciliationTotalProps {
  totals: GstRegisterTotals;
}

/**
 * The report's own grand total, visibly labeled as reconciling with
 * `59-gstr-3b.md`'s Table 4(A)(5) (83-itc-register.md Business Rules/UI) —
 * a distinct element from the three summary tables' own footer rows, since
 * this is the one number a filer should cross-check against GSTR-3B before
 * filing.
 */
export function ItcRegisterReconciliationTotal({ totals }: ItcRegisterReconciliationTotalProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">Total Eligible ITC (this period)</p>
        <p className="text-xs text-muted-foreground">Reconciles exactly with GSTR-3B&apos;s Table 4(A)(5) — All Other ITC.</p>
      </div>
      <p className="text-lg font-financial font-semibold text-foreground">
        {(totals.cgst + totals.sgst + totals.igst + totals.cess).toFixed(2)}
      </p>
    </div>
  );
}
