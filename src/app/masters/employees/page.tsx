import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { EmployeeFilterBar } from "@/modules/employees/components/employee-filter-bar";
import { EmployeeTable } from "@/modules/employees/components/employee-table";
import { employeeService } from "@/modules/employees/services/employee-service";
import type { EmployeeListFilters } from "@/types/employee";

interface EmployeeListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see employee-filter-bar.tsx); unknown values
// are ignored rather than erroring — a hand-edited query string just falls
// back to the unfiltered list (customer-management's identical convention).
function parseFilters(params: Record<string, string | string[] | undefined>): EmployeeListFilters {
  const filters: EmployeeListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status === "active" || status === "inactive") {
    filters.status = status;
  }

  return filters;
}

export default async function EmployeeListPage({ searchParams }: EmployeeListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "employees", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [employees, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    employeeService.listEmployees(filters),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "employees", "create"),
    hasPermission(user, "employees", "edit"),
    hasPermission(user, "employees", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Employees</h1>
            <p className="text-sm text-muted-foreground">
              Manage the company&apos;s staff — the master Attendance and Payroll will reference.
            </p>
          </div>
          {canCreate ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/masters/employees/import">Import</Link>}
              />
              <Button
                nativeButton={false}
                render={
                  <Link href="/masters/employees/new">
                    <Plus size={18} />
                    New Employee
                  </Link>
                }
              />
            </div>
          ) : null}
        </div>

        <EmployeeFilterBar />

        <EmployeeTable employees={employees} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
