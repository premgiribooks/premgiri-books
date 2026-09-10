import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseInvoiceForm } from "@/modules/purchase-invoices/components/purchase-invoice-form";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";

interface EditPurchaseInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPurchaseInvoicePage({ params }: EditPurchaseInvoicePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "purchase", "edit");
  if (!canEdit) {
    redirect(`/purchase/invoices/${id}`);
  }

  const purchaseInvoice = await purchaseInvoiceService.getPurchaseInvoice(id);
  if (!purchaseInvoice) {
    notFound();
  }

  // Only reachable while DRAFT (44-purchase-invoice.md: "no Edit after
  // posting") — the service itself also rejects a non-DRAFT update, this
  // just avoids offering a doomed form.
  if (purchaseInvoice.status !== "DRAFT") {
    redirect(`/purchase/invoices/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    purchaseInvoiceService.listPurchaseInvoiceFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Purchase Invoice — {purchaseInvoice.supplierInvoiceNumber}
          </h1>
          <p className="text-sm text-muted-foreground">Update the supplier, details, lines, and payments.</p>
        </div>

        <PurchaseInvoiceForm options={options} purchaseInvoice={purchaseInvoice} />
      </div>
    </AppShell>
  );
}
