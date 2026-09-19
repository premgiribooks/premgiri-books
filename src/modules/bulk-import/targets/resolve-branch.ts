import { branchRepository } from "@/modules/branch/repositories/branch-repository";
import type { Branch } from "@/types/branch";
import type { BulkImportResolutionCache } from "@/types/bulk-import";

/**
 * Shared by warehouse-import-target.ts and employee-import-target.ts: both
 * targets' own create schema accepts an optional `branchId`, and a
 * spreadsheet can only carry the branch's own name, never its id. Cached
 * per-run in the shared BulkImportResolutionCache, mirroring
 * product-import-target.ts's own getLookups — one batched
 * `findManyActive` per target run, not per row.
 */
export async function resolveBranchByName(
  branchNameRaw: string | undefined,
  companyId: string,
  cache: BulkImportResolutionCache,
  errors: string[]
): Promise<string | undefined> {
  if (branchNameRaw === undefined) {
    return undefined;
  }

  const cacheKey = `branches:active:${companyId}`;
  let branches = cache.get(cacheKey) as Branch[] | undefined;
  if (!branches) {
    branches = await branchRepository.findManyActive(companyId);
    cache.set(cacheKey, branches);
  }

  const branchName = branchNameRaw.trim().toLowerCase();
  const match = branches.find((branch) => branch.branchName.trim().toLowerCase() === branchName);
  if (!match) {
    errors.push(`Branch "${branchNameRaw}" was not found.`);
    return undefined;
  }
  return match.id;
}
