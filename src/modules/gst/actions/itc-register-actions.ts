"use server";

import { runAction } from "@/lib/run-action";
import { itcRegisterService } from "@/modules/gst/services/itc-register-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { ActionResult } from "@/types/api";
import type { ItcRegisterResult } from "@/types/itc-register";

// Read-only — nothing to revalidate. Reuses 57-gst-registers.md's shared
// gstReportFiltersSchema unmodified (Validation, 83-itc-register.md); page/
// pageSize are accepted by the schema but ignored here — this report has no
// pagination concept, matching 60-hsn-summary.md's own precedent.
export async function getItcRegisterAction(rawFilters: unknown): Promise<ActionResult<ItcRegisterResult>> {
  return runAction(() => {
    const filters = gstReportFiltersSchema.parse(rawFilters);
    return itcRegisterService.getItcRegister({
      from: toUtcDate(filters.from),
      to: toUtcDate(filters.to),
      partyId: filters.partyId,
      hsnCode: filters.hsnCode,
      ratePercent: filters.ratePercent,
    });
  }, []);
}
