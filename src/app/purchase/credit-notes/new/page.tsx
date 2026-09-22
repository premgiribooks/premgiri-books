import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseCreditNoteForm } from "@/modules/purchase-credit-notes/components/purchase-credit-note-form";
import { purchaseCreditNoteService } from "@/modules/purchase-credit-notes/services/purchase-credit-note-service";

export default async function NewPurchaseCreditNotePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "purchase", "create");
  if (!canCreate) {
    redirect("/purchase/credit-notes");
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), purchaseCreditNoteService.listPurchaseCreditNoteFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Credit Note</h1>
          <p className="text-sm text-muted-foreground">
            A pure financial adjustment reducing what the company owes a supplier — no stock movement.
          </p>
        </div>

        <PurchaseCreditNoteForm options={options} />
      </div>
    </AppShell>
  );
}
