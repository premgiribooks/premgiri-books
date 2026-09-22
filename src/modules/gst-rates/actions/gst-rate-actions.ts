"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import type {
  CreateGstRateInput,
  UpdateGstRateInput,
} from "@/modules/gst-rates/validation/gst-rate-schema";
import type { ActionResult } from "@/types/api";
import type { GstRate, GstRateListFilters } from "@/types/gst-rate";

const LIST_PATH = "/masters/gst-rates";

/** Infinite-scroll "load more" for the GST Rates list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreGstRatesAction(
  filters: GstRateListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<GstRate>>> {
  return runAction(() => gstRateService.listGstRatesPage(filters, { skip, take }), []);
}

export async function createGstRateAction(
  input: CreateGstRateInput
): Promise<ActionResult<GstRate>> {
  return runAction(() => gstRateService.createGstRate(input), [LIST_PATH]);
}

export async function updateGstRateAction(
  id: string,
  input: UpdateGstRateInput
): Promise<ActionResult<GstRate>> {
  return runAction(() => gstRateService.updateGstRate(id, input), [
    LIST_PATH,
    `/masters/gst-rates/${id}/edit`,
  ]);
}

export async function activateGstRateAction(id: string): Promise<ActionResult<GstRate>> {
  return runAction(() => gstRateService.activateGstRate(id), [LIST_PATH]);
}

export async function deactivateGstRateAction(id: string): Promise<ActionResult<GstRate>> {
  return runAction(() => gstRateService.deactivateGstRate(id), [LIST_PATH]);
}
