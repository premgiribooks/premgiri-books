import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { QuotationForm } from "@/modules/quotations/components/quotation-form";
import { quotationService } from "@/modules/quotations/services/quotation-service";

export default async function NewQuotationPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "sales", "create");
  if (!canCreate) {
    redirect("/sales/quotations");
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    quotationService.listQuotationFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Quotation</h1>
          <p className="text-sm text-muted-foreground">
            Add a priced offer for an existing customer.
          </p>
        </div>

        <QuotationForm options={options} />
      </div>
    </AppShell>
  );
}
