import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReceiptVoucherForm } from "@/modules/manual-vouchers/components/receipt-voucher-form";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";

export default async function NewReceiptVoucherPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/receipt-vouchers");
  }

  const [ledgerOptions, isAdmin] = await Promise.all([
    paymentVoucherService.listLedgerOptions(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Receipt Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Money received into a Cash-in-Hand or bank ledger from one or more other ledgers.
          </p>
        </div>

        <ReceiptVoucherForm ledgerOptions={ledgerOptions} />
      </div>
    </AppShell>
  );
}
