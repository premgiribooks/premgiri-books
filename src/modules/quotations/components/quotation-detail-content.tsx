"use client";

import * as React from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMarginOverride } from "@/hooks/use-margin-override";
import { previewQuotationMarginOverrideAction } from "@/modules/quotations/actions/quotation-actions";
import { QuotationTotalsSummary } from "@/modules/quotations/components/quotation-totals-summary";
import type { QuotationDetail } from "@/types/quotation";

interface QuotationDetailContentProps {
  quotation: QuotationDetail;
}

/**
 * The items table + totals summary — split out of the detail page (a Server
 * Component) because the hidden "temporary margin override" feature
 * (Ctrl+Shift+M) needs client-side state to swap these figures for their
 * override-computed equivalents. Safe to fully replace: this page is
 * read-only and never writes back to the quotation — see
 * quotation-service.ts's previewQuotationWithMarginOverride. No inline
 * "custom margin" text here per explicit user request — the navbar's CM
 * badge (margin-override-badge.tsx) is the only on-screen indicator.
 */
export function QuotationDetailContent({ quotation }: QuotationDetailContentProps) {
  const override = useMarginOverride();
  const [preview, setPreview] = React.useState<QuotationDetail | null>(null);

  React.useEffect(() => {
    if (!override) {
      return;
    }
    let cancelled = false;
    void previewQuotationMarginOverrideAction(quotation.id, override.marginPercent).then((result) => {
      if (!cancelled && result.success && result.data) {
        setPreview(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [override, quotation.id]);

  const isOverridden = Boolean(override && preview);
  const display = isOverridden && preview ? preview : quotation;

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.items.map((item, index) => (
              <TableRow key={quotation.items[index]?.id ?? item.id}>
                <TableCell>
                  {item.product.name}
                  {item.product.productCode ? ` (${item.product.productCode})` : ""}
                  {!item.product.isActive ? <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span> : null}
                </TableCell>
                <TableCell className="text-right font-financial">{item.quantity}</TableCell>
                <TableCell className="text-right font-financial">{item.rate.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">
                  {item.discountAmount > 0 || item.discountPercent > 0
                    ? `${item.discountPercent}% + ${item.discountAmount.toFixed(2)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-financial">{item.taxableAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">{item.totalAmount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <QuotationTotalsSummary
        totals={{
          subtotal: display.subtotal,
          totalDiscount: display.totalDiscount,
          taxableAmount: display.taxableAmount,
          totalCgst: display.totalCgst,
          totalSgst: display.totalSgst,
          totalIgst: display.totalIgst,
          totalCess: display.totalCess,
          grandTotal: display.grandTotal,
        }}
        groups={[]}
      />
    </>
  );
}
