"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/common/loading-bar";
import {
  cancelDeliveryChallanAction,
  dispatchDeliveryChallanAction,
} from "@/modules/delivery-challans/actions/delivery-challan-actions";
import type { ActionResult } from "@/types/api";
import type { DeliveryChallanDetail, DeliveryChallanStatus } from "@/types/delivery-challan";

interface DeliveryChallanStatusActionsProps {
  deliveryChallan: DeliveryChallanDetail;
  /** Gated on "sales"/"edit" — Dispatch and Cancel. */
  canEdit: boolean;
  /** Gated on "sales"/"create" — Create Invoice (feature-spec 38), the same
   * permission the "New Sales Invoice" button uses. Just a link to
   * /sales/invoices/new?deliveryChallanId=; the invoice form itself
   * pre-fills from the challan's own lines. */
  canCreateInvoice: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<DeliveryChallanDetail>>;

/**
 * The detail page's status-transition button row, including "Create
 * Invoice" (feature-spec 38). `DISPATCHED -> INVOICED` itself is automatic
 * (Sales Invoice's posting flow) — no button for that transition, mirrors
 * sales-order-status-actions.tsx's forward-note convention.
 */
export function DeliveryChallanStatusActions({ deliveryChallan, canEdit, canCreateInvoice }: DeliveryChallanStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<DeliveryChallanStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: DeliveryChallanStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(deliveryChallan.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the delivery challan.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the delivery challan.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && deliveryChallan.status === "DRAFT" ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(dispatchDeliveryChallanAction, "DISPATCHED", "Delivery challan dispatched.")}
        >
          {pending === "DISPATCHED" ? <LoadingBar className="w-8" label="Dispatching" data-icon="inline-start" /> : null}
          {pending === "DISPATCHED" ? "Dispatching…" : "Dispatch"}
        </Button>
      ) : null}

      {canEdit && deliveryChallan.status === "DRAFT" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelDeliveryChallanAction, "CANCELLED", "Delivery challan cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}

      {canCreateInvoice && deliveryChallan.status === "DISPATCHED" ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/sales/invoices/new?deliveryChallanId=${deliveryChallan.id}`}>Create Invoice</Link>}
        />
      ) : null}
    </div>
  );
}
