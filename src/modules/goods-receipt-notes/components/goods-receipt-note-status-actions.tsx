"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
}

type TransitionAction = (id: string) => Promise<ActionResult<GoodsReceiptNoteDetail>>;

/**
 * The detail page's status-transition button row. `RECEIVED -> INVOICED`
 * itself is automatic (Purchase Invoice's posting flow) — no button for that
 * transition, mirrors delivery-challan-status-actions.tsx's forward-note
 * convention.
 */
export function GoodsReceiptNoteStatusActions({ goodsReceiptNote, canEdit }: GoodsReceiptNoteStatusActionsProps) {
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
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
