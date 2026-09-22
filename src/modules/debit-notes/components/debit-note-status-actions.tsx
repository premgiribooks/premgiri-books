"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LoadingBar } from "@/components/common/loading-bar";
import { Button } from "@/components/ui/button";
import { cancelDebitNoteAction, postDebitNoteAction } from "@/modules/debit-notes/actions/debit-note-actions";
import type { ActionResult } from "@/types/api";
import type { DebitNoteDetail, DebitNoteStatus } from "@/types/debit-note";

interface DebitNoteStatusActionsProps {
  debitNote: DebitNoteDetail;
  /** Gated on "sales"/"approve" — Post (every Debit Note post requires
   * approve, unconditionally, since it always increases what a customer owes). */
  canPost: boolean;
  /** Gated on "sales"/"approve" — Cancel. */
  canCancel: boolean;
}

type TransitionAction = (id: string) => Promise<ActionResult<DebitNoteDetail>>;

/** The detail page's status-transition button row — Post (DRAFT only) and
 * Cancel (POSTED only). Mirrors credit-note-status-actions.tsx. */
export function DebitNoteStatusActions({ debitNote, canPost, canCancel }: DebitNoteStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<DebitNoteStatus | null>(null);

  async function runTransition(action: TransitionAction, pendingKey: DebitNoteStatus, successMessage: string) {
    setPending(pendingKey);
    try {
      const result = await action(debitNote.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the debit note.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } catch {
      toast.error("Failed to update the debit note.");
    } finally {
      setPending(null);
    }
  }

  const isBusy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {canPost && debitNote.status === "DRAFT" ? (
        <Button size="sm" disabled={isBusy} onClick={() => runTransition(postDebitNoteAction, "POSTED", "Debit note posted.")}>
          {pending === "POSTED" ? <LoadingBar className="w-8" label="Posting" data-icon="inline-start" /> : null}
          {pending === "POSTED" ? "Posting…" : "Post"}
        </Button>
      ) : null}

      {canCancel && debitNote.status === "POSTED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => runTransition(cancelDebitNoteAction, "CANCELLED", "Debit note cancelled.")}
        >
          {pending === "CANCELLED" ? <LoadingBar className="w-8" label="Cancelling" data-icon="inline-start" /> : null}
          {pending === "CANCELLED" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
