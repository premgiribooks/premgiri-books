import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReceiptVoucherForm } from "@/modules/manual-vouchers/components/receipt-voucher-form";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";
import { resolveReceiptVoucherPrefill } from "@/modules/manual-vouchers/utils/resolve-receipt-voucher-prefill";

interface NewReceiptVoucherPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewReceiptVoucherPage({ searchParams }: NewReceiptVoucherPageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/receipt-vouchers");
  }

  const [ledgerOptions, paymentModes, isAdmin] = await Promise.all([
    paymentVoucherService.listLedgerOptions(),
    paymentVoucherService.listPaymentModes(),
    isCurrentUserCompanyAdmin(),
  ]);

  const resolvedParams = await searchParams;
  const prefill = resolveReceiptVoucherPrefill(
    ledgerOptions,
    firstValue(resolvedParams.creditLedgerId),
    firstValue(resolvedParams.amount),
    paymentModes,
    firstValue(resolvedParams.paymentModeId)
  );

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Receipt Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Money received into a Cash-in-Hand or bank ledger from one or more other ledgers.
          </p>
        </div>

        <ReceiptVoucherForm ledgerOptions={ledgerOptions} paymentModes={paymentModes} prefill={prefill} />
      </div>
    </AppShell>
  );
}
