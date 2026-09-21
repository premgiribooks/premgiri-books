"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MARGIN_OVERRIDE_MAX_PERCENT,
  MARGIN_OVERRIDE_MIN_PERCENT,
  isValidMarginOverridePercent,
} from "@/engines/pricing/margin-override";
import { marginOverrideDaysRemaining } from "@/lib/margin-override-cookie";
import { useShortcutEffect } from "@/lib/shortcut-events";
import { clearMarginOverride, setMarginOverride, useMarginOverride } from "@/hooks/use-margin-override";

/**
 * The Ctrl+Shift+M dialog (src/config/shortcuts.ts's reserved
 * "margin-override" shortcut). Mounted once in AppShell/PlatformShell, same
 * as ShortcutListener — works from any page, but only Sales document and
 * Price List pages actually read the resulting cookie (use-margin-override.ts)
 * to show a preview; everywhere else, setting it here is a harmless no-op.
 */
export function MarginOverrideDialog() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const override = useMarginOverride();

  useShortcutEffect("margin-override", () => {
    setValue(override ? String(override.marginPercent) : "");
    setOpen(true);
  });

  function handleSave() {
    const parsed = Number(value);
    if (!isValidMarginOverridePercent(parsed)) {
      toast.error(`Enter a margin between ${MARGIN_OVERRIDE_MIN_PERCENT} and ${MARGIN_OVERRIDE_MAX_PERCENT}.`);
      return;
    }
    setMarginOverride(parsed);
    toast.success(`Custom margin ${parsed}% is now active on screen and in print for 10 days.`);
    setOpen(false);
  }

  function handleClear() {
    clearMarginOverride();
    toast.success("Custom margin override cleared.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom Margin Override</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Shown on screen and in print only — saved records always keep the correct margin.
          </p>

          {override ? (
            <p className="text-xs text-muted-foreground">
              Currently active: <span className="font-financial">{override.marginPercent}%</span> — expires in{" "}
              {marginOverrideDaysRemaining(override)} day(s).
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="margin-override-percent">Margin % (markup on cost)</Label>
            <Input
              id="margin-override-percent"
              type="number"
              inputMode="decimal"
              min={MARGIN_OVERRIDE_MIN_PERCENT}
              max={MARGIN_OVERRIDE_MAX_PERCENT}
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSave();
                }
              }}
              placeholder="e.g. 30"
            />
          </div>
        </div>

        <DialogFooter>
          {override ? (
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear Override
            </Button>
          ) : null}
          <Button type="button" onClick={handleSave}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
