"use server";

import { runAction } from "@/lib/run-action";
import { applyMarginOverride } from "@/engines/pricing/margin-override";
import type { ActionResult } from "@/types/api";

// Lives here (not a single module's actions/ folder) because the "temporary
// margin override" feature applies uniformly across every Sales document
// type (see margin-override-cookie.ts's file comment) — one shared action
// instead of an identical wrapper duplicated per module.

/**
 * Read-only, no revalidation. Wraps applyMarginOverride as a Server Action so
 * client components (line rows, print buttons) never call Pricing Engine
 * math directly — only through an approved application boundary, same as
 * every other price calculation in this codebase.
 */
export async function previewMarginOverrideRateAction(input: {
  purchaseCost: number | null;
  marginPercent: number;
}): Promise<ActionResult<number | null>> {
  return runAction(() => Promise.resolve(applyMarginOverride(input.purchaseCost, input.marginPercent)), []);
}
