"use server";

import { runAction } from "@/lib/run-action";
import { gstr1Service } from "@/modules/gst/services/gstr1-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import { markPeriodFiledSchema } from "@/modules/gst/validation/gst-filing-schema";
import type { ActionResult } from "@/types/api";
import type { GstFilingRecord, Gstr1Return } from "@/types/gstr1";

const GSTR1_PATH = "/gst/gstr-1";

export async function getGstr1ReturnAction(rawFilters: unknown): Promise<ActionResult<Gstr1Return>> {
  return runAction(() => {
    const filters = gstReportFiltersSchema.parse(rawFilters);
    return gstr1Service.getGstr1Return({ from: toUtcDate(filters.from), to: toUtcDate(filters.to) });
  }, []);
}

export async function getGstr1FilingRecordAction(
  periodStart: string,
  periodEnd: string
): Promise<ActionResult<GstFilingRecord | null>> {
  return runAction(() => gstr1Service.getFilingRecord(toUtcDate(periodStart), toUtcDate(periodEnd)), []);
}

export async function markGstr1PeriodFiledAction(rawInput: unknown): Promise<ActionResult<GstFilingRecord>> {
  return runAction(() => {
    const input = markPeriodFiledSchema.parse(rawInput);
    return gstr1Service.markPeriodFiled({
      periodStart: toUtcDate(input.periodStart),
      periodEnd: toUtcDate(input.periodEnd),
      arn: input.arn,
    });
  }, [GSTR1_PATH]);
}

export async function reopenGstr1PeriodAction(id: string): Promise<ActionResult<GstFilingRecord>> {
  return runAction(() => gstr1Service.reopenPeriod(id), [GSTR1_PATH]);
}
