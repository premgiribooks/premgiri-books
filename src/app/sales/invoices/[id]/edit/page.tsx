import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesInvoiceForm } from "@/modules/sales-invoices/components/sales-invoice-form";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";

interface EditSalesInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSalesInvoicePage({ params }: EditSalesInvoicePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "sales", "edit");
  if (!canEdit) {
    redirect(`/sales/invoices/${id}`);
  }

  const salesInvoice = await salesInvoiceService.getSalesInvoice(id);
  if (!salesInvoice) {
    notFound();
  }

  // Only reachable while DRAFT (38-sales-invoice.md: "no Edit after
  // posting") — the service itself also rejects a non-DRAFT update, this
  // just avoids offering a doomed form.
  if (salesInvoice.status !== "DRAFT") {
    redirect(`/sales/invoices/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    salesInvoiceService.listSalesInvoiceFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Sales Invoice — {salesInvoice.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground">Update the customer, details, lines, and payments.</p>
        </div>

        <SalesInvoiceForm options={options} salesInvoice={salesInvoice} />
      </div>
    </AppShell>
  );
}
