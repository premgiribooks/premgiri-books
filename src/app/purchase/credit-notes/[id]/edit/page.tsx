import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseCreditNoteForm } from "@/modules/purchase-credit-notes/components/purchase-credit-note-form";
import { purchaseCreditNoteService } from "@/modules/purchase-credit-notes/services/purchase-credit-note-service";

interface EditPurchaseCreditNotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPurchaseCreditNotePage({ params }: EditPurchaseCreditNotePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "purchase", "edit");
  if (!canEdit) {
    redirect(`/purchase/credit-notes/${id}`);
  }

  const purchaseCreditNote = await purchaseCreditNoteService.getPurchaseCreditNote(id);
  if (!purchaseCreditNote) {
    notFound();
  }

  // Only reachable while DRAFT — the service itself also rejects a non-DRAFT
  // update, this just avoids offering a doomed form.
  if (purchaseCreditNote.status !== "DRAFT") {
    redirect(`/purchase/credit-notes/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    purchaseCreditNoteService.listPurchaseCreditNoteFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Credit Note</h1>
          <p className="text-sm text-muted-foreground">Update the adjustment lines and reason.</p>
        </div>

        <PurchaseCreditNoteForm options={options} purchaseCreditNote={purchaseCreditNote} />
      </div>
    </AppShell>
  );
}
