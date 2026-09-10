import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditNoteStatusBadge } from "@/modules/credit-notes/components/credit-note-status-badge";
import { formatCreditNoteDate } from "@/modules/credit-notes/utils/format-credit-note-date";
import type { CreditNoteListRow } from "@/types/credit-note";

interface CreditNoteTableProps {
  creditNotes: CreditNoteListRow[];
}

export function CreditNoteTable({ creditNotes }: CreditNoteTableProps) {
  if (creditNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No credit notes found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Linked Invoice</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {creditNotes.map((creditNote) => (
          <TableRow key={creditNote.id}>
            <TableCell>
              <Link href={`/sales/credit-notes/${creditNote.id}`} className="font-medium text-foreground hover:underline">
                {creditNote.noteNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell>{creditNote.customer.name}</TableCell>
            <TableCell>{creditNote.salesInvoice?.invoiceNumber ?? "—"}</TableCell>
            <TableCell className="font-financial">{formatCreditNoteDate(creditNote.noteDate)}</TableCell>
            <TableCell>
              <CreditNoteStatusBadge status={creditNote.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{creditNote.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/sales/credit-notes/${creditNote.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
