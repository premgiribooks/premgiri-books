import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GoodsReceiptNoteForm } from "@/modules/goods-receipt-notes/components/goods-receipt-note-form";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";

interface NewGoodsReceiptNotePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewGoodsReceiptNotePage({ searchParams }: NewGoodsReceiptNotePageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "purchase", "create");
  if (!canCreate) {
    redirect("/purchase/receipts");
  }

  const purchaseOrderId = firstValue((await searchParams).purchaseOrderId);

  const [isAdmin, options, purchaseOrderPrefill] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    goodsReceiptNoteService.listGoodsReceiptNoteFormOptions(),
    purchaseOrderId ? goodsReceiptNoteService.getPurchaseOrderPrefill(purchaseOrderId) : Promise.resolve(null),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Goods Receipt Note</h1>
          <p className="text-sm text-muted-foreground">
            Record the quantity and warehouse received from a supplier.
          </p>
        </div>

        <GoodsReceiptNoteForm options={options} purchaseOrderPrefill={purchaseOrderPrefill} />
      </div>
    </AppShell>
  );
}
