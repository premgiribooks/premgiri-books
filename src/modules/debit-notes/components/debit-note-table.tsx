import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DebitNoteStatusBadge } from "@/modules/debit-notes/components/debit-note-status-badge";
import { formatDebitNoteDate } from "@/modules/debit-notes/utils/format-debit-note-date";
import type { DebitNoteListRow } from "@/types/debit-note";

interface DebitNoteTableProps {
  debitNotes: DebitNoteListRow[];
}

export function DebitNoteTable({ debitNotes }: DebitNoteTableProps) {
  if (debitNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No debit notes found.</p>
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
        {debitNotes.map((debitNote) => (
          <TableRow key={debitNote.id}>
            <TableCell>
              <Link href={`/sales/debit-notes/${debitNote.id}`} className="font-medium text-foreground hover:underline">
                {debitNote.noteNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell>{debitNote.customer.name}</TableCell>
            <TableCell>{debitNote.salesInvoice?.invoiceNumber ?? "—"}</TableCell>
            <TableCell className="font-financial">{formatDebitNoteDate(debitNote.noteDate)}</TableCell>
            <TableCell>
              <DebitNoteStatusBadge status={debitNote.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{debitNote.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/sales/debit-notes/${debitNote.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
