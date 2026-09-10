import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { branchService } from "@/modules/branch/services/branch-service";
import { BranchTable } from "@/modules/branch/components/branch-table";

export default async function BranchListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "company", "view");
  if (!canView) {
    redirect("/");
  }

  const [branches, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    branchService.listBranches(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "company", "create"),
    hasPermission(user, "company", "edit"),
    hasPermission(user, "company", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Branches</h1>
            <p className="text-sm text-muted-foreground">
              Manage the company&apos;s branches and the branch you are working in. A company
              with no branches is a fully supported, single-location setup.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/branch/new">
                  <Plus size={18} />
                  New Branch
                </Link>
              }
            />
          ) : null}
        </div>

        <BranchTable branches={branches} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
