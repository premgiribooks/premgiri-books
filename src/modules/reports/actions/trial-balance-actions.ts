"use server";

import { runAction } from "@/lib/run-action";
import type { TrialBalanceReport } from "@/engines/reporting/types";
import { trialBalanceReportService } from "@/modules/reports/services/trial-balance-report-service";
import { trialBalanceFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";
import type { ActionResult } from "@/types/api";

// Read-only — nothing to revalidate. Kept as a Server Action (rather than
// letting the page call trialBalanceReportService directly) so a future
// client-driven refresh has a real action boundary to call, mirroring
// gst-register-actions.ts's identical rationale.
export async function getTrialBalanceReportAction(rawFilters: unknown): Promise<ActionResult<TrialBalanceReport>> {
  return runAction(() => {
    const filters = trialBalanceFiltersSchema.parse(rawFilters);
    return trialBalanceReportService.getTrialBalanceReport(filters);
  }, []);
}
