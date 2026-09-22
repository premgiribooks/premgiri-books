import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreStockAdjustmentsAction } from "@/modules/stock-adjustments/actions/stock-adjustment-actions";
import { StockAdjustmentFilterBar } from "@/modules/stock-adjustments/components/stock-adjustment-filter-bar";
import { StockAdjustmentTable } from "@/modules/stock-adjustments/components/stock-adjustment-table";
import { stockAdjustmentService } from "@/modules/stock-adjustments/services/stock-adjustment-service";
import { STOCK_ADJUSTMENT_STATUS_VALUES } from "@/modules/stock-adjustments/validation/stock-adjustment-schema";
import type { StockAdjustmentListFilters, StockAdjustmentStatusFilter } from "@/types/stock-adjustment";

interface StockAdjustmentListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): StockAdjustmentListFilters {
  const filters: StockAdjustmentListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (STOCK_ADJUSTMENT_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as StockAdjustmentStatusFilter;
  }

  return filters;
}

export default async function StockAdjustmentListPage({ searchParams }: StockAdjustmentListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: stockAdjustments, hasMore }, isAdmin, canCreate] = await Promise.all([
    stockAdjustmentService.listStockAdjustmentsPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "inventory", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Stock Adjustments</h1>
            <p className="text-sm text-muted-foreground">
              Correct stock for a reason other than a sale, purchase, transfer, or physical count.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/inventory/adjustments/new">
                  <Plus size={18} />
                  New Stock Adjustment
                </Link>
              }
            />
          ) : null}
        </div>

        <StockAdjustmentFilterBar />

        <StockAdjustmentTable
          key={JSON.stringify(filters)}
          stockAdjustments={stockAdjustments}
          initialHasMore={hasMore}
          loadMore={loadMoreStockAdjustmentsAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
