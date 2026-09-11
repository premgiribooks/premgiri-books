import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseReturnForm } from "@/modules/purchase-returns/components/purchase-return-form";
import { PurchaseReturnInvoicePicker } from "@/modules/purchase-returns/components/purchase-return-invoice-picker";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";

interface NewPurchaseReturnPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewPurchaseReturnPage({ searchParams }: NewPurchaseReturnPageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "purchase", "create");
  if (!canCreate) {
    redirect("/purchase/returns");
  }

  const purchaseInvoiceId = firstValue((await searchParams).purchaseInvoiceId);
  const isAdmin = await isCurrentUserCompanyAdmin();

  // Step 1: no invoice picked yet — show the POSTED-invoice search/select
  // (45-purchase-return.md's UI: "starts from an invoice search/select").
  if (!purchaseInvoiceId) {
    const invoices = await purchaseReturnService.listReturnableInvoices();
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">New Purchase Return</h1>
            <p className="text-sm text-muted-foreground">Select the posted purchase invoice to return goods against.</p>
          </div>
          <PurchaseReturnInvoicePicker initialInvoices={invoices} />
        </div>
      </AppShell>
    );
  }

  // Step 2: an invoice was picked — show only its lines with their
  // remaining returnable quantity.
  const [invoice, options] = await Promise.all([
    purchaseReturnService.getReturnableInvoice(purchaseInvoiceId),
    purchaseReturnService.listPurchaseReturnFormOptions(),
  ]);

  if (!invoice) {
    redirect("/purchase/returns/new");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Purchase Return</h1>
          <p className="text-sm text-muted-foreground">
            Record returned quantities — posting moves stock back out and reduces what the business owes the supplier.
          </p>
        </div>

        <PurchaseReturnForm invoice={invoice} options={options} />
      </div>
    </AppShell>
  );
}
