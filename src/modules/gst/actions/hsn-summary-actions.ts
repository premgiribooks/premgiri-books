"use server";

import { runAction } from "@/lib/run-action";
import { hsnSummaryService } from "@/modules/gst/services/hsn-summary-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { ActionResult } from "@/types/api";
import type { HsnSummaryResult } from "@/types/hsn-summary";

// Read-only — nothing to revalidate. Reuses 57-gst-registers.md's shared
// gstReportFiltersSchema unmodified (Validation, 60-hsn-summary.md); page/
// pageSize are accepted by the schema but ignored here — this report has no
// pagination concept (UI, 60-hsn-summary.md).
export async function getHsnSummaryAction(rawFilters: unknown): Promise<ActionResult<HsnSummaryResult>> {
  return runAction(() => {
    const filters = gstReportFiltersSchema.parse(rawFilters);
    return hsnSummaryService.getHsnSummary({
      from: toUtcDate(filters.from),
      to: toUtcDate(filters.to),
      partyId: filters.partyId,
      hsnCode: filters.hsnCode,
      ratePercent: filters.ratePercent,
    });
  }, []);
}
