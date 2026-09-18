import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ContraVoucherForm } from "@/modules/manual-vouchers/components/contra-voucher-form";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";

export default async function NewContraVoucherPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/contra-vouchers");
  }

  const [ledgerOptions, paymentModes, isAdmin] = await Promise.all([
    paymentVoucherService.listLedgerOptions(),
    paymentVoucherService.listPaymentModes(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Contra Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Move funds between two of the company&apos;s own Cash/Bank ledgers.
          </p>
        </div>

        <ContraVoucherForm ledgerOptions={ledgerOptions} paymentModes={paymentModes} />
      </div>
    </AppShell>
  );
}
