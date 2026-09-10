import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { DebitNoteForm } from "@/modules/debit-notes/components/debit-note-form";
import { debitNoteService } from "@/modules/debit-notes/services/debit-note-service";

interface EditDebitNotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDebitNotePage({ params }: EditDebitNotePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "sales", "edit");
  if (!canEdit) {
    redirect(`/sales/debit-notes/${id}`);
  }

  const debitNote = await debitNoteService.getDebitNote(id);
  if (!debitNote) {
    notFound();
  }

  // Only reachable while DRAFT (41-debit-note.md: "Editable while DRAFT")
  // — the service itself also rejects a non-DRAFT update, this just avoids
  // offering a doomed form.
  if (debitNote.status !== "DRAFT") {
    redirect(`/sales/debit-notes/${id}`);
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), debitNoteService.listDebitNoteFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Debit Note</h1>
          <p className="text-sm text-muted-foreground">Update the adjustment lines and reason.</p>
        </div>

        <DebitNoteForm options={options} debitNote={debitNote} />
      </div>
    </AppShell>
  );
}
