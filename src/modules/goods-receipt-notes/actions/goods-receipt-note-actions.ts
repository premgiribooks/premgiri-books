"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";
import type {
  CreateGoodsReceiptNoteInput,
  UpdateGoodsReceiptNoteInput,
} from "@/modules/goods-receipt-notes/validation/goods-receipt-note-schema";
import type { ActionResult } from "@/types/api";
import type {
  GoodsReceiptNoteDetail,
  GoodsReceiptNoteListFilters,
  GoodsReceiptNoteListRow,
  PurchaseOrderPrefill,
} from "@/types/goods-receipt-note";

const LIST_PATH = "/purchase/receipts";
const PURCHASE_ORDER_LIST_PATH = "/purchase/orders";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Goods Receipt Notes list — a pure
 * read, so no paths are revalidated. */
export async function loadMoreGoodsReceiptNotesAction(
  filters: GoodsReceiptNoteListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<GoodsReceiptNoteListRow>>> {
  return runAction(() => goodsReceiptNoteService.listGoodsReceiptNotesPage(filters, { skip, take }), []);
}

export async function createGoodsReceiptNoteAction(
  input: CreateGoodsReceiptNoteInput
): Promise<ActionResult<GoodsReceiptNoteDetail>> {
  return runAction(() => goodsReceiptNoteService.createGoodsReceiptNote(input), [LIST_PATH]);
}

export async function updateGoodsReceiptNoteAction(
  id: string,
  input: UpdateGoodsReceiptNoteInput
): Promise<ActionResult<GoodsReceiptNoteDetail>> {
  return runAction(() => goodsReceiptNoteService.updateGoodsReceiptNote(id, input), [
    LIST_PATH,
    detailPath(id),
    `${detailPath(id)}/edit`,
  ]);
}

export async function receiveGoodsReceiptNoteAction(id: string): Promise<ActionResult<GoodsReceiptNoteDetail>> {
  return runAction(() => goodsReceiptNoteService.receiveGoodsReceiptNote(id), [
    LIST_PATH,
    detailPath(id),
    PURCHASE_ORDER_LIST_PATH,
  ]);
}

export async function cancelGoodsReceiptNoteAction(id: string): Promise<ActionResult<GoodsReceiptNoteDetail>> {
  return runAction(() => goodsReceiptNoteService.cancelGoodsReceiptNote(id), [LIST_PATH, detailPath(id)]);
}

// Read-only — no revalidation. Backs "New Goods Receipt Note"'s
// `?purchaseOrderId=` pre-fill (see goods-receipt-note-service.ts's file
// comment for why this replaces a dedicated createFromPurchaseOrder persist
// action).
export async function getPurchaseOrderPrefillAction(
  purchaseOrderId: string
): Promise<ActionResult<PurchaseOrderPrefill | null>> {
  return runAction(() => goodsReceiptNoteService.getPurchaseOrderPrefill(purchaseOrderId), []);
}
