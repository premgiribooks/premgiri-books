"use client";

import { useMarginOverride } from "@/hooks/use-margin-override";
import { dispatchShortcut } from "@/lib/shortcut-events";

/**
 * The one on-screen indicator that a temporary margin override is active
 * (never shown in print — see margin-override-dialog.tsx). Deliberately
 * minimal per explicit user request: just "CM", yellow, nothing else — no
 * percent, no breakdown text. Reused wherever a page needs to show one
 * (top navbar, Sales Invoice Create/Edit form, Sales Invoice detail page).
 * Renders nothing when no override is set. Clicking it reopens the same
 * dialog Ctrl+Shift+M opens; the percent is still visible there.
 */
export function MarginOverrideBadge() {
  const override = useMarginOverride();

  if (!override) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => dispatchShortcut("margin-override")}
      title="A temporary custom margin is active on screen and in print — click to change"
      className="inline-flex h-6 items-center rounded-md border border-warning/30 bg-warning/10 px-2 text-xs font-semibold text-warning"
    >
      CM
    </button>
  );
}
