import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CreditNoteDownloadPdfButton } from "@/modules/credit-notes/components/credit-note-download-pdf-button";
import { CreditNoteStatusActions } from "@/modules/credit-notes/components/credit-note-status-actions";
import { CreditNoteStatusBadge } from "@/modules/credit-notes/components/credit-note-status-badge";
import { formatCreditNoteDate } from "@/modules/credit-notes/utils/format-credit-note-date";
import { creditNoteService } from "@/modules/credit-notes/services/credit-note-service";

interface CreditNoteDetailPageProps {
  params: Promise<{ id: string }>;
}

const REFUND_MODE_LABELS: Record<string, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

export default async function CreditNoteDetailPage({ params }: CreditNoteDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const creditNote = await creditNoteService.getCreditNote(id);
  if (!creditNote) {
    notFound();
  }

  const [isAdmin, canPost, canCancel] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "approve"),
    hasPermission(user, "sales", "approve"),
  ]);

  const isEditable = creditNote.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{creditNote.noteNumber ?? "Draft Credit Note"}</h1>
              <CreditNoteStatusBadge status={creditNote.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {creditNote.customer.name}
              {creditNote.salesInvoice ? (
                <>
                  {" "}
                  — against invoice{" "}
                  <Link href={`/sales/invoices/${creditNote.salesInvoice.id}`} className="hover:underline">
                    {creditNote.salesInvoice.invoiceNumber}
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
                  <Link href={`/sales/credit-notes/${creditNote.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <CreditNoteDownloadPdfButton creditNoteId={creditNote.id} />
            <CreditNoteStatusActions creditNote={creditNote} canPost={canPost} canCancel={canCancel} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Note Date</p>
            <p className="font-financial text-sm text-foreground">{formatCreditNoteDate(creditNote.noteDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Refund Mode</p>
            <p className="text-sm text-foreground">
              {REFUND_MODE_LABELS[creditNote.refundMode] ?? creditNote.refundMode}
              {creditNote.refundLedger ? ` — ${creditNote.refundLedger.name}` : ""}
              {creditNote.paymentMode ? ` (${creditNote.paymentMode.name})` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="font-financial text-sm text-foreground">{creditNote.grandTotal.toFixed(2)}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{creditNote.reason}</p>

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
              {creditNote.items.map((item) => (
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
