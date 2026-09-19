import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { BulkImportWizard } from "@/modules/bulk-import/components/bulk-import-wizard";

export default async function ImportPriceListsPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/price-lists");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Price Lists</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-create price list headers from an .xlsx or .csv file — each row goes through the same validation
            as the Create Price List form. Line items are added afterward from each price list&apos;s detail
            screen.
          </p>
        </div>

        <BulkImportWizard target="price-lists" targetLabel="Price Lists" listHref="/masters/price-lists" />
      </div>
    </AppShell>
  );
}
