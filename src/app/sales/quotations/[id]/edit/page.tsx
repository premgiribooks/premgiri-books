import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { QuotationForm } from "@/modules/quotations/components/quotation-form";
import { quotationService } from "@/modules/quotations/services/quotation-service";

interface EditQuotationPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotationPage({ params }: EditQuotationPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "sales", "edit");
  if (!canEdit) {
    redirect(`/sales/quotations/${id}`);
  }

  const quotation = await quotationService.getQuotation(id);
  if (!quotation) {
    notFound();
  }

  // Only reachable while DRAFT/SENT (35-quotations.md's UI) — the service
  // itself also rejects a terminal-state update, this just avoids offering
  // a doomed form.
  if (quotation.status !== "DRAFT" && quotation.status !== "SENT") {
    redirect(`/sales/quotations/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    quotationService.listQuotationFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Quotation — {quotation.quotationNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the customer, dates, place of supply, and lines.
          </p>
        </div>

        <QuotationForm options={options} quotation={quotation} />
      </div>
    </AppShell>
  );
}
