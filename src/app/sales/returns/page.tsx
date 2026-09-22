import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreSalesReturnsAction } from "@/modules/sales-returns/actions/sales-return-actions";
import { SalesReturnFilterBar } from "@/modules/sales-returns/components/sales-return-filter-bar";
import { SalesReturnTable } from "@/modules/sales-returns/components/sales-return-table";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";
import { SALES_RETURN_STATUS_VALUES } from "@/modules/sales-returns/validation/sales-return-schema";
import type { SalesReturnListFilters, SalesReturnStatusFilter } from "@/types/sales-return";

interface SalesReturnListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): SalesReturnListFilters {
  const filters: SalesReturnListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (SALES_RETURN_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as SalesReturnStatusFilter;
  }

  return filters;
}

export default async function SalesReturnListPage({ searchParams }: SalesReturnListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: salesReturns, hasMore }, isAdmin, canCreate] = await Promise.all([
    salesReturnService.listSalesReturnsPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sales Returns</h1>
            <p className="text-sm text-muted-foreground">
              Physical, quantity-based reversals of posted sales invoices — goods back into stock, liability reduced.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/sales/returns/new">
                  <Plus size={18} />
                  New Sales Return
                </Link>
              }
            />
          ) : null}
        </div>

        <SalesReturnFilterBar />

        <SalesReturnTable
          key={JSON.stringify(filters)}
          salesReturns={salesReturns}
          initialHasMore={hasMore}
          loadMore={loadMoreSalesReturnsAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
