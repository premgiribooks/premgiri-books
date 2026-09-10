import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { DeliveryChallanForm } from "@/modules/delivery-challans/components/delivery-challan-form";
import { deliveryChallanService } from "@/modules/delivery-challans/services/delivery-challan-service";

interface NewDeliveryChallanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewDeliveryChallanPage({ searchParams }: NewDeliveryChallanPageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "sales", "create");
  if (!canCreate) {
    redirect("/sales/challans");
  }

  const salesOrderId = firstValue((await searchParams).salesOrderId);

  const [isAdmin, options, salesOrderPrefill] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    deliveryChallanService.listDeliveryChallanFormOptions(),
    salesOrderId ? deliveryChallanService.getSalesOrderPrefill(salesOrderId) : Promise.resolve(null),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Delivery Challan</h1>
          <p className="text-sm text-muted-foreground">
            Record the quantity and warehouse dispatched to a customer.
          </p>
        </div>

        <DeliveryChallanForm options={options} salesOrderPrefill={salesOrderPrefill} />
      </div>
    </AppShell>
  );
}
