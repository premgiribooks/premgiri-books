"use client";

import * as React from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMarginOverride } from "@/hooks/use-margin-override";
import { previewSalesOrderMarginOverrideAction } from "@/modules/sales-orders/actions/sales-order-actions";
import { SalesOrderTotalsSummary } from "@/modules/sales-orders/components/sales-order-totals-summary";
import type { SalesOrderDetail } from "@/types/sales-order";

interface SalesOrderDetailContentProps {
  salesOrder: SalesOrderDetail;
}

/**
 * The items table + totals summary — split out of the detail page (a Server
 * Component) because the hidden "temporary margin override" feature
 * (Ctrl+Shift+M) needs client-side state to swap these figures for their
 * override-computed equivalents. Safe to fully replace: this page is
 * read-only and never writes back to the order — see
 * sales-order-service.ts's previewSalesOrderWithMarginOverride.
 * `deliveredQuantity`/pending are always read from the real `salesOrder`,
 * never the override preview. No inline "custom margin" text here per
 * explicit user request — the navbar's CM badge is the only indicator.
 */
export function SalesOrderDetailContent({ salesOrder }: SalesOrderDetailContentProps) {
  const override = useMarginOverride();
  const [preview, setPreview] = React.useState<SalesOrderDetail | null>(null);

  React.useEffect(() => {
    if (!override) {
      return;
    }
    let cancelled = false;
    void previewSalesOrderMarginOverrideAction(salesOrder.id, override.marginPercent).then((result) => {
      if (!cancelled && result.success && result.data) {
        setPreview(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [override, salesOrder.id]);

  const isOverridden = Boolean(override && preview);
  const display = isOverridden && preview ? preview : salesOrder;

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesOrder.items.map((realItem, index) => {
              const item = display.items[index] ?? realItem;
              return (
                <TableRow key={realItem.id}>
                  <TableCell>
                    {realItem.product.name}
                    {realItem.product.productCode ? ` (${realItem.product.productCode})` : ""}
                    {!realItem.product.isActive ? (
                      <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-financial">{realItem.quantity}</TableCell>
                  <TableCell className="text-right font-financial">{realItem.deliveredQuantity}</TableCell>
                  <TableCell className="text-right font-financial">
                    {realItem.quantity - realItem.deliveredQuantity}
                  </TableCell>
                  <TableCell className="text-right font-financial">{item.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial">
                    {realItem.discountAmount > 0 || realItem.discountPercent > 0
                      ? `${realItem.discountPercent}% + ${realItem.discountAmount.toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-financial">{item.taxableAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial">{item.totalAmount.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <SalesOrderTotalsSummary
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
