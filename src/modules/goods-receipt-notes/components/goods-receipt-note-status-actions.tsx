"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LoadingBar } from "@/components/common/loading-bar";
import { Button } from "@/components/ui/button";
import {
  cancelGoodsReceiptNoteAction,
  receiveGoodsReceiptNoteAction,
} from "@/modules/goods-receipt-notes/actions/goods-receipt-note-actions";
import type { ActionResult } from "@/types/api";
import type { GoodsReceiptNoteDetail, GoodsReceiptNoteStatus } from "@/types/goods-receipt-note";

interface GoodsReceiptNoteStatusActionsProps {
  goodsReceiptNote: GoodsReceiptNoteDetail;
  /** Gated on "purchase"/"edit" — Receive and Cancel. */
  canEdit: boolean;
  /** Gated on "purchase"/"create" — "Create Invoice" (feature-spec 44), the
   * same permission "New Purchase Invoice" uses. Just a link to
   * /purchase/invoices/new?goodsReceiptNoteId=; the invoice form itself
   * pre-fills from the GRN's own lines. Mirrors
   * purchase-order-status-actions.tsx's identical "Create Goods Receipt
   * Note" pattern. */
  canCreateInvoice: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<GoodsReceiptNoteDetail>>;

/**
 * The detail page's status-transition button row, including "Create
 * Invoice" once RECEIVED. `RECEIVED -> INVOICED` itself is automatic
 * (Purchase Invoice's posting flow) — no button drives that transition
 * directly.
 */
export function GoodsReceiptNoteStatusActions({ goodsReceiptNote, canEdit, canCreateInvoice }: GoodsReceiptNoteStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<GoodsReceiptNoteStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: GoodsReceiptNoteStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(goodsReceiptNote.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the goods receipt note.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the goods receipt note.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && goodsReceiptNote.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(receiveGoodsReceiptNoteAction, "RECEIVED", "Goods receipt note received.")}
        >
          {pending === "RECEIVED" ? <LoadingBar className="w-8" label="Receiving" data-icon="inline-start" /> : null}
          {pending === "RECEIVED" ? "Receiving…" : "Receive"}
        </Button>
      ) : null}

      {canEdit && goodsReceiptNote.status === "DRAFT" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelGoodsReceiptNoteAction, "CANCELLED", "Goods receipt note cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}

      {canCreateInvoice && goodsReceiptNote.status === "RECEIVED" ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/purchase/invoices/new?goodsReceiptNoteId=${goodsReceiptNote.id}`}>Create Invoice</Link>}
        />
      ) : null}
    </div>
  );
}
