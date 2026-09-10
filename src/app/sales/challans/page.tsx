import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { customerService } from "@/modules/customers/services/customer-service";
import { DeliveryChallanFilterBar } from "@/modules/delivery-challans/components/delivery-challan-filter-bar";
import { DeliveryChallanTable } from "@/modules/delivery-challans/components/delivery-challan-table";
import { deliveryChallanService } from "@/modules/delivery-challans/services/delivery-challan-service";
import { DELIVERY_CHALLAN_STATUS_VALUES } from "@/modules/delivery-challans/validation/delivery-challan-schema";
import type { DeliveryChallanListFilters, DeliveryChallanStatusFilter } from "@/types/delivery-challan";

interface DeliveryChallanListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see delivery-challan-filter-bar.tsx);
// unknown values are ignored rather than erroring — mirrors the sales order
// list page's identical convention.
function parseFilters(params: Record<string, string | string[] | undefined>): DeliveryChallanListFilters {
  const filters: DeliveryChallanListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (DELIVERY_CHALLAN_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as DeliveryChallanStatusFilter;
  }

  const customerId = firstValue(params.customerId);
  if (customerId) {
    filters.customerId = customerId;
  }

  return filters;
}

export default async function DeliveryChallanListPage({ searchParams }: DeliveryChallanListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [deliveryChallans, customers, isAdmin, canCreate] = await Promise.all([
    deliveryChallanService.listDeliveryChallans(filters),
    customerService.listSelectableCustomers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Delivery Challans</h1>
            <p className="text-sm text-muted-foreground">
              Dispatch/goods-movement records between a confirmed Sales Order and the eventual Sales
              Invoice.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/sales/challans/new">
                  <Plus size={18} />
                  New Delivery Challan
                </Link>
              }
            />
          ) : null}
        </div>

        <DeliveryChallanFilterBar
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customer.ledger.name,
            isActive: customer.isActive,
          }))}
        />

        <DeliveryChallanTable deliveryChallans={deliveryChallans} />
      </div>
    </AppShell>
  );
}
