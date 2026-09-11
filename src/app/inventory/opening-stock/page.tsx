import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { OpeningStockFilterBar } from "@/modules/opening-stock/components/opening-stock-filter-bar";
import { OpeningStockTable } from "@/modules/opening-stock/components/opening-stock-table";
import { openingStockService } from "@/modules/opening-stock/services/opening-stock-service";
import type { OpeningStockListFilters } from "@/types/opening-stock";

interface OpeningStockListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): OpeningStockListFilters {
  const filters: OpeningStockListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const productId = firstValue(params.productId);
  if (productId) {
    filters.productId = productId;
  }

  const warehouseId = firstValue(params.warehouseId);
  if (warehouseId) {
    filters.warehouseId = warehouseId;
  }

  return filters;
}

export default async function OpeningStockListPage({ searchParams }: OpeningStockListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [entries, options, isAdmin, canCreate] = await Promise.all([
    openingStockService.listOpeningStockEntries(filters),
    openingStockService.listFormOptions(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "inventory", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Opening Stock</h1>
            <p className="text-sm text-muted-foreground">
              One-time starting stock quantity and cost recorded per product/warehouse, before any other movement exists.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/inventory/opening-stock/new">
                  <Plus size={18} />
                  New Opening Stock
                </Link>
              }
            />
          ) : null}
        </div>

        <OpeningStockFilterBar products={options.products} warehouses={options.warehouses} />

        <OpeningStockTable entries={entries} />
      </div>
    </AppShell>
  );
}
