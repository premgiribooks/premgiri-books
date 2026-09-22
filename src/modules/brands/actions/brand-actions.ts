"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { brandService } from "@/modules/brands/services/brand-service";
import type {
  CreateBrandInput,
  UpdateBrandInput,
} from "@/modules/brands/validation/brand-schema";
import type { ActionResult } from "@/types/api";
import type { Brand, BrandListFilters } from "@/types/brand";

const LIST_PATH = "/masters/brands";

/** Infinite-scroll "load more" for the Brands list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreBrandsAction(
  filters: BrandListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<Brand>>> {
  return runAction(() => brandService.listBrandsPage(filters, { skip, take }), []);
}

export async function createBrandAction(input: CreateBrandInput): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.createBrand(input), [LIST_PATH]);
}

export async function updateBrandAction(
  id: string,
  input: UpdateBrandInput
): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.updateBrand(id, input), [
    LIST_PATH,
    `/masters/brands/${id}/edit`,
  ]);
}

export async function activateBrandAction(id: string): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.activateBrand(id), [LIST_PATH]);
}

export async function deactivateBrandAction(id: string): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.deactivateBrand(id), [LIST_PATH]);
}
