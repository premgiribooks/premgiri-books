"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { stockTransferService } from "@/modules/stock-transfers/services/stock-transfer-service";
import type { CreateStockTransferInput, UpdateStockTransferInput } from "@/modules/stock-transfers/validation/stock-transfer-schema";
import type { ActionResult } from "@/types/api";
import type { StockTransferDetail, StockTransferListFilters, StockTransferListRow } from "@/types/stock-transfer";

const LIST_PATH = "/inventory/transfers";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Stock Transfers list — a pure read,
 * so no paths are revalidated. */
export async function loadMoreStockTransfersAction(
  filters: StockTransferListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<StockTransferListRow>>> {
  return runAction(() => stockTransferService.listStockTransfersPage(filters, { skip, take }), []);
}

export async function createStockTransferDraftAction(
  input: CreateStockTransferInput
): Promise<ActionResult<StockTransferDetail>> {
  return runAction(() => stockTransferService.createDraft(input), [LIST_PATH]);
}

export async function updateStockTransferDraftAction(
  id: string,
  input: UpdateStockTransferInput
): Promise<ActionResult<StockTransferDetail>> {
  return runAction(() => stockTransferService.updateDraft(id, input), [LIST_PATH, detailPath(id), `${detailPath(id)}/edit`]);
}

export async function postStockTransferAction(id: string): Promise<ActionResult<StockTransferDetail>> {
  return runAction(() => stockTransferService.postStockTransfer(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelStockTransferAction(id: string): Promise<ActionResult<StockTransferDetail>> {
  return runAction(() => stockTransferService.cancelStockTransfer(id), [LIST_PATH, detailPath(id)]);
}
