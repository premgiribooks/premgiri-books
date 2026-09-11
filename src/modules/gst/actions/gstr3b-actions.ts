"use server";

import { runAction } from "@/lib/run-action";
import { markPeriodFiledSchema } from "@/modules/gst/validation/gst-filing-schema";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import { gstr3bService } from "@/modules/gst/services/gstr3b-service";
import type { ActionResult } from "@/types/api";
import type { GstFilingRecord } from "@/types/gstr1";
import type { Gstr3bReturn } from "@/types/gstr3b";

const GSTR3B_PATH = "/gst/gstr-3b";

export async function getGstr3BReturnAction(rawFilters: unknown): Promise<ActionResult<Gstr3bReturn>> {
  return runAction(() => {
    const filters = gstReportFiltersSchema.parse(rawFilters);
    return gstr3bService.getGstr3BReturn({ from: toUtcDate(filters.from), to: toUtcDate(filters.to) });
  }, []);
}

export async function getGstr3BFilingRecordAction(
  periodStart: string,
  periodEnd: string
): Promise<ActionResult<GstFilingRecord | null>> {
  return runAction(() => gstr3bService.getFilingRecord(toUtcDate(periodStart), toUtcDate(periodEnd)), []);
}

export async function markGstr3BPeriodFiledAction(rawInput: unknown): Promise<ActionResult<GstFilingRecord>> {
  return runAction(() => {
    const input = markPeriodFiledSchema.parse(rawInput);
    return gstr3bService.markPeriodFiled({
      periodStart: toUtcDate(input.periodStart),
      periodEnd: toUtcDate(input.periodEnd),
      arn: input.arn,
    });
  }, [GSTR3B_PATH]);
}

export async function reopenGstr3BPeriodAction(id: string): Promise<ActionResult<GstFilingRecord>> {
  return runAction(() => gstr3bService.reopenPeriod(id), [GSTR3B_PATH]);
}
