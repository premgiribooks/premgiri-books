import { getBatchStock as getBatchStockRows } from "@/engines/inventory/inventory-queries";
import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { productBatchRepository } from "@/modules/product-batches/repositories/product-batch-repository";
import {
  createProductBatchSchema,
  updateProductBatchSchema,
  type CreateProductBatchInput,
  type UpdateProductBatchInput,
} from "@/modules/product-batches/validation/product-batch-schema";
import type {
  ActivateProductBatchResult,
  DeactivateProductBatchResult,
  ProductBatchListFilters,
  ProductBatchOption,
  ProductBatchWithStock,
  UpdateProductBatchResult,
} from "@/types/product-batch";

const NOT_FOUND_MESSAGE = "Batch not found.";

// Batches are product-master data (mirrors how HSN/GST Rate management sits
// under `masters` rather than `inventory` — 50-batch-tracking.md's Security
// section). Activate/deactivate use `edit`, not this codebase's usual
// LIFECYCLE_ACTION="delete" convention — a deliberate deviation the spec's
// own permission list (view/create/edit only) calls for; recorded in
// context/progress-tracker.md.
const MODULE = "masters";

function translateBatchNumberConflict(error: unknown): never {
  if (isUniqueConstraintError(error, "batchNumber")) {
    throw new AppError("A batch with this number already exists for this product.");
  }
  throw error;
}

export const productBatchService = {
  async listBatches(
    productId: string,
    filters: ProductBatchListFilters = {}
  ): Promise<ProductBatchWithStock[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");
    return productBatchRepository.findManyWithStock(user.companyId, productId, filters);
  },

  // A batch belonging to a different company resolves identically to "not
  // found" — never distinguish "exists but isn't yours" (product-service.ts's
  // getProduct convention).
  async getBatch(id: string): Promise<ProductBatchWithStock | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const batch = await productBatchRepository.findByIdWithStock(id);
    if (!batch || batch.companyId !== user.companyId) {
      return null;
    }
    return batch;
  },

  async createBatch(input: CreateProductBatchInput): Promise<ProductBatchWithStock> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "create");

    const data = createProductBatchSchema.parse(input);
    try {
      return await productBatchRepository.create(user.companyId, data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translateBatchNumberConflict(error);
    }
  },

  async updateBatch(id: string, input: UpdateProductBatchInput): Promise<UpdateProductBatchResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "edit");

    const data = updateProductBatchSchema.parse(input);
    try {
      return await productBatchRepository.update(id, user.companyId, data);
    } catch (error) {
      translateBatchNumberConflict(error);
    }
  },

  async activateBatch(id: string): Promise<ActivateProductBatchResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "edit");

    const result = await productBatchRepository.setActive(id, user.companyId, true);
    if (result.status === "not_found") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return result;
  },

  async deactivateBatch(id: string): Promise<DeactivateProductBatchResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "edit");

    const result = await productBatchRepository.setActive(id, user.companyId, false);
    if (result.status === "not_found") {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return result;
  },

  /** Scalar current stock for one batch, summed across warehouses unless `warehouseId` narrows it — the productBatchService-level primitive over the engine's batch-scoped query. */
  async getBatchStock(productId: string, batchId: string, warehouseId?: string): Promise<number> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

    const rows = await getBatchStockRows(user.companyId, { productId, batchId, warehouseId });
    return rows.reduce((total, row) => total + row.quantity, 0);
  },

  /** The `<BatchSelector>` component's data source — active batches only. */
  async listBatchOptions(productId: string, warehouseId?: string): Promise<ProductBatchOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");
    return productBatchRepository.findOptionsForSelector(user.companyId, productId, warehouseId);
  },
};
