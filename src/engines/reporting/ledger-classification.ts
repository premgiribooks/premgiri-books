import type { LedgerGroup } from "@prisma/client";

import type { LedgerGroupIndex } from "@/engines/reporting/types";

/**
 * Builds a group-id -> { group, children } index from a flat, company-scoped
 * list of LedgerGroups. Pure, no I/O — the shared lookup every 64-67 grouping/
 * rollup function builds once per report call and reuses (64-trial-balance.md).
 */
export function buildLedgerGroupIndex(groups: LedgerGroup[]): LedgerGroupIndex {
  const index: LedgerGroupIndex = new Map();

  for (const group of groups) {
    index.set(group.id, { group, children: [] });
  }

  for (const group of groups) {
    if (group.parentGroupId) {
      const parentEntry = index.get(group.parentGroupId);
      if (parentEntry) {
        parentEntry.children.push(group.id);
      }
    }
  }

  return index;
}

/**
 * Walks parentGroupId up to the top-level (root) ancestor of the given group.
 * Used here to build the Trial Balance's outermost presentation sections, and
 * reused unmodified by 67-cash-flow.md for its own root-group-name
 * classification. Returns null only if groupId isn't in the index.
 */
export function getRootGroup(groupId: string, index: LedgerGroupIndex): LedgerGroup | null {
  const entry = index.get(groupId);
  if (!entry) {
    return null;
  }

  let current = entry.group;
  while (current.parentGroupId) {
    const parentEntry = index.get(current.parentGroupId);
    if (!parentEntry) {
      break;
    }
    current = parentEntry.group;
  }

  return current;
}
