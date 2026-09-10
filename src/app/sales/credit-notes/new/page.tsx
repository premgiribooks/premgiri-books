import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CreditNoteForm } from "@/modules/credit-notes/components/credit-note-form";
import { creditNoteService } from "@/modules/credit-notes/services/credit-note-service";

export default async function NewCreditNotePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "sales", "create");
  if (!canCreate) {
    redirect("/sales/credit-notes");
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), creditNoteService.listCreditNoteFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Credit Note</h1>
          <p className="text-sm text-muted-foreground">
            A pure financial adjustment reducing what a customer owes — no stock movement.
          </p>
        </div>

        <CreditNoteForm options={options} />
      </div>
    </AppShell>
  );
}
