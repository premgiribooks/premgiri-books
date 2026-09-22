"use client";

import * as React from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMarginOverride } from "@/hooks/use-margin-override";
import { previewSalesInvoiceMarginOverrideAction } from "@/modules/sales-invoices/actions/sales-invoice-actions";
import { formatSalesInvoiceDate } from "@/modules/sales-invoices/utils/format-sales-invoice-date";
import type { SalesInvoiceDetail } from "@/types/sales-invoice";

interface SalesInvoiceDetailContentProps {
  salesInvoice: SalesInvoiceDetail;
}

/**
 * The items table + "Paid / Grand Total" line — split out of the detail
 * page (a Server Component) because the hidden "temporary margin override"
 * feature (Ctrl+Shift+M) needs client-side state to swap these figures for
 * their override-computed equivalents — this page is read-only and never
 * writes back to the invoice, so a full replace here is always safe
 * regardless of what the Create/Edit form does with its own Rate field —
 * see sales-invoice-service.ts's previewSalesInvoiceWithMarginOverride.
 * `amountPaid`/payments are real actual money received, so those are never
 * swapped, only the priced figures a margin recomputes. No inline
 * "custom margin" text here per explicit user request — the navbar's CM
 * badge (margin-override-badge.tsx) is the only on-screen indicator.
 */
export function SalesInvoiceDetailContent({ salesInvoice }: SalesInvoiceDetailContentProps) {
  const override = useMarginOverride();
  const [preview, setPreview] = React.useState<SalesInvoiceDetail | null>(null);

  React.useEffect(() => {
    // No explicit reset when `override` is cleared: `isOverridden` below is
    // `Boolean(override && preview)`, so a stale `preview` from a prior
    // override is already ignored once `override` itself is null — avoids
    // an unconditional setState() synchronously inside this effect.
    if (!override) {
      return;
    }
    let cancelled = false;
    void previewSalesInvoiceMarginOverrideAction(salesInvoice.id, override.marginPercent).then((result) => {
      if (!cancelled && result.success && result.data) {
        setPreview(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [override, salesInvoice.id]);

  const isOverridden = Boolean(override && preview);
  const display = isOverridden && preview ? preview : salesInvoice;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Invoice Date</p>
          <p className="font-financial text-sm text-foreground">{formatSalesInvoiceDate(salesInvoice.invoiceDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Place of Supply</p>
          <p className="text-sm text-foreground">{salesInvoice.placeOfSupplyStateCode}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Paid / Grand Total</p>
          <p className="font-financial text-sm text-foreground">
            {salesInvoice.amountPaid.toFixed(2)} / {display.grandTotal.toFixed(2)}
          </p>
        </div>
      </div>

      {salesInvoice.narration ? <p className="text-sm text-muted-foreground">{salesInvoice.narration}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Fulfilled From</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.items.map((item, index) => (
              <TableRow key={salesInvoice.items[index]?.id ?? item.id}>
                <TableCell>
                  {item.product.name}
                  {item.product.productCode ? ` (${item.product.productCode})` : ""}
                </TableCell>
                <TableCell>
                  {item.warehouseAllocations.length > 0
                    ? item.warehouseAllocations
                        .map((allocation) => `${allocation.warehouseName} (${allocation.quantity})`)
                        .join(", ")
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-financial">{item.quantity}</TableCell>
                <TableCell className="text-right font-financial">{item.rate.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">{item.taxableAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">{item.totalAmount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
