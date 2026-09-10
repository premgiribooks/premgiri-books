"use server";

import { runAction } from "@/lib/run-action";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";
import type {
  CreateSalesOrderInput,
  PreviewSalesOrderInput,
  UpdateSalesOrderInput,
} from "@/modules/sales-orders/validation/sales-order-schema";
import type { ActionResult } from "@/types/api";
import type { ResolvedSalesOrderLinePrice, SalesOrderDetail, SalesOrderPreview } from "@/types/sales-order";

const LIST_PATH = "/sales/orders";
const QUOTATION_LIST_PATH = "/sales/quotations";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createSalesOrderAction(
  input: CreateSalesOrderInput
): Promise<ActionResult<SalesOrderDetail>> {
  return runAction(() => salesOrderService.createSalesOrder(input), [LIST_PATH]);
}

export async function updateSalesOrderAction(
  id: string,
  input: UpdateSalesOrderInput
): Promise<ActionResult<SalesOrderDetail>> {
  return runAction(() => salesOrderService.updateSalesOrder(id, input), [
    LIST_PATH,
    detailPath(id),
    `${detailPath(id)}/edit`,
  ]);
}

export async function confirmSalesOrderAction(id: string): Promise<ActionResult<SalesOrderDetail>> {
  return runAction(() => salesOrderService.confirmSalesOrder(id), [LIST_PATH, detailPath(id)]);
}

export async function closeSalesOrderAction(id: string): Promise<ActionResult<SalesOrderDetail>> {
  return runAction(() => salesOrderService.closeSalesOrder(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelSalesOrderAction(id: string): Promise<ActionResult<SalesOrderDetail>> {
  return runAction(() => salesOrderService.cancelSalesOrder(id), [LIST_PATH, detailPath(id)]);
}

// The "Convert to Sales Order" entry point Quotation's detail page calls
// (quotation-status-actions.tsx). Also revalidates the quotation list/detail
// — converting doesn't change the quotation's own row, but a future reader
// browsing straight from a stale cache should still see the fresh state.
export async function createSalesOrderFromQuotationAction(
  quotationId: string
): Promise<ActionResult<SalesOrderDetail>> {
  return runAction(() => salesOrderService.createFromQuotation(quotationId), [
    LIST_PATH,
    QUOTATION_LIST_PATH,
    `${QUOTATION_LIST_PATH}/${quotationId}`,
  ]);
}

// Read-only — no revalidation. Mirrors quotation-actions.ts's
// resolveLinePriceAction.
export async function resolveSalesOrderLinePriceAction(input: {
  productId: string;
  quantity: number;
  customerId?: string;
  asOfDate?: string;
}): Promise<ActionResult<ResolvedSalesOrderLinePrice>> {
  return runAction(() => salesOrderService.resolveLinePrice(input), []);
}

// Read-only — no revalidation. Mirrors quotation-actions.ts's
// previewQuotationAction.
export async function previewSalesOrderAction(
  input: PreviewSalesOrderInput
): Promise<ActionResult<SalesOrderPreview>> {
  return runAction(() => salesOrderService.previewSalesOrder(input), []);
}
