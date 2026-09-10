import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesReturnStatusActions } from "@/modules/sales-returns/components/sales-return-status-actions";
import { SalesReturnStatusBadge } from "@/modules/sales-returns/components/sales-return-status-badge";
import { formatSalesReturnDate } from "@/modules/sales-returns/utils/format-sales-return-date";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";

interface SalesReturnDetailPageProps {
  params: Promise<{ id: string }>;
}

const REFUND_MODE_LABELS: Record<string, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

export default async function SalesReturnDetailPage({ params }: SalesReturnDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const salesReturn = await salesReturnService.getSalesReturn(id);
  if (!salesReturn) {
    notFound();
  }

  const [isAdmin, canPost, canCancel] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "approve"),
    hasPermission(user, "sales", "approve"),
  ]);

  const isEditable = salesReturn.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{salesReturn.returnNumber ?? "Draft Sales Return"}</h1>
              <SalesReturnStatusBadge status={salesReturn.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Against invoice{" "}
              <Link href={`/sales/invoices/${salesReturn.salesInvoice.id}`} className="hover:underline">
                {salesReturn.salesInvoice.invoiceNumber}
              </Link>{" "}
              — {salesReturn.salesInvoice.customerName ?? "Walk-in"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/sales/returns/${salesReturn.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <SalesReturnStatusActions salesReturn={salesReturn} canPost={canPost} canCancel={canCancel} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Return Date</p>
            <p className="font-financial text-sm text-foreground">{formatSalesReturnDate(salesReturn.returnDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Refund Mode</p>
            <p className="text-sm text-foreground">
              {REFUND_MODE_LABELS[salesReturn.refundMode] ?? salesReturn.refundMode}
              {salesReturn.refundLedger ? ` — ${salesReturn.refundLedger.name}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="font-financial text-sm text-foreground">{salesReturn.grandTotal.toFixed(2)}</p>
          </div>
        </div>

        {salesReturn.reason ? <p className="text-sm text-muted-foreground">{salesReturn.reason}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesReturn.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.salesInvoiceItem.productName} ({item.salesInvoiceItem.productCode})
                  </TableCell>
                  <TableCell>{item.salesInvoiceItem.warehouseName}</TableCell>
                  <TableCell className="text-right font-financial">{item.quantity}</TableCell>
                  <TableCell className="text-right font-financial">{item.taxableAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial">{item.totalAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
