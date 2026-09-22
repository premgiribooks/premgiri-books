"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelPurchaseCreditNoteAction, postPurchaseCreditNoteAction } from "@/modules/purchase-credit-notes/actions/purchase-credit-note-actions";
import type { ActionResult } from "@/types/api";
import type { CreditNoteStatus, PurchaseCreditNoteDetail } from "@/types/purchase-credit-note";

interface PurchaseCreditNoteStatusActionsProps {
  purchaseCreditNote: PurchaseCreditNoteDetail;
  /** Gated on "purchase"/"approve" — Post (every Purchase Credit Note post
   * requires approve, unconditionally, since it always reduces the
   * supplier's payable). */
  canPost: boolean;
  /** Gated on "purchase"/"approve" — Cancel. */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<PurchaseCreditNoteDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors credit-note-status-actions.tsx. */
export function PurchaseCreditNoteStatusActions({ purchaseCreditNote, canPost, canCancel }: PurchaseCreditNoteStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<CreditNoteStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: CreditNoteStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(purchaseCreditNote.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the purchase credit note.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the purchase credit note.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && purchaseCreditNote.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(postPurchaseCreditNoteAction, "POSTED", "Purchase credit note posted.")}
        >
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && purchaseCreditNote.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelPurchaseCreditNoteAction, "CANCELLED", "Purchase credit note cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
