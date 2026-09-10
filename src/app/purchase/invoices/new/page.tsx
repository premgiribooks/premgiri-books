import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseInvoiceForm } from "@/modules/purchase-invoices/components/purchase-invoice-form";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";

interface NewPurchaseInvoicePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewPurchaseInvoicePage({ searchParams }: NewPurchaseInvoicePageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "purchase", "create");
  if (!canCreate) {
    redirect("/purchase/invoices");
  }

  const goodsReceiptNoteId = firstValue((await searchParams).goodsReceiptNoteId);

  const [isAdmin, options, goodsReceiptNotePrefill] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    purchaseInvoiceService.listPurchaseInvoiceFormOptions(),
    goodsReceiptNoteId ? purchaseInvoiceService.getGoodsReceiptNotePrefill(goodsReceiptNoteId) : Promise.resolve(null),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Purchase Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Record a supplier&apos;s bill — posting moves stock in and creates accounting entries.
          </p>
        </div>

        <PurchaseInvoiceForm options={options} goodsReceiptNotePrefill={goodsReceiptNotePrefill} />
      </div>
    </AppShell>
  );
}
