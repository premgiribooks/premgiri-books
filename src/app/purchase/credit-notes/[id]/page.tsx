import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseCreditNoteStatusActions } from "@/modules/purchase-credit-notes/components/purchase-credit-note-status-actions";
import { PurchaseCreditNoteStatusBadge } from "@/modules/purchase-credit-notes/components/purchase-credit-note-status-badge";
import { formatPurchaseCreditNoteDate } from "@/modules/purchase-credit-notes/utils/format-purchase-credit-note-date";
import { purchaseCreditNoteService } from "@/modules/purchase-credit-notes/services/purchase-credit-note-service";

interface PurchaseCreditNoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PurchaseCreditNoteDetailPage({ params }: PurchaseCreditNoteDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const purchaseCreditNote = await purchaseCreditNoteService.getPurchaseCreditNote(id);
  if (!purchaseCreditNote) {
    notFound();
  }

  const [isAdmin, canPost, canCancel] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "approve"),
    hasPermission(user, "purchase", "approve"),
  ]);

  const isEditable = purchaseCreditNote.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{purchaseCreditNote.noteNumber ?? "Draft Credit Note"}</h1>
              <PurchaseCreditNoteStatusBadge status={purchaseCreditNote.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {purchaseCreditNote.supplier.name}
              {purchaseCreditNote.purchaseInvoice ? (
                <>
                  {" "}
                  — against invoice{" "}
                  <Link href={`/purchase/invoices/${purchaseCreditNote.purchaseInvoice.id}`} className="hover:underline">
                    {purchaseCreditNote.purchaseInvoice.invoiceNumber}
                  </Link>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/purchase/credit-notes/${purchaseCreditNote.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <PurchaseCreditNoteStatusActions purchaseCreditNote={purchaseCreditNote} canPost={canPost} canCancel={canCancel} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Note Date</p>
            <p className="font-financial text-sm text-foreground">{formatPurchaseCreditNoteDate(purchaseCreditNote.noteDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Place of Supply</p>
            <p className="text-sm text-foreground">{purchaseCreditNote.placeOfSupplyStateCode}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="font-financial text-sm text-foreground">{purchaseCreditNote.grandTotal.toFixed(2)}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{purchaseCreditNote.reason}</p>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead className="text-right">Cess %</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseCreditNote.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right font-financial">{item.ratePercent}</TableCell>
                  <TableCell className="text-right font-financial">{item.cessPercent}</TableCell>
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
