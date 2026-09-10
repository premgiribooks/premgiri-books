import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { DeliveryChallanForm } from "@/modules/delivery-challans/components/delivery-challan-form";
import { deliveryChallanService } from "@/modules/delivery-challans/services/delivery-challan-service";

interface EditDeliveryChallanPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDeliveryChallanPage({ params }: EditDeliveryChallanPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "sales", "edit");
  if (!canEdit) {
    redirect(`/sales/challans/${id}`);
  }

  const deliveryChallan = await deliveryChallanService.getDeliveryChallan(id);
  if (!deliveryChallan) {
    notFound();
  }

  // Only reachable while DRAFT (37-delivery-challans.md's Business Rules) —
  // the service itself also rejects a non-DRAFT update, this just avoids
  // offering a doomed form.
  if (deliveryChallan.status !== "DRAFT") {
    redirect(`/sales/challans/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    deliveryChallanService.listDeliveryChallanFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Delivery Challan — {deliveryChallan.challanNumber}
          </h1>
          <p className="text-sm text-muted-foreground">Update the customer, date, narration, and lines.</p>
        </div>

        <DeliveryChallanForm options={options} deliveryChallan={deliveryChallan} />
      </div>
    </AppShell>
  );
}
