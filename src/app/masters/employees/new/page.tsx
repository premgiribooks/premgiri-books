import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { employeeService } from "@/modules/employees/services/employee-service";
import { EmployeeForm } from "@/modules/employees/components/employee-form";

export default async function NewEmployeePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "employees", "create");
  if (!canCreate) {
    redirect("/masters/employees");
  }

  const [isAdmin, branchOptions, userOptions] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    employeeService.listSelectableBranches(),
    employeeService.listAvailableUsersForLinking(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Employee</h1>
          <p className="text-sm text-muted-foreground">
            Add a new employee to the company&apos;s staff master.
          </p>
        </div>

        <EmployeeForm branchOptions={branchOptions} userOptions={userOptions} />
      </div>
    </AppShell>
  );
}
