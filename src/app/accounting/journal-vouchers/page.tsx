import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreJournalVouchersAction } from "@/modules/manual-vouchers/actions/journal-voucher-actions";
import { JournalVoucherTable } from "@/modules/manual-vouchers/components/journal-voucher-table";
import { journalVoucherService } from "@/modules/manual-vouchers/services/journal-voucher-service";

export default async function JournalVoucherListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [{ items: vouchers, hasMore }, isAdmin, canCreate] = await Promise.all([
    journalVoucherService.listJournalVouchersPage({}, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "accounting", "approve"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Journal Vouchers</h1>
            <p className="text-sm text-muted-foreground">
              Freeform Debit/Credit entries against any ledger — corrections, accruals, and adjustments that don&apos;t
              fit Payment, Receipt, or Contra Voucher.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/journal-vouchers/new">
                  <Plus size={18} />
                  New Journal Voucher
                </Link>
              }
            />
          ) : null}
        </div>

        <JournalVoucherTable
          vouchers={vouchers}
          initialHasMore={hasMore}
          loadMore={loadMoreJournalVouchersAction.bind(null, {})}
        />
      </div>
    </AppShell>
  );
}
