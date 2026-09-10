import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { DebitNoteForm } from "@/modules/debit-notes/components/debit-note-form";
import { debitNoteService } from "@/modules/debit-notes/services/debit-note-service";

export default async function NewDebitNotePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "sales", "create");
  if (!canCreate) {
    redirect("/sales/debit-notes");
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), debitNoteService.listDebitNoteFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Debit Note</h1>
          <p className="text-sm text-muted-foreground">
            A pure financial adjustment increasing what a customer owes — no stock movement.
          </p>
        </div>

        <DebitNoteForm options={options} />
      </div>
    </AppShell>
  );
}
