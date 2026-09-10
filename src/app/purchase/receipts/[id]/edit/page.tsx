import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GoodsReceiptNoteForm } from "@/modules/goods-receipt-notes/components/goods-receipt-note-form";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";

interface EditGoodsReceiptNotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditGoodsReceiptNotePage({ params }: EditGoodsReceiptNotePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "purchase", "edit");
  if (!canEdit) {
    redirect(`/purchase/receipts/${id}`);
  }

  const goodsReceiptNote = await goodsReceiptNoteService.getGoodsReceiptNote(id);
  if (!goodsReceiptNote) {
    notFound();
  }

  // Only reachable while DRAFT (43-goods-receipt-note.md's Business Rules) —
  // the service itself also rejects a non-DRAFT update, this just avoids
  // offering a doomed form.
  if (goodsReceiptNote.status !== "DRAFT") {
    redirect(`/purchase/receipts/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    goodsReceiptNoteService.listGoodsReceiptNoteFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Goods Receipt Note — {goodsReceiptNote.grnNumber}
          </h1>
          <p className="text-sm text-muted-foreground">Update the supplier, date, narration, and lines.</p>
        </div>

        <GoodsReceiptNoteForm options={options} goodsReceiptNote={goodsReceiptNote} />
      </div>
    </AppShell>
  );
}
