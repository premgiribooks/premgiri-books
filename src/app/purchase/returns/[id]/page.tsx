import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseReturnStatusActions } from "@/modules/purchase-returns/components/purchase-return-status-actions";
import { PurchaseReturnStatusBadge } from "@/modules/purchase-returns/components/purchase-return-status-badge";
import { formatPurchaseReturnDate } from "@/modules/purchase-returns/utils/format-purchase-return-date";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";

interface PurchaseReturnDetailPageProps {
  params: Promise<{ id: string }>;
}

const REFUND_MODE_LABELS: Record<string, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

export default async function PurchaseReturnDetailPage({ params }: PurchaseReturnDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const purchaseReturn = await purchaseReturnService.getPurchaseReturn(id);
  if (!purchaseReturn) {
    notFound();
  }

  const [isAdmin, canPost, canCancel] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "approve"),
    hasPermission(user, "purchase", "approve"),
  ]);

  const isEditable = purchaseReturn.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{purchaseReturn.returnNumber ?? "Draft Purchase Return"}</h1>
              <PurchaseReturnStatusBadge status={purchaseReturn.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Against invoice{" "}
              <Link href={`/purchase/invoices/${purchaseReturn.purchaseInvoice.id}`} className="hover:underline">
                {purchaseReturn.purchaseInvoice.invoiceNumber}
              </Link>{" "}
              — {purchaseReturn.purchaseInvoice.supplierName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/purchase/returns/${purchaseReturn.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <PurchaseReturnStatusActions purchaseReturn={purchaseReturn} canPost={canPost} canCancel={canCancel} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Return Date</p>
            <p className="font-financial text-sm text-foreground">{formatPurchaseReturnDate(purchaseReturn.returnDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Refund Mode</p>
            <p className="text-sm text-foreground">
              {REFUND_MODE_LABELS[purchaseReturn.refundMode] ?? purchaseReturn.refundMode}
              {purchaseReturn.refundLedger ? ` — ${purchaseReturn.refundLedger.name}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="font-financial text-sm text-foreground">{purchaseReturn.grandTotal.toFixed(2)}</p>
          </div>
        </div>

        {purchaseReturn.reason ? <p className="text-sm text-muted-foreground">{purchaseReturn.reason}</p> : null}

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
              {purchaseReturn.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.purchaseInvoiceItem.productName} ({item.purchaseInvoiceItem.productCode})
                  </TableCell>
                  <TableCell>{item.purchaseInvoiceItem.warehouseName}</TableCell>
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
