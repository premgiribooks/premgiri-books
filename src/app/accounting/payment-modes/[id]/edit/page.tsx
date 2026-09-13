import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import { PaymentModeForm } from "@/modules/payment-modes/components/payment-mode-form";

interface EditPaymentModePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPaymentModePage({ params }: EditPaymentModePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "accounting", "edit");
  if (!canEdit) {
    redirect("/accounting/payment-modes");
  }

  const paymentMode = await paymentModeService.getPaymentMode(id);
  if (!paymentMode) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Payment Mode — {paymentMode.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the payment mode&apos;s name and ledger class.
          </p>
        </div>

        <PaymentModeForm paymentMode={paymentMode} />
      </div>
    </AppShell>
  );
}
