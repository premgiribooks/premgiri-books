import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { JournalVoucherForm } from "@/modules/manual-vouchers/components/journal-voucher-form";
import { paymentVoucherService } from "@/modules/manual-vouchers/services/payment-voucher-service";

// Gated on `approve`, not `create` — Journal Voucher's one deliberate
// divergence from Payment/Receipt/Contra Voucher (55-journal-voucher.md's
// Goal/Security sections).
export default async function NewJournalVoucherPage() {
  const user = await getCurrentCompanyUser();
  const canPost = await hasPermission(user, "accounting", "approve");
  if (!canPost) {
    redirect("/accounting/journal-vouchers");
  }

  const [ledgerOptions, isAdmin] = await Promise.all([
    paymentVoucherService.listLedgerOptions(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Journal Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Any combination of Debit/Credit entries against any active ledger, as long as the set balances.
          </p>
        </div>

        <JournalVoucherForm ledgerOptions={ledgerOptions} />
      </div>
    </AppShell>
  );
}
