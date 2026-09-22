import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreHsnCodesAction } from "@/modules/hsn-codes/actions/hsn-code-actions";
import { hsnCodeService } from "@/modules/hsn-codes/services/hsn-code-service";
import { HsnCodeTable } from "@/modules/hsn-codes/components/hsn-code-table";

export default async function HsnCodeListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const [{ items: hsnCodes, hasMore }, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    hsnCodeService.listHsnCodesPage({}, { skip: 0, take: DEFAULT_PAGE_SIZE }),
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
            <h1 className="text-xl font-semibold text-foreground">HSN Codes</h1>
            <p className="text-sm text-muted-foreground">
              Manage the HSN codes (goods) and SAC codes (services) your products will reference.
            </p>
          </div>
          {canCreate ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/masters/hsn-codes/import">Import</Link>}
              />
              <Button
                nativeButton={false}
                render={
                  <Link href="/masters/hsn-codes/new">
                    <Plus size={18} />
                    New HSN/SAC Code
                  </Link>
                }
              />
            </div>
          ) : null}
        </div>

        <HsnCodeTable
          hsnCodes={hsnCodes}
          initialHasMore={hasMore}
          loadMore={loadMoreHsnCodesAction.bind(null, {})}
          canEdit={canEdit}
          canManage={canManage}
        />
      </div>
    </AppShell>
  );
}
