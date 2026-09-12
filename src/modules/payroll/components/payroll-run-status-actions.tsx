"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelPayrollRunAction,
  postPayrollRunAction,
  refreshPayrollRunDraftAction,
} from "@/modules/payroll/actions/payroll-run-actions";
import type { ActionResult } from "@/types/api";
import type { PayrollRunDetail } from "@/types/payroll-run";

interface PayrollRunStatusActionsProps {
  payrollRun: PayrollRunDetail;
  /** Gated on "employees"/"create" — Refresh (recompute a DRAFT's lines). */
  canRefresh: boolean;
  /** Gated on "employees"/"approve" — Post and Cancel (63-payroll.md's
   * Security section: posting/cancelling commits or reverses a real
   * company-wide financial liability). */
  canApprove: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<PayrollRunDetail>>;

/** The detail page's status-transition button row — Refresh (DRAFT only),
 * Post (DRAFT only), and Cancel (POSTED only). Mirrors
 * purchase-invoice-status-actions.tsx. */
export function PayrollRunStatusActions({ payrollRun, canRefresh, canApprove }: PayrollRunStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"REFRESH" | "POSTED" | "CANCELLED" | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: "REFRESH" | "POSTED" | "CANCELLED", successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(payrollRun.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the payroll run.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the payroll run.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canRefresh && payrollRun.status === "DRAFT" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(refreshPayrollRunDraftAction, "REFRESH", "Payroll run refreshed.")}
        >
          {pending === "REFRESH" ? "Refreshing…" : "Refresh"}
        </Button>
      ) : null}

      {canApprove && payrollRun.status === "DRAFT" ? (
        <Button size="sm" disabled={isBusy} onClick={() => runTransition(postPayrollRunAction, "POSTED", "Payroll run posted.")}>
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canApprove && payrollRun.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelPayrollRunAction, "CANCELLED", "Payroll run cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
