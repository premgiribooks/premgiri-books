import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesReturnForm } from "@/modules/sales-returns/components/sales-return-form";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";

interface EditSalesReturnPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSalesReturnPage({ params }: EditSalesReturnPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "sales", "edit");
  if (!canEdit) {
    redirect(`/sales/returns/${id}`);
  }

  const salesReturn = await salesReturnService.getSalesReturn(id);
  if (!salesReturn) {
    notFound();
  }

  // Only reachable while DRAFT (39-sales-return.md: "Editable while DRAFT")
  // — the service itself also rejects a non-DRAFT update, this just avoids
  // offering a doomed form.
  if (salesReturn.status !== "DRAFT") {
    redirect(`/sales/returns/${id}`);
  }

  const [isAdmin, invoice, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    salesReturnService.getReturnableInvoice(salesReturn.salesInvoiceId),
    salesReturnService.listSalesReturnFormOptions(),
  ]);

  if (!invoice) {
    notFound();
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Sales Return</h1>
          <p className="text-sm text-muted-foreground">Update the returned lines, refund mode, and reason.</p>
        </div>

        <SalesReturnForm invoice={invoice} options={options} salesReturn={salesReturn} />
      </div>
    </AppShell>
  );
}
