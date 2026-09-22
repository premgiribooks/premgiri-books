"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/common/loading-bar";
import { cancelStockAdjustmentAction, postStockAdjustmentAction } from "@/modules/stock-adjustments/actions/stock-adjustment-actions";
import type { ActionResult } from "@/types/api";
import type { StockAdjustmentDetail, StockAdjustmentStatus } from "@/types/stock-adjustment";

interface StockAdjustmentStatusActionsProps {
  stockAdjustment: StockAdjustmentDetail;
  /** Gated on "inventory"/"approve" — Post (every Stock Adjustment post
   * requires approve, unconditionally). */
  canPost: boolean;
  /** Gated on "inventory"/"approve" — Cancel. */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<StockAdjustmentDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors purchase-return-status-actions.tsx. */
export function StockAdjustmentStatusActions({ stockAdjustment, canPost, canCancel }: StockAdjustmentStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<StockAdjustmentStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: StockAdjustmentStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(stockAdjustment.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the stock adjustment.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the stock adjustment.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && stockAdjustment.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(postStockAdjustmentAction, "POSTED", "Stock adjustment posted.")}
        >
          {pending === "POSTED" ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && stockAdjustment.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelStockAdjustmentAction, "CANCELLED", "Stock adjustment cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
