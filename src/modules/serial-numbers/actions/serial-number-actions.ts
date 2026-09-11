"use server";

import { runAction } from "@/lib/run-action";
import { serialNumberService } from "@/modules/serial-numbers/services/serial-number-service";
import type { CreateSerialNumberInput } from "@/modules/serial-numbers/validation/serial-number-schema";
import type {
  ActivateSerialNumberResult,
  DeactivateSerialNumberResult,
  SerialNumberOption,
  SerialNumberWithStatus,
} from "@/types/serial-number";
import type { ActionResult } from "@/types/api";

// The Serial Numbers tab (56-product-detail-page.md's seam, per 51-serial-
// number-tracking.md) consumes these, alongside the product's edit page
// (which also reads isSerialTracked/movement state) — mirrors
// product-batch-actions.ts's productPaths.
function productPaths(productId: string): string[] {
  return [`/masters/products/${productId}/edit`, `/masters/products/${productId}/serial-numbers`];
}

export async function createSerialNumberAction(
  input: CreateSerialNumberInput
): Promise<ActionResult<SerialNumberWithStatus>> {
  return runAction(() => serialNumberService.createSerialNumber(input), productPaths(input.productId));
}

export async function activateSerialNumberAction(
  id: string,
  productId: string
): Promise<ActionResult<ActivateSerialNumberResult>> {
  return runAction(() => serialNumberService.activateSerialNumber(id), productPaths(productId));
}

export async function deactivateSerialNumberAction(
  id: string,
  productId: string
): Promise<ActionResult<DeactivateSerialNumberResult>> {
  return runAction(() => serialNumberService.deactivateSerialNumber(id), productPaths(productId));
}

/** Pure read for `<SerialSelector>` — no mutation, no revalidation. */
export async function listSerialOptionsAction(
  productId: string,
  warehouseId?: string
): Promise<ActionResult<SerialNumberOption[]>> {
  return runAction(() => serialNumberService.listSerialOptions(productId, warehouseId), []);
}
