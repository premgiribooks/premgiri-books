import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import type { GstReportFilters } from "@/types/gst-report";

/**
 * Shared partyId/hsnCode/ratePercent line-level predicate — 57-gst-registers.md's
 * own optional-filter semantics, reused unmodified by 60-hsn-summary.md so
 * both reports apply the exact same filter meaning ahead of their own
 * pagination/grouping step. Extracted here (rather than duplicated) per
 * code-standards.md's "Never duplicate business logic across modules".
 */
export function matchesOptionalGstReportFilters(
  line: GstSupplyLine,
  filters: Pick<GstReportFilters, "partyId" | "hsnCode" | "ratePercent">
): boolean {
  if (filters.partyId && line.partyId !== filters.partyId) {
    return false;
  }
  if (filters.hsnCode && line.hsnCode !== filters.hsnCode) {
    return false;
  }
  if (filters.ratePercent !== undefined && line.ratePercent !== filters.ratePercent) {
    return false;
  }
  return true;
}
