import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PhysicalVerificationForm } from "@/modules/physical-verifications/components/physical-verification-form";
import { physicalVerificationService } from "@/modules/physical-verifications/services/physical-verification-service";

export default async function NewPhysicalVerificationPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "inventory", "create");
  if (!canCreate) {
    redirect("/inventory/verifications");
  }

  const [options, isAdmin] = await Promise.all([physicalVerificationService.listFormOptions(), isCurrentUserCompanyAdmin()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Physical Verification</h1>
          <p className="text-sm text-muted-foreground">
            Record the physically counted quantity of each product being verified in one warehouse. Saved as a draft until completed.
          </p>
        </div>

        <PhysicalVerificationForm options={options} />
      </div>
    </AppShell>
  );
}
