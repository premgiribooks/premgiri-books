import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMorePhysicalVerificationsAction } from "@/modules/physical-verifications/actions/physical-verification-actions";
import { PhysicalVerificationFilterBar } from "@/modules/physical-verifications/components/physical-verification-filter-bar";
import { PhysicalVerificationTable } from "@/modules/physical-verifications/components/physical-verification-table";
import { physicalVerificationService } from "@/modules/physical-verifications/services/physical-verification-service";
import {
  PHYSICAL_VERIFICATION_STATUS_VALUES,
  isValidCalendarDate,
  toUtcDate,
} from "@/modules/physical-verifications/validation/physical-verification-schema";
import type { PhysicalVerificationListFilters, PhysicalVerificationStatusFilter } from "@/types/physical-verification";

interface PhysicalVerificationListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): PhysicalVerificationListFilters {
  const filters: PhysicalVerificationListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (PHYSICAL_VERIFICATION_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as PhysicalVerificationStatusFilter;
  }

  const warehouseId = firstValue(params.warehouseId);
  if (warehouseId) {
    filters.warehouseId = warehouseId;
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

export default async function PhysicalVerificationListPage({ searchParams }: PhysicalVerificationListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: physicalVerifications, hasMore }, options, isAdmin, canCreate] = await Promise.all([
    physicalVerificationService.listPhysicalVerificationsPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    physicalVerificationService.listFormOptions(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "inventory", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Physical Verifications</h1>
            <p className="text-sm text-muted-foreground">Reconcile physically counted stock against the system.</p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/inventory/verifications/new">
                  <Plus size={18} />
                  New Physical Verification
                </Link>
              }
            />
          ) : null}
        </div>

        <PhysicalVerificationFilterBar warehouses={options.warehouses} />

        <PhysicalVerificationTable
          key={JSON.stringify(filters)}
          physicalVerifications={physicalVerifications}
          initialHasMore={hasMore}
          loadMore={loadMorePhysicalVerificationsAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
