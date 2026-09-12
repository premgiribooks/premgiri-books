"use server";

import { runAction } from "@/lib/run-action";
import type { ProfitAndLossReport } from "@/engines/reporting/types";
import { profitAndLossService } from "@/modules/reports/services/profit-and-loss-service";
import { profitAndLossFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";
import type { ActionResult } from "@/types/api";

// Read-only — nothing to revalidate. Kept as a Server Action (rather than
// letting the page call profitAndLossService directly) so a future
// client-driven refresh has a real action boundary to call, mirroring
// trial-balance-actions.ts's identical rationale.
export async function getProfitAndLossReportAction(rawFilters: unknown): Promise<ActionResult<ProfitAndLossReport>> {
  return runAction(() => {
    const filters = profitAndLossFiltersSchema.parse(rawFilters);
    return profitAndLossService.getProfitAndLoss(filters);
  }, []);
}
