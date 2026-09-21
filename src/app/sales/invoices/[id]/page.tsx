import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesInvoiceDownloadPdfButton } from "@/modules/sales-invoices/components/sales-invoice-download-pdf-button";
import { SalesInvoicePrintButton } from "@/modules/sales-invoices/components/sales-invoice-print-button";
import { SalesInvoiceStatusActions } from "@/modules/sales-invoices/components/sales-invoice-status-actions";
import { SalesInvoiceStatusBadge } from "@/modules/sales-invoices/components/sales-invoice-status-badge";
import { formatSalesInvoiceDate } from "@/modules/sales-invoices/utils/format-sales-invoice-date";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";

interface SalesInvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

function customerDisplayName(
  customer: { name: string } | null,
  quickCustomerName: string | null,
  customerMode: string,
): string {
  if (customer) {
    return customer.name;
  }
  if (customerMode === "QUICK") {
    return quickCustomerName ?? "Quick Customer";
  }
  return quickCustomerName ? `Walk-in — ${quickCustomerName}` : "Walk-in";
}

export default async function SalesInvoiceDetailPage({
  params,
}: SalesInvoiceDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const salesInvoice = await salesInvoiceService.getSalesInvoice(id);
  if (!salesInvoice) {
    notFound();
  }

  const [isAdmin, canPost, canCancel, canCreateReturn, canRecordReceipt] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
    hasPermission(user, "sales", "approve"),
    hasPermission(user, "sales", "create"),
    hasPermission(user, "accounting", "create"),
  ]);

  const isEditable = salesInvoice.status === "DRAFT";
  // Full-or-partial "clear the remaining balance" shortcut — jumps to
  // Receipt Voucher's existing New screen with this invoice's own
  // outstanding customer balance pre-filled, mirroring
  // 87-liability-settlement.md's "Settle" pattern but scoped to this one
  // document's own due amount rather than the customer ledger's entire
  // running balance. Only meaningful for a POSTED invoice against a real
  // (PERMANENT) customer with money still due — a WALK_IN/QUICK sale must
  // already sum its payments to the full grand total to post at all, so
  // amountDue is always 0 there.
  const amountDue = Math.round((salesInvoice.grandTotal - salesInvoice.amountPaid) * 100) / 100;
  const canShowReceiptAction =
    canRecordReceipt && salesInvoice.status === "POSTED" && Boolean(salesInvoice.customer?.ledgerId) && amountDue > 0;

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">
                {salesInvoice.invoiceNumber}
              </h1>
              <SalesInvoiceStatusBadge status={salesInvoice.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {customerDisplayName(
                salesInvoice.customer,
                salesInvoice.quickCustomerName,
                salesInvoice.customerMode,
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/sales/invoices/${salesInvoice.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            {salesInvoice.status !== "DRAFT" ? (
              <SalesInvoicePrintButton salesInvoiceId={salesInvoice.id} />
            ) : null}
            {salesInvoice.status !== "DRAFT" ? (
              <SalesInvoiceDownloadPdfButton salesInvoiceId={salesInvoice.id} />
            ) : null}
            {canCreateReturn && salesInvoice.status === "POSTED" ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={`/sales/returns/new?salesInvoiceId=${salesInvoice.id}`}
                  >
                    Create Return
                  </Link>
                }
              />
            ) : null}
            {canShowReceiptAction ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={`/accounting/receipt-vouchers/new?creditLedgerId=${salesInvoice.customer?.ledgerId}&amount=${amountDue}`}
                  >
                    Receipt
                  </Link>
                }
              />
            ) : null}
            <SalesInvoiceStatusActions
              salesInvoice={salesInvoice}
              canPost={canPost}
              canCancel={canCancel}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Invoice Date</p>
            <p className="font-financial text-sm text-foreground">
              {formatSalesInvoiceDate(salesInvoice.invoiceDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Place of Supply</p>
            <p className="text-sm text-foreground">
              {salesInvoice.placeOfSupplyStateCode}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid / Grand Total</p>
            <p className="font-financial text-sm text-foreground">
              {salesInvoice.amountPaid.toFixed(2)} /{" "}
              {salesInvoice.grandTotal.toFixed(2)}
            </p>
          </div>
        </div>

        {salesInvoice.narration ? (
          <p className="text-sm text-muted-foreground">
            {salesInvoice.narration}
          </p>
        ) : null}

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
              {salesInvoice.items.map((item) => (
                <TableRow key={item.id}>
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
                  <TableCell className="text-right font-financial">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right font-financial">
                    {item.rate.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-financial">
                    {item.taxableAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-financial">
                    {item.totalAmount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {salesInvoice.payments.length > 0 ? (
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
                {salesInvoice.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.ledger.name}</TableCell>
                    <TableCell>{payment.paymentMode.name}</TableCell>
                    <TableCell>{payment.reference ?? "—"}</TableCell>
                    <TableCell className="text-right font-financial">
                      {payment.amount.toFixed(2)}
                    </TableCell>
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
