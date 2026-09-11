import type { Gstr3bInterestLateFee } from "@/types/gstr3b";

interface Gstr3bInterestLateFeeNoteProps {
  interestLateFee: Gstr3bInterestLateFee;
}

/**
 * Table 5.1 — Interest and late fee. Presentational-only per 59-gstr-3b.md's
 * Business Rules: no input fields, no auto-calculation — just an explanation
 * of why this offline system cannot compute it.
 */
export function Gstr3bInterestLateFeeNote({ interestLateFee }: Gstr3bInterestLateFeeNoteProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Table 5.1 — Interest and Late Fee</h3>
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{interestLateFee.reason}</p>
      </div>
    </div>
  );
}
