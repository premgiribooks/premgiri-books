"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";
import type {
  CreatePurchaseOrderInput,
  PreviewPurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "@/modules/purchase-orders/validation/purchase-order-schema";
import type { ActionResult } from "@/types/api";
import type {
  PurchaseOrderDetail,
  PurchaseOrderListFilters,
  PurchaseOrderListRow,
  PurchaseOrderPreview,
} from "@/types/purchase-order";

const LIST_PATH = "/purchase/orders";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Purchase Orders list — a pure
 * read, so no paths are revalidated. */
export async function loadMorePurchaseOrdersAction(
  filters: PurchaseOrderListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<PurchaseOrderListRow>>> {
  return runAction(() => purchaseOrderService.listPurchaseOrdersPage(filters, { skip, take }), []);
}

export async function createPurchaseOrderAction(
  input: CreatePurchaseOrderInput
): Promise<ActionResult<PurchaseOrderDetail>> {
  return runAction(() => purchaseOrderService.createPurchaseOrder(input), [LIST_PATH]);
}

export async function updatePurchaseOrderAction(
  id: string,
  input: UpdatePurchaseOrderInput
): Promise<ActionResult<PurchaseOrderDetail>> {
  return runAction(() => purchaseOrderService.updatePurchaseOrder(id, input), [
    LIST_PATH,
    detailPath(id),
    `${detailPath(id)}/edit`,
  ]);
}

export async function confirmPurchaseOrderAction(id: string): Promise<ActionResult<PurchaseOrderDetail>> {
  return runAction(() => purchaseOrderService.confirmPurchaseOrder(id), [LIST_PATH, detailPath(id)]);
}

export async function closePurchaseOrderAction(id: string): Promise<ActionResult<PurchaseOrderDetail>> {
  return runAction(() => purchaseOrderService.closePurchaseOrder(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelPurchaseOrderAction(id: string): Promise<ActionResult<PurchaseOrderDetail>> {
  return runAction(() => purchaseOrderService.cancelPurchaseOrder(id), [LIST_PATH, detailPath(id)]);
}

// Read-only — no revalidation. Mirrors sales-order-actions.ts's
// previewSalesOrderAction.
export async function previewPurchaseOrderAction(
  input: PreviewPurchaseOrderInput
): Promise<ActionResult<PurchaseOrderPreview>> {
  return runAction(() => purchaseOrderService.previewPurchaseOrder(input), []);
}
