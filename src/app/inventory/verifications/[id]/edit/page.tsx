import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PhysicalVerificationForm } from "@/modules/physical-verifications/components/physical-verification-form";
import { physicalVerificationService } from "@/modules/physical-verifications/services/physical-verification-service";

interface EditPhysicalVerificationPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPhysicalVerificationPage({ params }: EditPhysicalVerificationPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "inventory", "edit");
  if (!canEdit) {
    redirect(`/inventory/verifications/${id}`);
  }

  const physicalVerification = await physicalVerificationService.getPhysicalVerification(id);
  if (!physicalVerification) {
    notFound();
  }

  // Only reachable while DRAFT (49-physical-verification.md: "Editable
  // while DRAFT") — the service itself also rejects a non-DRAFT update,
  // this just avoids offering a doomed form.
  if (physicalVerification.status !== "DRAFT") {
    redirect(`/inventory/verifications/${id}`);
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), physicalVerificationService.listFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Physical Verification</h1>
          <p className="text-sm text-muted-foreground">Update the warehouse, date, and counted lines.</p>
        </div>

        <PhysicalVerificationForm options={options} physicalVerification={physicalVerification} />
      </div>
    </AppShell>
  );
}
