import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GstFilingFrequencyForm } from "@/modules/company/components/gst-filing-frequency-form";
import { PayrollLedgerMappingForm } from "@/modules/company/components/payroll-ledger-mapping-form";
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
          <h1 className="text-xl font-semibold text-foreground">Sales & Purchase GST Ledgers</h1>
          <p className="text-sm text-muted-foreground">
            Map the ledgers Sales Invoice and Purchase Invoice posting use for the sale/purchase,
            output/input tax, and shared round-off entries. Each document&apos;s own set must be fully
            configured before it can be posted.
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
            purchaseLedgerId: settings?.purchaseLedgerId ?? undefined,
            inputCgstLedgerId: settings?.inputCgstLedgerId ?? undefined,
            inputSgstLedgerId: settings?.inputSgstLedgerId ?? undefined,
            inputIgstLedgerId: settings?.inputIgstLedgerId ?? undefined,
            inputCessLedgerId: settings?.inputCessLedgerId ?? undefined,
            roundOffLedgerId: settings?.roundOffLedgerId ?? undefined,
          }}
        />

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">GST Filing Frequency</h2>
            <p className="text-xs text-muted-foreground">
              Drives the period picker on GSTR-1/GSTR-3B (month vs. quarter).
            </p>
          </div>
          <GstFilingFrequencyForm
            companyId={user.companyId}
            defaultValue={settings?.gstFilingFrequency ?? "MONTHLY"}
            disabled={!canEdit}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Payroll Ledgers</h2>
            <p className="text-xs text-muted-foreground">
              Map the ledgers Payroll posting uses for the salary expense and salary payable entries.
            </p>
          </div>
          <PayrollLedgerMappingForm
            companyId={user.companyId}
            ledgers={ledgers}
            disabled={!canEdit}
            defaultValues={{
              salaryExpenseLedgerId: settings?.salaryExpenseLedgerId ?? undefined,
              salaryPayableLedgerId: settings?.salaryPayableLedgerId ?? undefined,
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
