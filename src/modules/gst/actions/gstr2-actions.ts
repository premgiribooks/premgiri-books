"use server";

import { runAction } from "@/lib/run-action";
import { gstr2Service } from "@/modules/gst/services/gstr2-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { ActionResult } from "@/types/api";
import type { Gstr2Return } from "@/types/gstr2";

// Read-only — nothing to revalidate. Reuses 57-gst-registers.md's shared
// gstReportFiltersSchema unmodified (Validation, 82-gstr-2.md); partyId/
// hsnCode/ratePercent/page/pageSize are accepted by the schema but unused
// here — this report has no optional-filter or pagination concept of its own
// (it renders the full statutory table shape for the selected period).
export async function getGstr2ReturnAction(rawFilters: unknown): Promise<ActionResult<Gstr2Return>> {
  return runAction(() => {
    const filters = gstReportFiltersSchema.parse(rawFilters);
    return gstr2Service.getGstr2Return({ from: toUtcDate(filters.from), to: toUtcDate(filters.to) });
  }, []);
}
