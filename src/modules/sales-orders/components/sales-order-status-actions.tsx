"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelSalesOrderAction,
  closeSalesOrderAction,
  confirmSalesOrderAction,
} from "@/modules/sales-orders/actions/sales-order-actions";
import type { ActionResult } from "@/types/api";
import type { SalesOrderDetail, SalesOrderStatus } from "@/types/sales-order";

interface SalesOrderStatusActionsProps {
  salesOrder: SalesOrderDetail;
  /** Gated on "sales"/"edit" — Confirm, Close, and Cancel-while-DRAFT. */
  canEdit: boolean;
  /** Gated on "sales"/"approve" — Cancel-while-CONFIRMED. */
  canApprove: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<SalesOrderDetail>>;

/**
 * The detail page's status-transition button row — no "Create Delivery
 * Challan" here (feature-spec 37 owns that; mirrors
 * quotation-status-actions.tsx's identical forward-note for "Convert to
 * Sales Order"). Each button is only rendered when both the current status
 * permits the transition and the caller holds the matching permission.
 */
export function SalesOrderStatusActions({ salesOrder, canEdit, canApprove }: SalesOrderStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<SalesOrderStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: SalesOrderStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(salesOrder.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the sales order.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the sales order.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;
  const canCancel = salesOrder.status === "DRAFT" ? canEdit : salesOrder.status === "CONFIRMED" ? canApprove : false;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && salesOrder.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(confirmSalesOrderAction, "CONFIRMED", "Sales order confirmed.")}
        >
          {pending === "CONFIRMED" ? "Confirming…" : "Confirm"}
        </Button>
      ) : null}

      {canEdit && salesOrder.status === "DELIVERED" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(closeSalesOrderAction, "CLOSED", "Sales order closed.")}
        >
          {pending === "CLOSED" ? "Closing…" : "Close"}
        </Button>
      ) : null}

      {canCancel && (salesOrder.status === "DRAFT" || salesOrder.status === "CONFIRMED") ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelSalesOrderAction, "CANCELLED", "Sales order cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
