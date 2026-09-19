import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { EmployeeReportFilterBar } from "@/modules/reports/employees/components/employee-report-filter-bar";
import { EmployeeSalaryRegisterTable } from "@/modules/reports/employees/components/employee-salary-register-table";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";
import type { SalaryRegisterReport } from "@/types/employee-report";

interface SalaryRegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalaryRegisterReportPage({ searchParams }: SalaryRegisterPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, employees, financialYears] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    employeeReportService.listEmployeeOptions(),
    financialYearService.listFinancialYears(user.companyId),
  ]);

  const employeeId = firstValue(resolvedParams.employeeId);
  const financialYearId = firstValue(resolvedParams.financialYearId);
  const dateFrom = firstValue(resolvedParams.dateFrom);
  const dateTo = firstValue(resolvedParams.dateTo);

  let report: SalaryRegisterReport | null = null;
  let errorMessage: string | null = null;
  if (employeeId) {
    try {
      report = await employeeReportService.getSalaryRegister({ employeeId, financialYearId, dateFrom, dateTo });
    } catch (error) {
      errorMessage = toActionErrorMessage(error);
    }
  }

  let downloadUrl: string | undefined;
  if (employeeId) {
    const exportParams = new URLSearchParams({ employeeId });
    if (financialYearId) {
      exportParams.set("financialYearId", financialYearId);
    }
    if (dateFrom) {
      exportParams.set("dateFrom", dateFrom);
    }
    if (dateTo) {
      exportParams.set("dateTo", dateTo);
    }
    downloadUrl = `/reports/employees/salary-register/export?${exportParams.toString()}`;
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Salary Register</h1>
            <p className="text-sm text-muted-foreground">One employee&apos;s posted salary history across payroll runs.</p>
          </div>
          <ReportExportButton downloadUrl={downloadUrl} />
        </div>

        <EmployeeReportFilterBar employees={employees} employeeRequired showDateRange financialYears={financialYears} />

        {!employeeId ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select an employee to view their salary register.</p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <EmployeeSalaryRegisterTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
