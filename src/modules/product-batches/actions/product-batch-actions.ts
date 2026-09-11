"use server";

import { runAction } from "@/lib/run-action";
import { productBatchService } from "@/modules/product-batches/services/product-batch-service";
import type {
  CreateProductBatchInput,
  UpdateProductBatchInput,
} from "@/modules/product-batches/validation/product-batch-schema";
import type {
  ActivateProductBatchResult,
  DeactivateProductBatchResult,
  ProductBatchOption,
  ProductBatchWithStock,
  UpdateProductBatchResult,
} from "@/types/product-batch";
import type { ActionResult } from "@/types/api";

// No page route consumes these yet (the Batches tab is on hold pending a
// Product detail page — context/progress-tracker.md) — revalidatePaths is
// intentionally the product's own edit page only, the one screen that
// already reads a product's isBatchTracked/movement state.
function productPaths(productId: string): string[] {
  return [`/masters/products/${productId}/edit`];
}

export async function createProductBatchAction(
  input: CreateProductBatchInput
): Promise<ActionResult<ProductBatchWithStock>> {
  return runAction(() => productBatchService.createBatch(input), productPaths(input.productId));
}

export async function updateProductBatchAction(
  id: string,
  productId: string,
  input: UpdateProductBatchInput
): Promise<ActionResult<UpdateProductBatchResult>> {
  return runAction(() => productBatchService.updateBatch(id, input), productPaths(productId));
}

export async function activateProductBatchAction(
  id: string,
  productId: string
): Promise<ActionResult<ActivateProductBatchResult>> {
  return runAction(() => productBatchService.activateBatch(id), productPaths(productId));
}

export async function deactivateProductBatchAction(
  id: string,
  productId: string
): Promise<ActionResult<DeactivateProductBatchResult>> {
  return runAction(() => productBatchService.deactivateBatch(id), productPaths(productId));
}

/** Pure read for `<BatchSelector>` — no mutation, no revalidation. */
export async function listBatchOptionsAction(
  productId: string,
  warehouseId?: string
): Promise<ActionResult<ProductBatchOption[]>> {
  return runAction(() => productBatchService.listBatchOptions(productId, warehouseId), []);
}
