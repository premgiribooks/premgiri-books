"use server";

import { runAction } from "@/lib/run-action";
import type { LiabilitySettlementReport } from "@/types/liability-settlement";
import { liabilitySettlementService } from "@/modules/liability-settlement/services/liability-settlement-service";
import { trialBalanceFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";
import type { ActionResult } from "@/types/api";

// Read-only — nothing to revalidate, mirroring trial-balance-actions.ts's
// identical rationale (a real action boundary for a future client-driven
// refresh, not because this screen currently calls it from the client).
export async function getOutstandingLiabilitiesAction(rawFilters: unknown): Promise<ActionResult<LiabilitySettlementReport>> {
  return runAction(() => {
    const filters = trialBalanceFiltersSchema.parse(rawFilters);
    return liabilitySettlementService.getOutstandingLiabilities(filters);
  }, []);
}
