"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/common/loading-bar";
import { cancelPurchaseReturnAction, postPurchaseReturnAction } from "@/modules/purchase-returns/actions/purchase-return-actions";
import type { ActionResult } from "@/types/api";
import type { PurchaseReturnDetail, PurchaseReturnStatus } from "@/types/purchase-return";

interface PurchaseReturnStatusActionsProps {
  purchaseReturn: PurchaseReturnDetail;
  /** Gated on "purchase"/"approve" — Post (every Purchase Return post
   * requires approve, unconditionally). */
  canPost: boolean;
  /** Gated on "purchase"/"approve" — Cancel (mirrors Purchase Invoice's own
   * cancellation gate). */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<PurchaseReturnDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors sales-return-status-actions.tsx /
 * purchase-invoice-status-actions.tsx. */
export function PurchaseReturnStatusActions({ purchaseReturn, canPost, canCancel }: PurchaseReturnStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PurchaseReturnStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: PurchaseReturnStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(purchaseReturn.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the purchase return.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the purchase return.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && purchaseReturn.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(postPurchaseReturnAction, "POSTED", "Purchase return posted.")}
        >
          {pending === "POSTED" ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && purchaseReturn.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelPurchaseReturnAction, "CANCELLED", "Purchase return cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
