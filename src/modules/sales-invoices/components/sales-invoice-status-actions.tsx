"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/common/loading-bar";
import {
  cancelSalesInvoiceAction,
  postSalesInvoiceAction,
} from "@/modules/sales-invoices/actions/sales-invoice-actions";
import type { ActionResult } from "@/types/api";
import type { SalesInvoiceDetail, SalesInvoiceStatus } from "@/types/sales-invoice";

interface SalesInvoiceStatusActionsProps {
  salesInvoice: SalesInvoiceDetail;
  /** Gated on "sales"/"create" — Post (the same permission Create uses). */
  canPost: boolean;
  /** Gated on "sales"/"approve" — Cancel (reversing a POSTED invoice's real
   * financial/stock entries is a stronger action than a routine edit). */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<SalesInvoiceDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors delivery-challan-status-actions.tsx. */
export function SalesInvoiceStatusActions({ salesInvoice, canPost, canCancel }: SalesInvoiceStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<SalesInvoiceStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: SalesInvoiceStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(salesInvoice.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the sales invoice.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the sales invoice.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && salesInvoice.status === "DRAFT" ? (
        <Button size="sm" disabled={isBusy} onClick={() => runTransition(postSalesInvoiceAction, "POSTED", "Sales invoice posted.")}>
          {pending === "POSTED" ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && salesInvoice.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelSalesInvoiceAction, "CANCELLED", "Sales invoice cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
