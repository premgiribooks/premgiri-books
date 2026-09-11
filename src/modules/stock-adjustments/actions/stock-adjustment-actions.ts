"use server";

import { runAction } from "@/lib/run-action";
import { stockAdjustmentService } from "@/modules/stock-adjustments/services/stock-adjustment-service";
import type { CreateStockAdjustmentInput, UpdateStockAdjustmentInput } from "@/modules/stock-adjustments/validation/stock-adjustment-schema";
import type { ActionResult } from "@/types/api";
import type { StockAdjustmentDetail } from "@/types/stock-adjustment";

const LIST_PATH = "/inventory/adjustments";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
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
