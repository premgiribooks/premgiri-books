import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CreditNoteForm } from "@/modules/credit-notes/components/credit-note-form";
import { creditNoteService } from "@/modules/credit-notes/services/credit-note-service";

interface EditCreditNotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCreditNotePage({ params }: EditCreditNotePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "sales", "edit");
  if (!canEdit) {
    redirect(`/sales/credit-notes/${id}`);
  }

  const creditNote = await creditNoteService.getCreditNote(id);
  if (!creditNote) {
    notFound();
  }

  // Only reachable while DRAFT (40-credit-note.md: "Editable while DRAFT")
  // — the service itself also rejects a non-DRAFT update, this just avoids
  // offering a doomed form.
  if (creditNote.status !== "DRAFT") {
    redirect(`/sales/credit-notes/${id}`);
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), creditNoteService.listCreditNoteFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Credit Note</h1>
          <p className="text-sm text-muted-foreground">Update the adjustment lines, refund mode, and reason.</p>
        </div>

        <CreditNoteForm options={options} creditNote={creditNote} />
      </div>
    </AppShell>
  );
}
