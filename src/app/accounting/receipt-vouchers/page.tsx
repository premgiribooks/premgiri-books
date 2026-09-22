import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreReceiptVouchersAction } from "@/modules/manual-vouchers/actions/receipt-voucher-actions";
import { ReceiptVoucherTable } from "@/modules/manual-vouchers/components/receipt-voucher-table";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";
import { receiptVoucherService } from "@/modules/manual-vouchers/services/receipt-voucher-service";

export default async function ReceiptVoucherListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [{ items: vouchers, hasMore }, ledgerOptions, isAdmin, canCreate] = await Promise.all([
    receiptVoucherService.listReceiptVouchersPage({}, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    paymentVoucherService.listLedgerOptions(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "accounting", "create"),
  ]);
  const ledgerNameById = new Map(ledgerOptions.map((ledger) => [ledger.id, ledger.name]));

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Receipt Vouchers</h1>
            <p className="text-sm text-muted-foreground">
              Record money received that isn&apos;t already captured by a document&apos;s own payment lines.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/receipt-vouchers/new">
                  <Plus size={18} />
                  New Receipt Voucher
                </Link>
              }
            />
          ) : null}
        </div>

        <ReceiptVoucherTable
          vouchers={vouchers}
          ledgerNameById={ledgerNameById}
          initialHasMore={hasMore}
          loadMore={loadMoreReceiptVouchersAction.bind(null, {})}
        />
      </div>
    </AppShell>
  );
}
