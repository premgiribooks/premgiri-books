import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { EmployeeAttendanceSummaryTable } from "@/modules/reports/employees/components/employee-attendance-summary-table";
import { EmployeeReportFilterBar } from "@/modules/reports/employees/components/employee-report-filter-bar";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";
import { isValidCalendarDate } from "@/modules/reports/validation/financial-report-filters-schema";
import type { AttendanceSummaryReport } from "@/types/employee-report";

interface AttendanceSummaryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function defaultPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function defaultPeriodEnd(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export default async function AttendanceSummaryReportPage({ searchParams }: AttendanceSummaryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, employees, branches] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    employeeReportService.listEmployeeOptions(),
    employeeReportService.listBranchOptions(),
  ]);

  const periodStartParam = firstValue(resolvedParams.periodStart);
  const periodStart = periodStartParam && isValidCalendarDate(periodStartParam) ? periodStartParam : defaultPeriodStart();

  const periodEndParam = firstValue(resolvedParams.periodEnd);
  const periodEnd = periodEndParam && isValidCalendarDate(periodEndParam) ? periodEndParam : defaultPeriodEnd();

  const employeeId = firstValue(resolvedParams.employeeId);
  const branchId = firstValue(resolvedParams.branchId);

  let report: AttendanceSummaryReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await employeeReportService.getAttendanceSummaryReport({ periodStart, periodEnd, employeeId, branchId });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ periodStart, periodEnd });
  if (employeeId) {
    exportParams.set("employeeId", employeeId);
  }
  if (branchId) {
    exportParams.set("branchId", branchId);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Attendance Summary</h1>
            <p className="text-sm text-muted-foreground">
              Per-employee present/half-day/absent/on-leave counts for the selected period.
            </p>
          </div>
          <ReportExportButton
            downloadUrl={`/reports/employees/attendance-summary/export?${exportParams.toString()}`}
            pdfDownloadUrl={`/reports/employees/attendance-summary/export?${exportParams.toString()}&format=pdf`}
          />
        </div>

        <EmployeeReportFilterBar showPeriod employees={employees} branches={branches} />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <EmployeeAttendanceSummaryTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
