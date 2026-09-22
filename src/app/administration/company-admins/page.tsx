import { PlatformShell } from "@/components/layout/platform-shell";
import { requireSuperAdmin } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { companyService } from "@/modules/company/services/company-service";
import { loadMoreCompanyAdminsAction } from "@/modules/administration/actions/platform-user-actions";
import { platformUserService } from "@/modules/administration/services/platform-user-service";
import { CompanyAdminTable } from "@/modules/administration/components/company-admin-table";

export default async function CompanyAdminsPage() {
  await requireSuperAdmin();

  const [{ items: companyAdmins, hasMore }, companies] = await Promise.all([
    platformUserService.listCompanyAdminsPage({ skip: 0, take: DEFAULT_PAGE_SIZE }),
    // Only active companies are valid reassignment targets — an inactive
    // company isn't somewhere a Company Admin can usefully be moved to.
    companyService.listCompanies({ status: "active" }),
  ]);

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Company Admins</h1>
          <p className="text-sm text-muted-foreground">
            Every company&apos;s Company Admin, across the platform.
          </p>
        </div>

        <CompanyAdminTable
          companyAdmins={companyAdmins}
          companies={companies}
          initialHasMore={hasMore}
          loadMore={loadMoreCompanyAdminsAction}
        />
      </div>
    </PlatformShell>
  );
}
