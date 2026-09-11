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

// The Batches tab (56-product-detail-page.md) now consumes these, alongside
// the product's edit page (which also reads isBatchTracked/movement state).
function productPaths(productId: string): string[] {
  return [`/masters/products/${productId}/edit`, `/masters/products/${productId}/batches`];
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
