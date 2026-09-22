import { roundHalfUpToTwoDecimals } from "@/engines/pricing/price-resolution";

// Backs the hidden "temporary margin override" feature (Ctrl+Shift+M): a
// user-typed markup percent that recomputes a DISPLAY/PRINT-only price from
// a line's real purchase cost. Never persisted — the saved/posted rate
// always comes from pricingEngine.resolvePrice, untouched by this. Reuses
// the same MARKUP formula as applyProfile (price-resolution.ts) instead of
// duplicating it, so "no price math outside src/engines/pricing/" stays
// true for this feature too.

export const MARGIN_OVERRIDE_MIN_PERCENT = 0;
export const MARGIN_OVERRIDE_MAX_PERCENT = 95;

export function isValidMarginOverridePercent(value: number): boolean {
  return (
    Number.isFinite(value) && value >= MARGIN_OVERRIDE_MIN_PERCENT && value <= MARGIN_OVERRIDE_MAX_PERCENT
  );
}

/**
 * price = cost x (1 + percent / 100) — the Margin Profile "MARKUP" formula,
 * applied to a caller-supplied percent instead of a stored profile row.
 * Returns `null` when `purchaseCost` is unknown, mirroring
 * ResolvePriceResult's own null-cost handling.
 */
export function applyMarginOverride(purchaseCost: number | null, marginPercent: number): number | null {
  if (purchaseCost === null || !isValidMarginOverridePercent(marginPercent)) {
    return null;
  }
  return roundHalfUpToTwoDecimals(purchaseCost * (1 + marginPercent / 100));
}
