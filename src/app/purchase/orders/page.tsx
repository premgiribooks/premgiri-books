import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import { PurchaseOrderFilterBar } from "@/modules/purchase-orders/components/purchase-order-filter-bar";
import { PurchaseOrderTable } from "@/modules/purchase-orders/components/purchase-order-table";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";
import { PURCHASE_ORDER_STATUS_VALUES } from "@/modules/purchase-orders/validation/purchase-order-schema";
import type { PurchaseOrderListFilters, PurchaseOrderStatusFilter } from "@/types/purchase-order";

interface PurchaseOrderListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see purchase-order-filter-bar.tsx); unknown
// values are ignored rather than erroring — mirrors the sales order list
// page's identical convention.
function parseFilters(params: Record<string, string | string[] | undefined>): PurchaseOrderListFilters {
  const filters: PurchaseOrderListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (PURCHASE_ORDER_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as PurchaseOrderStatusFilter;
  }

  const supplierId = firstValue(params.supplierId);
  if (supplierId) {
    filters.supplierId = supplierId;
  }

  return filters;
}

export default async function PurchaseOrderListPage({ searchParams }: PurchaseOrderListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [purchaseOrders, suppliers, isAdmin, canCreate] = await Promise.all([
    purchaseOrderService.listPurchaseOrders(filters),
    supplierService.listSelectableSuppliers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">
              The company&apos;s commitment to buy from a Supplier, tracked through to receipt.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/purchase/orders/new">
                  <Plus size={18} />
                  New Purchase Order
                </Link>
              }
            />
          ) : null}
        </div>

        <PurchaseOrderFilterBar
          suppliers={suppliers.map((supplier) => ({
            id: supplier.id,
            name: supplier.ledger.name,
            isActive: supplier.isActive,
          }))}
        />

        <PurchaseOrderTable purchaseOrders={purchaseOrders} />
      </div>
    </AppShell>
  );
}
