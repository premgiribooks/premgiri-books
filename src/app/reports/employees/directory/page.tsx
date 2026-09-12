import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { EmployeeDirectoryTable } from "@/modules/reports/employees/components/employee-directory-table";
import { EmployeeReportFilterBar } from "@/modules/reports/employees/components/employee-report-filter-bar";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";
import type { EmployeeDirectoryReport } from "@/types/employee-report";

interface EmployeeDirectoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EmployeeDirectoryReportPage({ searchParams }: EmployeeDirectoryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, branches] = await Promise.all([isCurrentUserCompanyAdmin(), employeeReportService.listBranchOptions()]);

  const department = firstValue(resolvedParams.department);
  const designation = firstValue(resolvedParams.designation);
  const branchId = firstValue(resolvedParams.branchId);
  const statusParam = firstValue(resolvedParams.status);
  const status = statusParam === "all" || statusParam === "inactive" ? statusParam : "active";

  let report: EmployeeDirectoryReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await employeeReportService.getEmployeeDirectory({ department, designation, branchId, status });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employee Directory</h1>
          <p className="text-sm text-muted-foreground">Every employee&apos;s code, designation, department, branch, and status.</p>
        </div>

        <EmployeeReportFilterBar branches={branches} showDepartmentDesignation showEmployeeStatus />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <EmployeeDirectoryTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
