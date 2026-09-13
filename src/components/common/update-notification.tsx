"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { describeUpdateToast } from "@/lib/update-notification";

const UPDATE_TOAST_ID = "app-update-status";

/**
 * Mounted once in the root layout. No-ops outside the Electron renderer
 * (window.api is only injected by preload.ts), so it is safe to render the
 * same tree whether the app was opened in Electron or a plain browser tab
 * during `next dev`.
 */
export function UpdateNotification() {
  useEffect(() => {
    const updater = window.api?.updater;
    if (!updater) {
      return;
    }

    return updater.onStatus((status) => {
      const description = describeUpdateToast(status);
      if (!description) {
        return;
      }

      if (status.state === "downloaded") {
        toast.success(description.message, {
          id: UPDATE_TOAST_ID,
          duration: Infinity,
          action: {
            label: "Restart & Install",
            onClick: () => updater.installUpdate(),
          },
          cancel: {
            label: "Later",
            onClick: () => toast.dismiss(UPDATE_TOAST_ID),
          },
        });
        return;
      }

      toast.info(description.message, { id: UPDATE_TOAST_ID });
    });
  }, []);

  return null;
}
