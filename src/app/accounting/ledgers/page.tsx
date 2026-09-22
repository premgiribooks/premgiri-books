import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreLedgersAction } from "@/modules/ledgers/actions/ledger-actions";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { LedgerTable } from "@/modules/ledgers/components/ledger-table";

export default async function LedgerListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [{ items: ledgers, hasMore }, detailManaged, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    ledgerService.listLedgersPage({}, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    ledgerService.listDetailManagedLedgers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "accounting", "create"),
    hasPermission(user, "accounting", "edit"),
    hasPermission(user, "accounting", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Ledgers</h1>
            <p className="text-sm text-muted-foreground">
              Manage the individual accounting ledgers for your company.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/ledgers/new">
                  <Plus size={18} />
                  New Ledger
                </Link>
              }
            />
          ) : null}
        </div>

        <LedgerTable
          ledgers={ledgers}
          initialHasMore={hasMore}
          loadMore={loadMoreLedgersAction.bind(null, {})}
          canEdit={canEdit}
          canManage={canManage}
          detailManaged={detailManaged}
        />
      </div>
    </AppShell>
  );
}
