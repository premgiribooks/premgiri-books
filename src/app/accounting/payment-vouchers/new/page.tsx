import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PaymentVoucherForm } from "@/modules/manual-vouchers/components/payment-voucher-form";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";
import { resolvePaymentVoucherPrefill } from "@/modules/manual-vouchers/utils/resolve-payment-voucher-prefill";

interface NewPaymentVoucherPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewPaymentVoucherPage({ searchParams }: NewPaymentVoucherPageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/payment-vouchers");
  }

  const [ledgerOptions, isAdmin] = await Promise.all([
    paymentVoucherService.listLedgerOptions(),
    isCurrentUserCompanyAdmin(),
  ]);

  const resolvedParams = await searchParams;
  const prefill = resolvePaymentVoucherPrefill(
    ledgerOptions,
    firstValue(resolvedParams.debitLedgerId),
    firstValue(resolvedParams.amount)
  );

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Payment Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Money paid out from a Cash-in-Hand or bank ledger to one or more other ledgers.
          </p>
        </div>

        <PaymentVoucherForm ledgerOptions={ledgerOptions} prefill={prefill} />
      </div>
    </AppShell>
  );
}
