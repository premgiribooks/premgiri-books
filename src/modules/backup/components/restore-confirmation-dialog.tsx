"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runRestoreAction } from "@/modules/backup/actions/backup-actions";
import { RESTORE_CONFIRMATION_PHRASE } from "@/modules/backup/validation/backup-schema";

interface RestoreConfirmationDialogProps {
  backupJobId: string;
  backupLabel: string;
  disabled?: boolean;
}

/**
 * 81-backup-restore.md's Restore confirmation — a plain "Are you sure?" is
 * not enough for an operation this destructive and irreversible-without-a-
 * backup. The Restore button stays disabled until the exact confirmation
 * phrase is typed; the server independently re-validates it regardless
 * (RESTORE_CONFIRMATION_PHRASE via restoreSchema's z.literal).
 *
 * On submit, this blocks with a full-screen "do not close" overlay for the
 * whole (synchronous, awaited) duration of the Server Action — the safety
 * backup and pg_restore both run inside that single call — then forces a
 * full page reload afterward so the browser and Prisma's connection pool
 * both start clean against the restored database, win or lose.
 */
export function RestoreConfirmationDialog({
  backupJobId,
  backupLabel,
  disabled = false,
}: RestoreConfirmationDialogProps) {
  const [confirmationText, setConfirmationText] = React.useState("");
  const [isRestoring, setIsRestoring] = React.useState(false);
  const canConfirm = confirmationText === RESTORE_CONFIRMATION_PHRASE;

  async function handleConfirm() {
    if (!canConfirm) {
      return;
    }
    setIsRestoring(true);
    const result = await runRestoreAction({ backupJobId, confirmationText });
    if (!result.success) {
      toast.error(result.error ?? "Restore failed.");
    }
    window.location.reload();
  }

  if (isRestoring) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 text-center">
        <p className="text-lg font-semibold text-foreground">Restoring — do not close the application</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A safety backup and the restore itself are running. This page will reload automatically when it finishes.
        </p>
      </div>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm" disabled={disabled}>
            Restore
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore from {backupLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            This replaces the entire database with this backup&apos;s contents — every company on this
            installation reverts to this point in time together. A safety backup of the current database is taken
            first automatically. Type <strong>{RESTORE_CONFIRMATION_PHRASE}</strong> below to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.target.value)}
          placeholder={RESTORE_CONFIRMATION_PHRASE}
          autoComplete="off"
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmationText("")}>Back</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={!canConfirm} onClick={handleConfirm}>
            Confirm Restore
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
