import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PayrollRunLineTable } from "@/modules/payroll/components/payroll-run-line-table";
import { PayrollRunStatusActions } from "@/modules/payroll/components/payroll-run-status-actions";
import { PayrollRunStatusBadge } from "@/modules/payroll/components/payroll-run-status-badge";
import { formatPayrollRunDate } from "@/modules/payroll/utils/format-payroll-run-date";
import { payrollRunService } from "@/modules/payroll/services/payroll-run-service";

interface PayrollRunDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PayrollRunDetailPage({ params }: PayrollRunDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "employees", "view");
  if (!canView) {
    redirect("/");
  }

  const payrollRun = await payrollRunService.getPayrollRun(id);
  if (!payrollRun) {
    notFound();
  }

  const [isAdmin, canRefresh, canApprove] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "employees", "create"),
    hasPermission(user, "employees", "approve"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{payrollRun.payrollNumber ?? "Draft"}</h1>
              <PayrollRunStatusBadge status={payrollRun.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatPayrollRunDate(payrollRun.periodStart)} – {formatPayrollRunDate(payrollRun.periodEnd)}
            </p>
          </div>

          <PayrollRunStatusActions payrollRun={payrollRun} canRefresh={canRefresh} canApprove={canApprove} />
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="font-financial text-sm text-foreground">
              {formatPayrollRunDate(payrollRun.periodStart)} – {formatPayrollRunDate(payrollRun.periodEnd)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Employees Included</p>
            <p className="font-financial text-sm text-foreground">{payrollRun.items.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Net Salary</p>
            <p className="font-financial text-sm text-foreground">{payrollRun.totalNetSalary.toFixed(2)}</p>
          </div>
        </div>

        {payrollRun.narration ? <p className="text-sm text-muted-foreground">{payrollRun.narration}</p> : null}

        <PayrollRunLineTable lines={payrollRun.items} totalNetSalary={payrollRun.totalNetSalary} />
      </div>
    </AppShell>
  );
}
