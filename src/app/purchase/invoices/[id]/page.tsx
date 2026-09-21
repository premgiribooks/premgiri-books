import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseInvoiceStatusActions } from "@/modules/purchase-invoices/components/purchase-invoice-status-actions";
import { PurchaseInvoiceStatusBadge } from "@/modules/purchase-invoices/components/purchase-invoice-status-badge";
import { formatPurchaseInvoiceDate } from "@/modules/purchase-invoices/utils/format-purchase-invoice-date";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";

interface PurchaseInvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PurchaseInvoiceDetailPage({ params }: PurchaseInvoiceDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const purchaseInvoice = await purchaseInvoiceService.getPurchaseInvoice(id);
  if (!purchaseInvoice) {
    notFound();
  }

  const [isAdmin, canPost, canCancel, canRecordPayment] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "create"),
    hasPermission(user, "purchase", "approve"),
    hasPermission(user, "accounting", "create"),
  ]);

  const isEditable = purchaseInvoice.status === "DRAFT";
  const totalTax = purchaseInvoice.totalCgst + purchaseInvoice.totalSgst + purchaseInvoice.totalIgst + purchaseInvoice.totalCess;
  // Full-or-partial "clear the remaining balance" shortcut — jumps to
  // Payment Voucher's existing New screen with this invoice's own
  // outstanding supplier balance pre-filled, reusing
  // 87-liability-settlement.md's own prefill query params
  // (`debitLedgerId`/`amount`) but scoped to this one document's own due
  // amount rather than the supplier ledger's entire running balance.
  const amountDue = Math.round((purchaseInvoice.grandTotal - purchaseInvoice.amountPaid) * 100) / 100;
  const canShowPaymentAction = canRecordPayment && purchaseInvoice.status === "POSTED" && amountDue > 0;

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{purchaseInvoice.invoiceNumber ?? "Draft"}</h1>
              <PurchaseInvoiceStatusBadge status={purchaseInvoice.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {purchaseInvoice.supplier.name} &middot; Supplier Invoice {purchaseInvoice.supplierInvoiceNumber}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/purchase/invoices/${purchaseInvoice.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            {canShowPaymentAction ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/accounting/payment-vouchers/new?debitLedgerId=${purchaseInvoice.supplier.ledgerId}&amount=${amountDue}`}>
                    Payment
                  </Link>
                }
              />
            ) : null}
            <PurchaseInvoiceStatusActions purchaseInvoice={purchaseInvoice} canPost={canPost} canCancel={canCancel} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Invoice Date</p>
            <p className="font-financial text-sm text-foreground">{formatPurchaseInvoiceDate(purchaseInvoice.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Place of Supply</p>
            <p className="text-sm text-foreground">{purchaseInvoice.placeOfSupplyStateCode}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tax</p>
            <p className="font-financial text-sm text-foreground">{totalTax.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid / Grand Total</p>
            <p className="font-financial text-sm text-foreground">
              {purchaseInvoice.amountPaid.toFixed(2)} / {purchaseInvoice.grandTotal.toFixed(2)}
            </p>
          </div>
          {purchaseInvoice.purchaseOrder ? (
            <div>
              <p className="text-xs text-muted-foreground">Linked Purchase Order</p>
              <p className="text-sm text-foreground">
                <Link href={`/purchase/orders/${purchaseInvoice.purchaseOrder.id}`} className="text-primary hover:underline">
                  {purchaseInvoice.purchaseOrder.orderNumber}
                </Link>
              </p>
            </div>
          ) : null}
          {purchaseInvoice.goodsReceiptNote ? (
            <div>
              <p className="text-xs text-muted-foreground">Linked Goods Receipt Note</p>
              <p className="text-sm text-foreground">
                <Link href={`/purchase/receipts/${purchaseInvoice.goodsReceiptNote.id}`} className="text-primary hover:underline">
                  {purchaseInvoice.goodsReceiptNote.grnNumber}
                </Link>
              </p>
            </div>
          ) : null}
        </div>

        {purchaseInvoice.narration ? <p className="text-sm text-muted-foreground">{purchaseInvoice.narration}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseInvoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.product.name}
                    {item.product.productCode ? ` (${item.product.productCode})` : ""}
                  </TableCell>
                  <TableCell>{item.warehouse.name}</TableCell>
                  <TableCell className="text-right font-financial">{item.quantity}</TableCell>
                  <TableCell className="text-right font-financial">{item.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial">{item.taxableAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial">{item.totalAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {purchaseInvoice.payments.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseInvoice.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.ledger.name}</TableCell>
                    <TableCell>{payment.paymentMode.name}</TableCell>
                    <TableCell>{payment.reference ?? "—"}</TableCell>
                    <TableCell className="text-right font-financial">{payment.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
