import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { DebitNoteDownloadPdfButton } from "@/modules/debit-notes/components/debit-note-download-pdf-button";
import { DebitNoteStatusActions } from "@/modules/debit-notes/components/debit-note-status-actions";
import { DebitNoteStatusBadge } from "@/modules/debit-notes/components/debit-note-status-badge";
import { formatDebitNoteDate } from "@/modules/debit-notes/utils/format-debit-note-date";
import { debitNoteService } from "@/modules/debit-notes/services/debit-note-service";

interface DebitNoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DebitNoteDetailPage({ params }: DebitNoteDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const debitNote = await debitNoteService.getDebitNote(id);
  if (!debitNote) {
    notFound();
  }

  const [isAdmin, canPost, canCancel] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "approve"),
    hasPermission(user, "sales", "approve"),
  ]);

  const isEditable = debitNote.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{debitNote.noteNumber ?? "Draft Debit Note"}</h1>
              <DebitNoteStatusBadge status={debitNote.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {debitNote.customer.name}
              {debitNote.salesInvoice ? (
                <>
                  {" "}
                  — against invoice{" "}
                  <Link href={`/sales/invoices/${debitNote.salesInvoice.id}`} className="hover:underline">
                    {debitNote.salesInvoice.invoiceNumber}
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
                  <Link href={`/sales/debit-notes/${debitNote.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <DebitNoteDownloadPdfButton debitNoteId={debitNote.id} />
            <DebitNoteStatusActions debitNote={debitNote} canPost={canPost} canCancel={canCancel} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Note Date</p>
            <p className="font-financial text-sm text-foreground">{formatDebitNoteDate(debitNote.noteDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="font-financial text-sm text-foreground">{debitNote.grandTotal.toFixed(2)}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{debitNote.reason}</p>

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
              {debitNote.items.map((item) => (
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
