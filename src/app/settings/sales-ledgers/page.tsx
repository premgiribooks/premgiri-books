import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesLedgerMappingForm } from "@/modules/company/components/sales-ledger-mapping-form";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

export default async function SalesLedgersSettingsPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "settings", "view");
  if (!canView) {
    redirect("/");
  }

  const [isAdmin, canEdit, settings, ledgers] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "settings", "edit"),
    companySettingsService.getSettings(user.companyId),
    ledgerService.listSelectableLedgers(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales & GST Ledgers</h1>
          <p className="text-sm text-muted-foreground">
            Map the ledgers Sales Invoice posting uses for the sale, output tax, and round-off
            entries. All six must be configured before a Sales Invoice can be posted.
          </p>
        </div>

        <SalesLedgerMappingForm
          companyId={user.companyId}
          ledgers={ledgers}
          disabled={!canEdit}
          defaultValues={{
            salesLedgerId: settings?.salesLedgerId ?? undefined,
            outputCgstLedgerId: settings?.outputCgstLedgerId ?? undefined,
            outputSgstLedgerId: settings?.outputSgstLedgerId ?? undefined,
            outputIgstLedgerId: settings?.outputIgstLedgerId ?? undefined,
            outputCessLedgerId: settings?.outputCessLedgerId ?? undefined,
            roundOffLedgerId: settings?.roundOffLedgerId ?? undefined,
          }}
        />
      </div>
    </AppShell>
  );
}
