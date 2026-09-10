import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { customerService } from "@/modules/customers/services/customer-service";
import { SalesOrderFilterBar } from "@/modules/sales-orders/components/sales-order-filter-bar";
import { SalesOrderTable } from "@/modules/sales-orders/components/sales-order-table";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";
import { SALES_ORDER_STATUS_VALUES } from "@/modules/sales-orders/validation/sales-order-schema";
import type { SalesOrderListFilters, SalesOrderStatusFilter } from "@/types/sales-order";

interface SalesOrderListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see sales-order-filter-bar.tsx); unknown
// values are ignored rather than erroring — mirrors the quotation list
// page's identical convention.
function parseFilters(params: Record<string, string | string[] | undefined>): SalesOrderListFilters {
  const filters: SalesOrderListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (SALES_ORDER_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as SalesOrderStatusFilter;
  }

  const customerId = firstValue(params.customerId);
  if (customerId) {
    filters.customerId = customerId;
  }

  return filters;
}

export default async function SalesOrderListPage({ searchParams }: SalesOrderListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [salesOrders, customers, isAdmin, canCreate] = await Promise.all([
    salesOrderService.listSalesOrders(filters),
    customerService.listSelectableCustomers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sales Orders</h1>
            <p className="text-sm text-muted-foreground">
              Confirmed customer commitments, tracked through to delivery.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/sales/orders/new">
                  <Plus size={18} />
                  New Sales Order
                </Link>
              }
            />
          ) : null}
        </div>

        <SalesOrderFilterBar
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customer.ledger.name,
            isActive: customer.isActive,
          }))}
        />

        <SalesOrderTable salesOrders={salesOrders} />
      </div>
    </AppShell>
  );
}
