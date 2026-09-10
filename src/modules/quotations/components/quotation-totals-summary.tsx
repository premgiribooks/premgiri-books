import type { DocumentGroupResult } from "@/engines/gst/types";
import type { QuotationTotals } from "@/types/quotation";

interface TotalRowProps {
  label: string;
  value: number;
  emphasize?: boolean;
}

function TotalRow({ label, value, emphasize }: TotalRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={emphasize ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={`font-financial ${emphasize ? "font-semibold text-foreground" : "text-foreground"}`}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

interface QuotationTotalsSummaryProps {
  totals: QuotationTotals;
  groups: DocumentGroupResult[];
}

/**
 * Presentational only — every number here is server-computed
 * (quotationService.previewQuotation / createQuotation), never calculated
 * in the browser (35-quotations.md's UI: "the browser never does tax math
 * itself").
 */
export function QuotationTotalsSummary({ totals, groups }: QuotationTotalsSummaryProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div className="flex flex-col gap-2">
        <TotalRow label="Subtotal" value={totals.subtotal} />
        <TotalRow label="Discount" value={totals.totalDiscount} />
        <TotalRow label="Taxable Amount" value={totals.taxableAmount} />
        {totals.totalCgst > 0 || totals.totalSgst > 0 ? (
          <>
            <TotalRow label="CGST" value={totals.totalCgst} />
            <TotalRow label="SGST" value={totals.totalSgst} />
          </>
        ) : null}
        {totals.totalIgst > 0 ? <TotalRow label="IGST" value={totals.totalIgst} /> : null}
        {totals.totalCess > 0 ? <TotalRow label="Cess" value={totals.totalCess} /> : null}
        <div className="border-t border-border pt-2">
          <TotalRow label="Grand Total" value={totals.grandTotal} emphasize />
        </div>
      </div>

      {groups.length > 1 ? (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Tax Rate Breakdown</span>
          {groups.map((group) => (
            <div
              key={`${group.ratePercent}-${group.cessPercent}`}
              className="flex items-center justify-between text-xs text-muted-foreground"
            >
              <span>
                {group.ratePercent}% GST{group.cessPercent > 0 ? ` + ${group.cessPercent}% Cess` : ""}
              </span>
              <span className="font-financial">{group.totalTax.toFixed(2)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
