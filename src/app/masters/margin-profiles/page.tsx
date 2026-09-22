import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreMarginProfilesAction } from "@/modules/margin-profiles/actions/margin-profile-actions";
import { MarginProfileFilterBar } from "@/modules/margin-profiles/components/margin-profile-filter-bar";
import { MarginProfileTable } from "@/modules/margin-profiles/components/margin-profile-table";
import { marginProfileService } from "@/modules/margin-profiles/services/margin-profile-service";
import type { MarginProfileListFilters } from "@/types/margin-profile";

interface MarginProfileListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see margin-profile-filter-bar.tsx); unknown
// values are ignored rather than erroring — a hand-edited query string just
// falls back to the unfiltered list.
function parseFilters(
  params: Record<string, string | string[] | undefined>
): MarginProfileListFilters {
  const filters: MarginProfileListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status === "active" || status === "inactive") {
    filters.status = status;
  }

  return filters;
}

export default async function MarginProfileListPage({
  searchParams,
}: MarginProfileListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: marginProfiles, hasMore }, isAdmin, canCreate, canEdit, canManage] =
    await Promise.all([
      marginProfileService.listMarginProfilesPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
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
            <h1 className="text-xl font-semibold text-foreground">Margin Profiles</h1>
            <p className="text-sm text-muted-foreground">
              Manage the named margin/markup pricing rules your products will reference.
            </p>
          </div>
          {canCreate ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/masters/margin-profiles/import">Import</Link>}
              />
              <Button
                nativeButton={false}
                render={
                  <Link href="/masters/margin-profiles/new">
                    <Plus size={18} />
                    New Margin Profile
                  </Link>
                }
              />
            </div>
          ) : null}
        </div>

        <MarginProfileFilterBar />

        <MarginProfileTable
          key={JSON.stringify(filters)}
          marginProfiles={marginProfiles}
          initialHasMore={hasMore}
          loadMore={loadMoreMarginProfilesAction.bind(null, filters)}
          canEdit={canEdit}
          canManage={canManage}
        />
      </div>
    </AppShell>
  );
}
