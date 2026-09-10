"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelSalesReturnAction, postSalesReturnAction } from "@/modules/sales-returns/actions/sales-return-actions";
import type { ActionResult } from "@/types/api";
import type { SalesReturnDetail, SalesReturnStatus } from "@/types/sales-return";

interface SalesReturnStatusActionsProps {
  salesReturn: SalesReturnDetail;
  /** Gated on "sales"/"approve" — Post (every Sales Return post requires
   * approve, unconditionally). */
  canPost: boolean;
  /** Gated on "sales"/"approve" — Cancel (mirrors Sales Invoice's own
   * cancellation gate). */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<SalesReturnDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors sales-invoice-status-actions.tsx. */
export function SalesReturnStatusActions({ salesReturn, canPost, canCancel }: SalesReturnStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<SalesReturnStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: SalesReturnStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(salesReturn.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the sales return.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the sales return.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && salesReturn.status === "DRAFT" ? (
        <Button size="sm" disabled={isBusy} onClick={() => runTransition(postSalesReturnAction, "POSTED", "Sales return posted.")}>
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && salesReturn.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelSalesReturnAction, "CANCELLED", "Sales return cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
