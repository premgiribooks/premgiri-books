"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { priceListService } from "@/modules/price-lists/services/price-list-service";
import type {
  CreatePriceListInput,
  PriceListItemInput,
  UpdatePriceListInput,
  UpdatePriceListItemInput,
} from "@/modules/price-lists/validation/price-list-schema";
import type { ActionResult } from "@/types/api";
import type {
  PriceList,
  PriceListDetail,
  PriceListItemWithProduct,
  PriceListListFilters,
  PriceListWithItemCount,
} from "@/types/price-list";

const LIST_PATH = "/masters/price-lists";

function editPath(id: string): string {
  return `/masters/price-lists/${id}/edit`;
}

/** Infinite-scroll "load more" for the Price Lists list — a pure read, so no
 * paths are revalidated. */
export async function loadMorePriceListsAction(
  filters: PriceListListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<PriceListWithItemCount>>> {
  return runAction(() => priceListService.listPriceListsPage(filters, { skip, take }), []);
}

export async function createPriceListAction(
  input: CreatePriceListInput
): Promise<ActionResult<PriceListDetail>> {
  return runAction(() => priceListService.createPriceList(input), [LIST_PATH]);
}

export async function updatePriceListAction(
  id: string,
  input: UpdatePriceListInput
): Promise<ActionResult<PriceListDetail>> {
  return runAction(() => priceListService.updatePriceList(id, input), [LIST_PATH, editPath(id)]);
}

export async function activatePriceListAction(id: string): Promise<ActionResult<PriceList>> {
  return runAction(() => priceListService.activatePriceList(id), [LIST_PATH]);
}

export async function deactivatePriceListAction(id: string): Promise<ActionResult<PriceList>> {
  return runAction(() => priceListService.deactivatePriceList(id), [LIST_PATH]);
}

export async function addPriceListItemAction(
  listId: string,
  input: PriceListItemInput
): Promise<ActionResult<PriceListItemWithProduct>> {
  return runAction(() => priceListService.addItem(listId, input), [editPath(listId)]);
}

export async function updatePriceListItemAction(
  listId: string,
  itemId: string,
  input: UpdatePriceListItemInput
): Promise<ActionResult<PriceListItemWithProduct>> {
  return runAction(() => priceListService.updateItem(listId, itemId, input), [editPath(listId)]);
}

export async function removePriceListItemAction(
  listId: string,
  itemId: string
): Promise<ActionResult<void>> {
  return runAction(() => priceListService.removeItem(listId, itemId), [editPath(listId)]);
}

// Read-only — no revalidation. Backs the items editor's temporary margin
// override (Ctrl+Shift+M) — never persisted, see
// price-list-service.ts's resolveProductPurchaseCost.
export async function resolveProductPurchaseCostAction(productId: string): Promise<ActionResult<number | null>> {
  return runAction(() => priceListService.resolveProductPurchaseCost(productId), []);
}
