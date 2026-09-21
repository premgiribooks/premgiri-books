"use client";

import { Percent } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMarginOverride } from "@/hooks/use-margin-override";
import { dispatchShortcut } from "@/lib/shortcut-events";

/**
 * The one on-screen indicator that a temporary margin override is active
 * (never shown in print — see margin-override-dialog.tsx). Renders nothing
 * when no override is set. Clicking it reopens the same dialog Ctrl+Shift+M
 * opens.
 */
export function MarginOverrideBadge() {
  const override = useMarginOverride();

  if (!override) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 border-ai/40 bg-ai/10 text-ai-foreground hover:bg-ai/20"
      onClick={() => dispatchShortcut("margin-override")}
      title="A temporary margin override is active on screen and in print (Ctrl+Shift+M to change)"
    >
      <Percent size={14} />
      {override.marginPercent}% custom margin
    </Button>
  );
}
