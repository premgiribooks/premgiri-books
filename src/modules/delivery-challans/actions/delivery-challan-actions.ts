"use server";

import { runAction } from "@/lib/run-action";
import { deliveryChallanService } from "@/modules/delivery-challans/services/delivery-challan-service";
import type {
  CreateDeliveryChallanInput,
  UpdateDeliveryChallanInput,
} from "@/modules/delivery-challans/validation/delivery-challan-schema";
import type { ActionResult } from "@/types/api";
import type { DeliveryChallanDetail, SalesOrderPrefill } from "@/types/delivery-challan";

const LIST_PATH = "/sales/challans";
const SALES_ORDER_LIST_PATH = "/sales/orders";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

export async function createDeliveryChallanAction(
  input: CreateDeliveryChallanInput
): Promise<ActionResult<DeliveryChallanDetail>> {
  return runAction(() => deliveryChallanService.createDeliveryChallan(input), [LIST_PATH]);
}

export async function updateDeliveryChallanAction(
  id: string,
  input: UpdateDeliveryChallanInput
): Promise<ActionResult<DeliveryChallanDetail>> {
  return runAction(() => deliveryChallanService.updateDeliveryChallan(id, input), [
    LIST_PATH,
    detailPath(id),
    `${detailPath(id)}/edit`,
  ]);
}

export async function dispatchDeliveryChallanAction(id: string): Promise<ActionResult<DeliveryChallanDetail>> {
  return runAction(() => deliveryChallanService.dispatchDeliveryChallan(id), [
    LIST_PATH,
    detailPath(id),
    SALES_ORDER_LIST_PATH,
  ]);
}

export async function cancelDeliveryChallanAction(id: string): Promise<ActionResult<DeliveryChallanDetail>> {
  return runAction(() => deliveryChallanService.cancelDeliveryChallan(id), [LIST_PATH, detailPath(id)]);
}

// Read-only — no revalidation. Backs "New Delivery Challan"'s `?salesOrderId=`
// pre-fill (see delivery-challan-service.ts's file comment for why this
// replaces a dedicated createFromSalesOrder persist action).
export async function getSalesOrderPrefillAction(
  salesOrderId: string
): Promise<ActionResult<SalesOrderPrefill | null>> {
  return runAction(() => deliveryChallanService.getSalesOrderPrefill(salesOrderId), []);
}
