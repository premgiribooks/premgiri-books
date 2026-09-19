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
import { QuotationDownloadPdfButton } from "@/modules/quotations/components/quotation-download-pdf-button";
import { QuotationStatusActions } from "@/modules/quotations/components/quotation-status-actions";
import { QuotationStatusBadge } from "@/modules/quotations/components/quotation-status-badge";
import { QuotationTotalsSummary } from "@/modules/quotations/components/quotation-totals-summary";
import { formatQuotationDate } from "@/modules/quotations/utils/format-quotation-date";
import { quotationService } from "@/modules/quotations/services/quotation-service";

interface QuotationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuotationDetailPage({ params }: QuotationDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const quotation = await quotationService.getQuotation(id);
  if (!quotation) {
    notFound();
  }

  const [isAdmin, canEdit, canApprove, canCreateSalesOrder] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "edit"),
    hasPermission(user, "sales", "approve"),
    hasPermission(user, "sales", "create"),
  ]);

  const isEditable = quotation.status === "DRAFT" || quotation.status === "SENT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{quotation.quotationNumber}</h1>
              <QuotationStatusBadge status={quotation.status} />
            </div>
            <p className="text-sm text-muted-foreground">{quotation.customer.name}</p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/sales/quotations/${quotation.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <QuotationDownloadPdfButton quotationId={quotation.id} />
            <QuotationStatusActions
              quotation={quotation}
              canEdit={canEdit}
              canApprove={canApprove}
              canCreateSalesOrder={canCreateSalesOrder}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Quotation Date</p>
            <p className="font-financial text-sm text-foreground">
              {formatQuotationDate(quotation.quotationDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valid Until</p>
            <p className="font-financial text-sm text-foreground">
              {quotation.validUntil ? formatQuotationDate(quotation.validUntil) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Place of Supply</p>
            <p className="text-sm text-foreground">{quotation.placeOfSupplyStateCode}</p>
          </div>
        </div>

        {quotation.narration ? (
          <p className="text-sm text-muted-foreground">{quotation.narration}</p>
        ) : null}

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
              {quotation.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.product.name} ({item.product.productCode})
                    {!item.product.isActive ? (
                      <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span>
                    ) : null}
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
            subtotal: quotation.subtotal,
            totalDiscount: quotation.totalDiscount,
            taxableAmount: quotation.taxableAmount,
            totalCgst: quotation.totalCgst,
            totalSgst: quotation.totalSgst,
            totalIgst: quotation.totalIgst,
            totalCess: quotation.totalCess,
            grandTotal: quotation.grandTotal,
          }}
          groups={[]}
        />
      </div>
    </AppShell>
  );
}
