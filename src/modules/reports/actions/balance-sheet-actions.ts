"use server";

import { runAction } from "@/lib/run-action";
import type { BalanceSheetReport } from "@/engines/reporting/types";
import { balanceSheetService } from "@/modules/reports/services/balance-sheet-service";
import { trialBalanceFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";
import type { ActionResult } from "@/types/api";

// Read-only — nothing to revalidate. Kept as a Server Action (rather than
// letting the page call balanceSheetService directly) so a future
// client-driven refresh has a real action boundary to call, mirroring
// trial-balance-actions.ts's identical rationale.
export async function getBalanceSheetReportAction(rawFilters: unknown): Promise<ActionResult<BalanceSheetReport>> {
  return runAction(() => {
    const filters = trialBalanceFiltersSchema.parse(rawFilters);
    return balanceSheetService.getBalanceSheet(filters);
  }, []);
}
