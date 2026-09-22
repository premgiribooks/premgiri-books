"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { stockAdjustmentService } from "@/modules/stock-adjustments/services/stock-adjustment-service";
import type { CreateStockAdjustmentInput, UpdateStockAdjustmentInput } from "@/modules/stock-adjustments/validation/stock-adjustment-schema";
import type { ActionResult } from "@/types/api";
import type { StockAdjustmentDetail, StockAdjustmentListFilters, StockAdjustmentListRow } from "@/types/stock-adjustment";

const LIST_PATH = "/inventory/adjustments";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Stock Adjustments list — a pure read,
 * so no paths are revalidated. */
export async function loadMoreStockAdjustmentsAction(
  filters: StockAdjustmentListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<StockAdjustmentListRow>>> {
  return runAction(() => stockAdjustmentService.listStockAdjustmentsPage(filters, { skip, take }), []);
}

export async function createStockAdjustmentDraftAction(
  input: CreateStockAdjustmentInput
): Promise<ActionResult<StockAdjustmentDetail>> {
  return runAction(() => stockAdjustmentService.createDraft(input), [LIST_PATH]);
}

export async function updateStockAdjustmentDraftAction(
  id: string,
  input: UpdateStockAdjustmentInput
): Promise<ActionResult<StockAdjustmentDetail>> {
  return runAction(() => stockAdjustmentService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

export async function postStockAdjustmentAction(id: string): Promise<ActionResult<StockAdjustmentDetail>> {
  return runAction(() => stockAdjustmentService.postStockAdjustment(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelStockAdjustmentAction(id: string): Promise<ActionResult<StockAdjustmentDetail>> {
  return runAction(() => stockAdjustmentService.cancelStockAdjustment(id), [LIST_PATH, detailPath(id)]);
}
