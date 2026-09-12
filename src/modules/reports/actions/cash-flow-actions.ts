"use server";

import { runAction } from "@/lib/run-action";
import type { CashFlowReport } from "@/engines/reporting/types";
import { cashFlowService } from "@/modules/reports/services/cash-flow-service";
import { profitAndLossFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";
import type { ActionResult } from "@/types/api";

// Read-only — nothing to revalidate. Kept as a Server Action (rather than
// letting the page call cashFlowService directly) so a future client-driven
// refresh has a real action boundary to call, mirroring
// profit-and-loss-actions.ts's identical rationale.
export async function getCashFlowReportAction(rawFilters: unknown): Promise<ActionResult<CashFlowReport>> {
  return runAction(() => {
    const filters = profitAndLossFiltersSchema.parse(rawFilters);
    return cashFlowService.getCashFlow(filters);
  }, []);
}
