type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

export interface UpdateToastDescription {
  tone: "info" | "success";
  message: string;
  /** Downloaded updates stay visible until the user acts; others self-dismiss. */
  persistent: boolean;
}

/**
 * Decides what (if anything) the in-app toast should say for a given update
 * status. "checking", "not-available", and "error" deliberately render
 * nothing: this is an offline-first desktop app run by users who are often
 * not connected to the internet, and surfacing a toast for every failed
 * background check would train them to ignore the app's notifications
 * altogether. A real problem is still visible via the Help menu's
 * "Check for Updates…" action, which always answers explicitly.
 */
export function describeUpdateToast(status: UpdateStatus): UpdateToastDescription | null {
  switch (status.state) {
    case "checking":
    case "not-available":
    case "error":
      return null;
    case "available":
      return {
        tone: "info",
        message: `Update ${status.version} available — downloading…`,
        persistent: false,
      };
    case "downloading":
      return {
        tone: "info",
        message: `Downloading update… ${status.percent}%`,
        persistent: false,
      };
    case "downloaded":
      return {
        tone: "success",
        message: `Update ${status.version} downloaded. Restart to install now, or it will install next time you quit.`,
        persistent: true,
      };
  }
}
