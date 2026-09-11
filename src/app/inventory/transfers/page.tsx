import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { StockTransferFilterBar } from "@/modules/stock-transfers/components/stock-transfer-filter-bar";
import { StockTransferTable } from "@/modules/stock-transfers/components/stock-transfer-table";
import { stockTransferService } from "@/modules/stock-transfers/services/stock-transfer-service";
import { STOCK_TRANSFER_STATUS_VALUES, isValidCalendarDate, toUtcDate } from "@/modules/stock-transfers/validation/stock-transfer-schema";
import type { StockTransferListFilters, StockTransferStatusFilter } from "@/types/stock-transfer";

interface StockTransferListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): StockTransferListFilters {
  const filters: StockTransferListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (STOCK_TRANSFER_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as StockTransferStatusFilter;
  }

  const sourceWarehouseId = firstValue(params.sourceWarehouseId);
  if (sourceWarehouseId) {
    filters.sourceWarehouseId = sourceWarehouseId;
  }

  const destinationWarehouseId = firstValue(params.destinationWarehouseId);
  if (destinationWarehouseId) {
    filters.destinationWarehouseId = destinationWarehouseId;
  }

  const fromDate = firstValue(params.fromDate);
  if (fromDate && isValidCalendarDate(fromDate)) {
    filters.fromDate = toUtcDate(fromDate);
  }

  const toDate = firstValue(params.toDate);
  if (toDate && isValidCalendarDate(toDate)) {
    filters.toDate = toUtcDate(toDate);
  }

  return filters;
}

export default async function StockTransferListPage({ searchParams }: StockTransferListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [stockTransfers, options, isAdmin, canCreate] = await Promise.all([
    stockTransferService.listStockTransfers(filters),
    stockTransferService.listFormOptions(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "inventory", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Stock Transfers</h1>
            <p className="text-sm text-muted-foreground">Move stock for one or more products between two warehouses.</p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/inventory/transfers/new">
                  <Plus size={18} />
                  New Stock Transfer
                </Link>
              }
            />
          ) : null}
        </div>

        <StockTransferFilterBar warehouses={options.warehouses} />

        <StockTransferTable stockTransfers={stockTransfers} />
      </div>
    </AppShell>
  );
}
