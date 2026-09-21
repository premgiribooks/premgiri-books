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
import { GoodsReceiptNoteDownloadPdfButton } from "@/modules/goods-receipt-notes/components/goods-receipt-note-download-pdf-button";
import { GoodsReceiptNoteStatusActions } from "@/modules/goods-receipt-notes/components/goods-receipt-note-status-actions";
import { GoodsReceiptNoteStatusBadge } from "@/modules/goods-receipt-notes/components/goods-receipt-note-status-badge";
import { formatGoodsReceiptNoteDate } from "@/modules/goods-receipt-notes/utils/format-goods-receipt-note-date";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";

interface GoodsReceiptNoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function GoodsReceiptNoteDetailPage({ params }: GoodsReceiptNoteDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const goodsReceiptNote = await goodsReceiptNoteService.getGoodsReceiptNote(id);
  if (!goodsReceiptNote) {
    notFound();
  }

  const [isAdmin, canEdit, canCreateInvoice] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "edit"),
    hasPermission(user, "purchase", "create"),
  ]);

  const isEditable = goodsReceiptNote.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{goodsReceiptNote.grnNumber}</h1>
              <GoodsReceiptNoteStatusBadge status={goodsReceiptNote.status} />
            </div>
            <p className="text-sm text-muted-foreground">{goodsReceiptNote.supplier.name}</p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/purchase/receipts/${goodsReceiptNote.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <GoodsReceiptNoteDownloadPdfButton goodsReceiptNoteId={goodsReceiptNote.id} />
            <GoodsReceiptNoteStatusActions
              goodsReceiptNote={goodsReceiptNote}
              canEdit={canEdit}
              canCreateInvoice={canCreateInvoice}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">GRN Date</p>
            <p className="font-financial text-sm text-foreground">
              {formatGoodsReceiptNoteDate(goodsReceiptNote.grnDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Linked Purchase Order</p>
            <p className="text-sm text-foreground">
              {goodsReceiptNote.purchaseOrder ? (
                <Link
                  href={`/purchase/orders/${goodsReceiptNote.purchaseOrder.id}`}
                  className="text-primary hover:underline"
                >
                  {goodsReceiptNote.purchaseOrder.orderNumber}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        {goodsReceiptNote.narration ? (
          <p className="text-sm text-muted-foreground">{goodsReceiptNote.narration}</p>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Received Qty</TableHead>
                <TableHead className="text-right">Rejected Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goodsReceiptNote.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.product.name}
                    {item.product.productCode ? ` (${item.product.productCode})` : ""}
                    {!item.product.isActive ? (
                      <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {item.warehouse.name} ({item.warehouse.code})
                    {!item.warehouse.isActive ? (
                      <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-financial">{item.quantity}</TableCell>
                  <TableCell className="text-right font-financial">{item.rejectedQuantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
