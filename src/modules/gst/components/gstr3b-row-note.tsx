"use client";

import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Gstr3bRowNoteProps {
  reason: string;
  /** "not-tracked" (default) marks a row this codebase cannot compute at
   * all; "note" marks a computed row that still carries an explanatory
   * caveat (e.g. Table 4(C) Net ITC's equality note) — 59-gstr-3b.md's UI
   * section requires both to be visually distinct from a genuine ₹0, never
   * silently blank or indistinguishable. */
  variant?: "not-tracked" | "note";
}

export function Gstr3bRowNote({ reason, variant = "not-tracked" }: Gstr3bRowNoteProps) {
  if (!reason) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className="gap-1 border-dashed text-muted-foreground">
          <Info size={12} />
          {variant === "not-tracked" ? "Not tracked" : "Note"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
