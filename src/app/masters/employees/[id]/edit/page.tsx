import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { employeeService } from "@/modules/employees/services/employee-service";
import { EmployeeForm } from "@/modules/employees/components/employee-form";

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "employees", "edit");
  if (!canEdit) {
    redirect("/masters/employees");
  }

  const employee = await employeeService.getEmployee(id);
  if (!employee) {
    notFound();
  }

  const [isAdmin, branchOptions, userOptions] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    // Includes the employee's current branch even if since deactivated, so
    // the stored value stays visible and re-selectable (labeled "(Inactive)").
    employeeService.listSelectableBranches(employee.branchId ?? undefined),
    employeeService.listAvailableUsersForLinking(employee.userId ?? undefined),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Employee — {employee.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update this employee&apos;s identity, contact, address, branch/login link, and salary.
          </p>
        </div>

        <EmployeeForm employee={employee} branchOptions={branchOptions} userOptions={userOptions} />
      </div>
    </AppShell>
  );
}
