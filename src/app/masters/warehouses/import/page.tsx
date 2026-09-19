import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { BulkImportWizard } from "@/modules/bulk-import/components/bulk-import-wizard";

export default async function ImportWarehousesPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/warehouses");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-create warehouses from an .xlsx or .csv file — each row goes through the same validation as the
            Create Warehouse form.
          </p>
        </div>

        <BulkImportWizard target="warehouses" targetLabel="Warehouses" listHref="/masters/warehouses" />
      </div>
    </AppShell>
  );
}
