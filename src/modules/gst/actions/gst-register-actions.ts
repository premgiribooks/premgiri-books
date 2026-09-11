"use server";

import { runAction } from "@/lib/run-action";
import { gstRegisterService } from "@/modules/gst/services/gst-register-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstReportFiltersInput } from "@/modules/gst/validation/gst-report-filters-schema";
import type { ActionResult } from "@/types/api";
import type { GstPartyOption, GstRegisterResult, GstRegisterType } from "@/types/gst-report";

// Read-only — nothing to revalidate. Kept as Server Actions (rather than
// letting components import gstRegisterService directly) so a future
// client-driven refresh/pagination control has a real action boundary to
// call, mirroring getWarehouseStockPreviewAction's role in
// physical-verification-actions.ts.

function toServiceFilters(input: GstReportFiltersInput) {
  return {
    from: toUtcDate(input.from),
    to: toUtcDate(input.to),
    partyId: input.partyId,
    hsnCode: input.hsnCode,
    ratePercent: input.ratePercent,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getOutwardRegisterAction(rawFilters: unknown): Promise<ActionResult<GstRegisterResult>> {
  return runAction(() => {
    const filters = gstReportFiltersSchema.parse(rawFilters);
    return gstRegisterService.getOutwardRegister(toServiceFilters(filters));
  }, []);
}

export async function getInwardRegisterAction(rawFilters: unknown): Promise<ActionResult<GstRegisterResult>> {
  return runAction(() => {
    const filters = gstReportFiltersSchema.parse(rawFilters);
    return gstRegisterService.getInwardRegister(toServiceFilters(filters));
  }, []);
}

export async function listGstPartyOptionsAction(registerType: GstRegisterType): Promise<ActionResult<GstPartyOption[]>> {
  return runAction(() => gstRegisterService.listPartyOptions(registerType), []);
}
