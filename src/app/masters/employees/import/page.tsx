import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { BulkImportWizard } from "@/modules/bulk-import/components/bulk-import-wizard";

export default async function ImportEmployeesPage() {
  const user = await getCurrentCompanyUser();
  // Employees is gated on the "employees" permission module, not "masters"
  // — matching employeeService.createEmployee's own gate and the list
  // page's canCreate check (src/app/masters/employees/page.tsx), the one
  // target in this whole feature routed to a different permission module.
  const canCreate = await hasPermission(user, "employees", "create");
  if (!canCreate) {
    redirect("/masters/employees");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Employees</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-create employees from an .xlsx or .csv file — each row goes through the same validation as the
            Create Employee form.
          </p>
        </div>

        <BulkImportWizard target="employees" targetLabel="Employees" listHref="/masters/employees" />
      </div>
    </AppShell>
  );
}
