"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/common/loading-bar";
import {
  cancelPhysicalVerificationAction,
  completePhysicalVerificationAction,
} from "@/modules/physical-verifications/actions/physical-verification-actions";
import type { ActionResult } from "@/types/api";
import type { PhysicalVerificationDetail, PhysicalVerificationStatus } from "@/types/physical-verification";

interface PhysicalVerificationStatusActionsProps {
  physicalVerification: PhysicalVerificationDetail;
  /** Gated on "inventory"/"approve" — Complete (every completion requires
   * approve, unconditionally, mirroring Stock Adjustment/Transfer's
   * Post-gate). */
  canComplete: boolean;
  /** Gated on "inventory"/"approve" — Cancel. */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<PhysicalVerificationDetail>>;

/** The detail page's status-transition button row — Complete and Cancel,
 * both DRAFT-only (49-physical-verification.md's UI: "Cancel only shown
 * while DRAFT"; Complete is equally only meaningful on a DRAFT). Mirrors
 * stock-transfer-status-actions.tsx. */
export function PhysicalVerificationStatusActions({
  physicalVerification,
  canComplete,
  canCancel,
}: PhysicalVerificationStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PhysicalVerificationStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: PhysicalVerificationStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(physicalVerification.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the physical verification.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the physical verification.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;
  const isDraft = physicalVerification.status === "DRAFT";

  return (
    <div className="flex flex-wrap gap-2">
      {canComplete && isDraft ? (
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => runTransition(completePhysicalVerificationAction, "COMPLETED", "Physical verification completed.")}
        >
          {pending === "COMPLETED" ? <LoadingBar className="w-8" label="Completing" data-icon="inline-start" /> : null}
          {pending === "COMPLETED" ? "Completing…" : "Complete"}
        </Button>
      ) : null}

      {canCancel && isDraft ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelPhysicalVerificationAction, "CANCELLED", "Physical verification cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
