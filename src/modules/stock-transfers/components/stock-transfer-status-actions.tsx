"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/common/loading-bar";
import { cancelStockTransferAction, postStockTransferAction } from "@/modules/stock-transfers/actions/stock-transfer-actions";
import type { ActionResult } from "@/types/api";
import type { StockTransferDetail, StockTransferStatus } from "@/types/stock-transfer";

interface StockTransferStatusActionsProps {
  stockTransfer: StockTransferDetail;
  /** Gated on "inventory"/"approve" — Post (every Stock Transfer post
   * requires approve, unconditionally). */
  canPost: boolean;
  /** Gated on "inventory"/"approve" — Cancel. */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<StockTransferDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors stock-adjustment-status-actions.tsx. */
export function StockTransferStatusActions({ stockTransfer, canPost, canCancel }: StockTransferStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<StockTransferStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: StockTransferStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(stockTransfer.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the stock transfer.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the stock transfer.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && stockTransfer.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(postStockTransferAction, "POSTED", "Stock transfer posted.")}
        >
          {pending === "POSTED" ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && stockTransfer.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelStockTransferAction, "CANCELLED", "Stock transfer cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
