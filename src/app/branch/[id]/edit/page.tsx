import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { branchService } from "@/modules/branch/services/branch-service";
import { BranchForm } from "@/modules/branch/components/branch-form";

interface EditBranchPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBranchPage({ params }: EditBranchPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "company", "edit");
  if (!canEdit) {
    redirect("/branch");
  }

  const branch = await branchService.getBranch(id);
  if (!branch) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Branch — {branch.branchName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the branch&apos;s name, code, address, contact number, and GST registration.
          </p>
        </div>

        <BranchForm branch={branch} />
      </div>
    </AppShell>
  );
}
