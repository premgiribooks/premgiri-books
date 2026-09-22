import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreWarehousesAction } from "@/modules/warehouses/actions/warehouse-actions";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";
import { WarehouseTable } from "@/modules/warehouses/components/warehouse-table";

export default async function WarehouseListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const [{ items: warehouses, hasMore }, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    warehouseService.listWarehousesPage({}, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "masters", "create"),
    hasPermission(user, "masters", "edit"),
    hasPermission(user, "masters", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Warehouses</h1>
            <p className="text-sm text-muted-foreground">
              Manage the physical stock locations (godowns/stores) your products and stock
              documents will use.
            </p>
          </div>
          {canCreate ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/masters/warehouses/import">Import</Link>}
              />
              <Button
                nativeButton={false}
                render={
                  <Link href="/masters/warehouses/new">
                    <Plus size={18} />
                    New Warehouse
                  </Link>
                }
              />
            </div>
          ) : null}
        </div>

        <WarehouseTable
          warehouses={warehouses}
          initialHasMore={hasMore}
          loadMore={loadMoreWarehousesAction.bind(null, {})}
          canEdit={canEdit}
          canManage={canManage}
        />
      </div>
    </AppShell>
  );
}
