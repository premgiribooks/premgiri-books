import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ContraVoucherTable } from "@/modules/manual-vouchers/components/contra-voucher-table";
import { contraVoucherService } from "@/modules/manual-vouchers/services/contra-voucher-service";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";

export default async function ContraVoucherListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [vouchers, ledgerOptions, isAdmin, canCreate] = await Promise.all([
    contraVoucherService.listContraVouchers(),
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
            <h1 className="text-xl font-semibold text-foreground">Contra Vouchers</h1>
            <p className="text-sm text-muted-foreground">
              Record fund movement strictly between the company&apos;s own Cash/Bank ledgers.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/contra-vouchers/new">
                  <Plus size={18} />
                  New Contra Voucher
                </Link>
              }
            />
          ) : null}
        </div>

        <ContraVoucherTable vouchers={vouchers} ledgerNameById={ledgerNameById} />
      </div>
    </AppShell>
  );
}
