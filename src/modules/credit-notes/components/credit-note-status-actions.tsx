"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelCreditNoteAction, postCreditNoteAction } from "@/modules/credit-notes/actions/credit-note-actions";
import type { ActionResult } from "@/types/api";
import type { CreditNoteDetail, CreditNoteStatus } from "@/types/credit-note";

interface CreditNoteStatusActionsProps {
  creditNote: CreditNoteDetail;
  /** Gated on "sales"/"approve" — Post (every Credit Note post requires
   * approve, unconditionally, since it always reduces recognized revenue). */
  canPost: boolean;
  /** Gated on "sales"/"approve" — Cancel. */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<CreditNoteDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors sales-return-status-actions.tsx. */
export function CreditNoteStatusActions({ creditNote, canPost, canCancel }: CreditNoteStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<CreditNoteStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: CreditNoteStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(creditNote.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the credit note.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the credit note.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && creditNote.status === "DRAFT" ? (
        <Button size="sm" disabled={isBusy} onClick={() => runTransition(postCreditNoteAction, "POSTED", "Credit note posted.")}>
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && creditNote.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelCreditNoteAction, "CANCELLED", "Credit note cancelled.")}
        >
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
