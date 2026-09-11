import { Gstr3bRowNote } from "@/modules/gst/components/gstr3b-row-note";
import type { Gstr2NotTrackedRow } from "@/types/gstr2";

interface Gstr2NotTrackedSectionProps {
  title: string;
  row: Gstr2NotTrackedRow;
}

/**
 * Shared rendering for every Table this codebase's data model cannot support
 * at all (Tables 4/5/8/9/11) — always ₹0, always visibly distinct from a
 * genuine zero via the shared "Not tracked" badge (reused from
 * 59-gstr-3b.md's Gstr3bRowNote, per this spec's UI section — no duplicate
 * badge component).
 */
export function Gstr2NotTrackedSection({ title, row }: Gstr2NotTrackedSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4">
        <span className="text-sm font-financial text-muted-foreground">₹{row.amount.toFixed(2)}</span>
        <Gstr3bRowNote reason={row.reason} variant="not-tracked" />
      </div>
    </div>
  );
}
