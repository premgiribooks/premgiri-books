import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseReturnFilterBar } from "@/modules/purchase-returns/components/purchase-return-filter-bar";
import { PurchaseReturnTable } from "@/modules/purchase-returns/components/purchase-return-table";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";
import { PURCHASE_RETURN_STATUS_VALUES } from "@/modules/purchase-returns/validation/purchase-return-schema";
import type { PurchaseReturnListFilters, PurchaseReturnStatusFilter } from "@/types/purchase-return";

interface PurchaseReturnListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): PurchaseReturnListFilters {
  const filters: PurchaseReturnListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (PURCHASE_RETURN_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as PurchaseReturnStatusFilter;
  }

  return filters;
}

export default async function PurchaseReturnListPage({ searchParams }: PurchaseReturnListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [purchaseReturns, isAdmin, canCreate] = await Promise.all([
    purchaseReturnService.listPurchaseReturns(filters),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Purchase Returns</h1>
            <p className="text-sm text-muted-foreground">
              Physical, quantity-based reversals of posted purchase invoices — goods back out to the supplier, liability
              reduced.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/purchase/returns/new">
                  <Plus size={18} />
                  New Purchase Return
                </Link>
              }
            />
          ) : null}
        </div>

        <PurchaseReturnFilterBar />

        <PurchaseReturnTable purchaseReturns={purchaseReturns} />
      </div>
    </AppShell>
  );
}
