import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PayrollRunCreateForm } from "@/modules/payroll/components/payroll-run-create-form";
import { payrollRunService } from "@/modules/payroll/services/payroll-run-service";

export default async function NewPayrollRunPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "employees", "create");
  if (!canCreate) {
    redirect("/");
  }

  const [isAdmin, formOptions] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    payrollRunService.listPayrollRunFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Payroll Run</h1>
          <p className="text-sm text-muted-foreground">
            Next number: {formOptions.nextPayrollNumber} (assigned only when this run is posted).
          </p>
        </div>

        <PayrollRunCreateForm isLedgerMappingComplete={formOptions.isLedgerMappingComplete} />
      </div>
    </AppShell>
  );
}
