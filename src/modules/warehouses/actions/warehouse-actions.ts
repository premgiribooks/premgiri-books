"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from "@/modules/warehouses/validation/warehouse-schema";
import type { ActionResult } from "@/types/api";
import type { Warehouse, WarehouseListFilters, WarehouseWithBranch } from "@/types/warehouse";

const LIST_PATH = "/masters/warehouses";

/** Infinite-scroll "load more" for the Warehouses list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreWarehousesAction(
  filters: WarehouseListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<WarehouseWithBranch>>> {
  return runAction(() => warehouseService.listWarehousesPage(filters, { skip, take }), []);
}

export async function createWarehouseAction(
  input: CreateWarehouseInput
): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.createWarehouse(input), [LIST_PATH]);
}

export async function updateWarehouseAction(
  id: string,
  input: UpdateWarehouseInput
): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.updateWarehouse(id, input), [
    LIST_PATH,
    `/masters/warehouses/${id}/edit`,
  ]);
}

export async function activateWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.activateWarehouse(id), [LIST_PATH]);
}

export async function deactivateWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.deactivateWarehouse(id), [LIST_PATH]);
}

export async function setDefaultWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.setDefaultWarehouse(id), [LIST_PATH]);
}

export async function unsetDefaultWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.unsetDefaultWarehouse(id), [LIST_PATH]);
}
