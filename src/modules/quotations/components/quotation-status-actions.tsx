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
import type { ActionResult } from "@/types/api";
import type { QuotationDetail, QuotationStatus } from "@/types/quotation";

interface QuotationStatusActionsProps {
  quotation: QuotationDetail;
  /** Gated on "sales"/"edit" — Send and Cancel. */
  canEdit: boolean;
  /** Gated on "sales"/"approve" — Accept and Reject. */
  canApprove: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<QuotationDetail>>;

/**
 * The detail page's status-transition button row — no "Convert to Sales
 * Order" here (feature-spec 36 owns that; see the forward note in
 * progress-tracker.md). Each button is only rendered when both the current
 * status permits the transition and the caller holds the matching
 * permission.
 */
export function QuotationStatusActions({ quotation, canEdit, canApprove }: QuotationStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<QuotationStatus | null>(null);

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
    </div>
  );
}
