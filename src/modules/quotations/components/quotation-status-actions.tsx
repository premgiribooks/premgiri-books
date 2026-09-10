"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  acceptQuotationAction,
  cancelQuotationAction,
  rejectQuotationAction,
  sendQuotationAction,
} from "@/modules/quotations/actions/quotation-actions";
import { createSalesOrderFromQuotationAction } from "@/modules/sales-orders/actions/sales-order-actions";
import type { ActionResult } from "@/types/api";
import type { QuotationDetail, QuotationStatus } from "@/types/quotation";

interface QuotationStatusActionsProps {
  quotation: QuotationDetail;
  /** Gated on "sales"/"edit" — Send and Cancel. */
  canEdit: boolean;
  /** Gated on "sales"/"approve" — Accept and Reject. */
  canApprove: boolean;
  /** Gated on "sales"/"create" — Convert to Sales Order (creates a new
   * document, the same permission the "New Quotation"/"New Sales Order"
   * buttons use). */
  canCreateSalesOrder: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<QuotationDetail>>;

/**
 * The detail page's status-transition button row, including "Convert to
 * Sales Order" (feature-spec 36) — `createFromQuotation` creates the new
 * DRAFT order directly (re-resolving price/GST fresh), and this button
 * redirects straight to that order's edit page so the user can review the
 * re-resolved lines before confirming.
 */
export function QuotationStatusActions({
  quotation,
  canEdit,
  canApprove,
  canCreateSalesOrder,
}: QuotationStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<QuotationStatus | "CONVERTING" | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: QuotationStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(quotation.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the quotation.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the quotation.");
    } finally {
      setPending(null);
    }
  }

  async function convertToSalesOrder() {
    setPending("CONVERTING");
    try {
      const result = await createSalesOrderFromQuotationAction(quotation.id);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to convert to a sales order.");
        return;
      }
      toast.success("Sales order created.");
      router.push(`/sales/orders/${result.data.id}/edit`);
    } catch {
      toast.error("Failed to convert to a sales order.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && quotation.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(sendQuotationAction, "SENT", "Quotation sent.")}
        >
          {pending === "SENT" ? "Sending…" : "Send"}
        </Button>
      ) : null}

      {canApprove && quotation.status === "SENT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(acceptQuotationAction, "ACCEPTED", "Quotation accepted.")}
        >
          {pending === "ACCEPTED" ? "Accepting…" : "Accept"}
        </Button>
      ) : null}

      {canApprove && quotation.status === "SENT" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(rejectQuotationAction, "REJECTED", "Quotation rejected.")}
        >
          {pending === "REJECTED" ? "Rejecting…" : "Reject"}
        </Button>
      ) : null}

      {canEdit && (quotation.status === "DRAFT" || quotation.status === "SENT") ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelQuotationAction, "CANCELLED", "Quotation cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}

      {canCreateSalesOrder && (quotation.status === "SENT" || quotation.status === "ACCEPTED") ? (
        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void convertToSalesOrder()}>
          {pending === "CONVERTING" ? "Converting…" : "Convert to Sales Order"}
        </Button>
      ) : null}
    </div>
  );
}
