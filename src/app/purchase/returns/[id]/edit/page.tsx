import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseReturnForm } from "@/modules/purchase-returns/components/purchase-return-form";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";

interface EditPurchaseReturnPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPurchaseReturnPage({ params }: EditPurchaseReturnPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "purchase", "edit");
  if (!canEdit) {
    redirect(`/purchase/returns/${id}`);
  }

  const purchaseReturn = await purchaseReturnService.getPurchaseReturn(id);
  if (!purchaseReturn) {
    notFound();
  }

  // Only reachable while DRAFT (45-purchase-return.md: "Editable while
  // DRAFT") — the service itself also rejects a non-DRAFT update, this just
  // avoids offering a doomed form.
  if (purchaseReturn.status !== "DRAFT") {
    redirect(`/purchase/returns/${id}`);
  }

  const [isAdmin, invoice, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    purchaseReturnService.getReturnableInvoice(purchaseReturn.purchaseInvoiceId),
    purchaseReturnService.listPurchaseReturnFormOptions(),
  ]);

  if (!invoice) {
    notFound();
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Purchase Return</h1>
          <p className="text-sm text-muted-foreground">Update the returned lines, refund mode, and reason.</p>
        </div>

        <PurchaseReturnForm invoice={invoice} options={options} purchaseReturn={purchaseReturn} />
      </div>
    </AppShell>
  );
}
