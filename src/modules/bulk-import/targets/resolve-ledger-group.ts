import type { LedgerGroup } from "@prisma/client";

import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import type { BulkImportResolutionCache } from "@/types/bulk-import";

/**
 * Shared by customer-import-target.ts and supplier-import-target.ts: both
 * targets' own create schema requires a `ledgerGroupId` within a specific
 * subtree (Sundry Debtors / Sundry Creditors) — a spreadsheet can only carry
 * the group's own name, never its id. When the column is left blank and the
 * subtree has exactly one member (this codebase's own default-setup shape,
 * mirroring the manual Create form's `autoSelectSingleOption` convention),
 * it is auto-selected rather than forcing every row to repeat the one
 * group's name.
 */
export async function resolveLedgerGroupByName(
  ledgerGroupNameRaw: string | undefined,
  companyId: string,
  cache: BulkImportResolutionCache,
  subtreeLabel: string,
  getSubtreeIds: (groups: LedgerGroup[]) => Set<string>,
  errors: string[]
): Promise<string | undefined> {
  const cacheKey = `ledgerGroups:${companyId}`;
  let allGroups = cache.get(cacheKey) as LedgerGroup[] | undefined;
  if (!allGroups) {
    allGroups = await ledgerGroupRepository.findMany(companyId, {});
    cache.set(cacheKey, allGroups);
  }

  const subtreeIds = getSubtreeIds(allGroups);
  const subtreeGroups = allGroups.filter((group) => subtreeIds.has(group.id) && group.isActive);

  const ledgerGroupName = ledgerGroupNameRaw?.trim();
  if (!ledgerGroupName) {
    if (subtreeGroups.length === 1) {
      return subtreeGroups[0].id;
    }
    errors.push(
      subtreeGroups.length === 0
        ? `No active ${subtreeLabel} ledger group exists for this company.`
        : `Ledger Group is required — more than one ${subtreeLabel} group exists (specify which one).`
    );
    return undefined;
  }

  const match = subtreeGroups.find((group) => group.name.toLowerCase() === ledgerGroupName.toLowerCase());
  if (!match) {
    errors.push(`Ledger Group "${ledgerGroupName}" was not found under ${subtreeLabel}.`);
    return undefined;
  }
  return match.id;
}
