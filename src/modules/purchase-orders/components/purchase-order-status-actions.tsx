"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
  confirmPurchaseOrderAction,
} from "@/modules/purchase-orders/actions/purchase-order-actions";
import type { ActionResult } from "@/types/api";
import type { PurchaseOrderDetail, PurchaseOrderStatus } from "@/types/purchase-order";

interface PurchaseOrderStatusActionsProps {
  purchaseOrder: PurchaseOrderDetail;
  /** Gated on "purchase"/"edit" — Confirm, Close, and Cancel-while-DRAFT. */
  canEdit: boolean;
  /** Gated on "purchase"/"approve" — Cancel-while-CONFIRMED. */
  canApprove: boolean;
  /** Gated on "purchase"/"create" — Create Goods Receipt Note
   * (feature-spec 43), the same permission the "New Purchase Order"/"New
   * Goods Receipt Note" buttons use. Just a link to
   * /purchase/receipts/new?purchaseOrderId=; the GRN form itself pre-fills
   * from the order's remaining quantities. */
  canCreateReceipt: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<PurchaseOrderDetail>>;

/**
 * The detail page's status-transition button row, including "Create Goods
 * Receipt Note" (feature-spec 43) — mirrors
 * sales-order-status-actions.tsx's identical "Create Delivery Challan"
 * pattern. Each button is only rendered when both the current status
 * permits the transition and the caller holds the matching permission.
 */
export function PurchaseOrderStatusActions({
  purchaseOrder,
  canEdit,
  canApprove,
  canCreateReceipt,
}: PurchaseOrderStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PurchaseOrderStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: PurchaseOrderStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(purchaseOrder.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the purchase order.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the purchase order.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;
  const canCancel =
    purchaseOrder.status === "DRAFT" ? canEdit : purchaseOrder.status === "CONFIRMED" ? canApprove : false;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && purchaseOrder.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(confirmPurchaseOrderAction, "CONFIRMED", "Purchase order confirmed.")}
        >
          {pending === "CONFIRMED" ? "Confirming…" : "Confirm"}
        </Button>
      ) : null}

      {canEdit && purchaseOrder.status === "RECEIVED" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(closePurchaseOrderAction, "CLOSED", "Purchase order closed.")}
        >
          {pending === "CLOSED" ? "Closing…" : "Close"}
        </Button>
      ) : null}

      {canCancel && (purchaseOrder.status === "DRAFT" || purchaseOrder.status === "CONFIRMED") ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelPurchaseOrderAction, "CANCELLED", "Purchase order cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}

      {canCreateReceipt &&
      (purchaseOrder.status === "CONFIRMED" || purchaseOrder.status === "PARTIALLY_RECEIVED") ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/purchase/receipts/new?purchaseOrderId=${purchaseOrder.id}`}>Create Goods Receipt Note</Link>}
        />
      ) : null}
    </div>
  );
}
