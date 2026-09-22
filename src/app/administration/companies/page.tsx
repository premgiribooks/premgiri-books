import Link from "next/link";
import { Plus } from "lucide-react";

import { PlatformShell } from "@/components/layout/platform-shell";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { loadMoreCompaniesAction } from "@/modules/administration/actions/company-admin-actions";
import { companyService } from "@/modules/company/services/company-service";
import { CompanySearchForm } from "@/modules/company/components/company-search-form";
import { CompanyTable } from "@/modules/company/components/company-table";
import type { CompanyListFilters, CompanyStatusFilter } from "@/types/company";

function normalizeStatus(value: string | undefined): CompanyStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

interface AdministrationCompaniesPageProps {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function AdministrationCompaniesPage({
  searchParams,
}: AdministrationCompaniesPageProps) {
  await requireSuperAdmin();

  const params = await searchParams;
  const search = params.search ?? "";
  const status = normalizeStatus(params.status);

  const filters: CompanyListFilters = { search: search || undefined, status };
  const { items: companies, hasMore } = await companyService.listCompaniesPage(filters, {
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Companies</h1>
            <p className="text-sm text-muted-foreground">Manage every company on the platform.</p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/administration/companies/new">
                <Plus size={18} />
                New Company
              </Link>
            }
          />
        </div>

        <CompanySearchForm
          initialSearch={search}
          initialStatus={status}
          basePath="/administration/companies"
        />

        <CompanyTable
          key={JSON.stringify(filters)}
          companies={companies}
          initialHasMore={hasMore}
          loadMore={loadMoreCompaniesAction.bind(null, filters)}
          canManageStatus
          canEdit
          editBasePath="/administration/companies"
        />
      </div>
    </PlatformShell>
  );
}
