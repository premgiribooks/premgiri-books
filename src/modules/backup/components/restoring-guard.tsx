"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { getRestoreStatusAction } from "@/modules/backup/actions/backup-actions";

const POLL_INTERVAL_MS = 3000;

interface RestoringGuardProps {
  children: ReactNode;
}

/**
 * Defense-in-depth for a SECOND browser tab/window sitting on this page
 * while a Restore triggered elsewhere is running — `RestoreConfirmationDialog`
 * already shows its own full-screen block for the initiating tab, for the
 * exact duration of its own (synchronous) Server Action call, but a second
 * tab has no such call in flight to await. This polls the process-wide
 * restore-lock flag instead, so every open tab shows the same blocking
 * state per 81-backup-restore.md's maintenance-mode requirement.
 */
export function RestoringGuard({ children }: RestoringGuardProps) {
  const [isRestoring, setIsRestoring] = React.useState(false);
  const wasRestoring = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await getRestoreStatusAction();
      if (cancelled || !result.success || !result.data) {
        return;
      }

      if (wasRestoring.current && !result.data.isRestoring) {
        window.location.reload();
        return;
      }
      wasRestoring.current = result.data.isRestoring;
      setIsRestoring(result.data.isRestoring);
    }

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isRestoring) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 text-center">
        <p className="text-lg font-semibold text-foreground">Restoring — do not close the application</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A restore is running elsewhere on this installation. This page will reload automatically when it finishes.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
