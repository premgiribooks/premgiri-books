import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { BranchForm } from "@/modules/branch/components/branch-form";

export default async function NewBranchPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "company", "create");
  if (!canCreate) {
    redirect("/branch");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Branch</h1>
          <p className="text-sm text-muted-foreground">
            Add a new branch for the active company.
          </p>
        </div>

        <BranchForm />
      </div>
    </AppShell>
  );
}
