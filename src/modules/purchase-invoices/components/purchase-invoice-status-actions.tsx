"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelPurchaseInvoiceAction,
  postPurchaseInvoiceAction,
} from "@/modules/purchase-invoices/actions/purchase-invoice-actions";
import type { ActionResult } from "@/types/api";
import type { PurchaseInvoiceDetail, PurchaseInvoiceStatus } from "@/types/purchase-invoice";

interface PurchaseInvoiceStatusActionsProps {
  purchaseInvoice: PurchaseInvoiceDetail;
  /** Gated on "purchase"/"create" — Post (the same permission Create uses). */
  canPost: boolean;
  /** Gated on "purchase"/"approve" — Cancel (reversing a POSTED invoice's
   * real financial/stock entries is a stronger action than a routine edit). */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<PurchaseInvoiceDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors sales-invoice-status-actions.tsx. */
export function PurchaseInvoiceStatusActions({ purchaseInvoice, canPost, canCancel }: PurchaseInvoiceStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PurchaseInvoiceStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: PurchaseInvoiceStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(purchaseInvoice.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the purchase invoice.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the purchase invoice.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && purchaseInvoice.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(postPurchaseInvoiceAction, "POSTED", "Purchase invoice posted.")}
        >
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && purchaseInvoice.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelPurchaseInvoiceAction, "CANCELLED", "Purchase invoice cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
