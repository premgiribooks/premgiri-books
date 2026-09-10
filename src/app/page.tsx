import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompany } from "@/lib/current-company";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentBranch } from "@/lib/current-branch";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { branchService } from "@/modules/branch/services/branch-service";

export default async function Home() {
  const company = await getCurrentCompany();

  if (!company) {
    redirect("/company/select");
  }

  const financialYear = await getCurrentFinancialYear();

  if (!financialYear) {
    redirect("/financial-year/select");
  }

  // Unlike Company/Financial Year, a null branch is only a redirect when the
  // company actually has selectable branches — a company with zero active
  // branches is a fully-supported state and must render normally
  // (12-branch-management.md's Branch Selection rules).
  const branch = await getCurrentBranch();
  if (!branch) {
    const selectableBranches = await branchService.listSelectableBranches();
    if (selectableBranches.length > 0) {
      redirect("/branch/select");
    }
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Premgiri Books ERP — application shell ready.
        </p>
      </div>
    </AppShell>
  );
}
