import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { EmployeePayrollRegisterTable } from "@/modules/reports/employees/components/employee-payroll-register-table";
import { EmployeeReportFilterBar } from "@/modules/reports/employees/components/employee-report-filter-bar";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";
import type { PayrollRegisterReport } from "@/types/employee-report";

interface PayrollRegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PayrollRegisterReportPage({ searchParams }: PayrollRegisterPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYears] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    financialYearService.listFinancialYears(user.companyId),
  ]);

  const financialYearId = firstValue(resolvedParams.financialYearId);
  const dateFrom = firstValue(resolvedParams.dateFrom);
  const dateTo = firstValue(resolvedParams.dateTo);
  const statusParam = firstValue(resolvedParams.status);
  const status = statusParam === "DRAFT" || statusParam === "POSTED" || statusParam === "CANCELLED" || statusParam === "all"
    ? statusParam
    : undefined;

  let report: PayrollRegisterReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await employeeReportService.getPayrollRegister({ financialYearId, dateFrom, dateTo, status });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams();
  if (financialYearId) {
    exportParams.set("financialYearId", financialYearId);
  }
  if (dateFrom) {
    exportParams.set("dateFrom", dateFrom);
  }
  if (dateTo) {
    exportParams.set("dateTo", dateTo);
  }
  if (status) {
    exportParams.set("status", status);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Payroll Register</h1>
            <p className="text-sm text-muted-foreground">Every payroll run&apos;s number, period, total net salary, and status.</p>
          </div>
          <ReportExportButton downloadUrl={`/reports/employees/payroll-register/export?${exportParams.toString()}`} />
        </div>

        <EmployeeReportFilterBar showDateRange financialYears={financialYears} showPayrollStatus />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <EmployeePayrollRegisterTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
