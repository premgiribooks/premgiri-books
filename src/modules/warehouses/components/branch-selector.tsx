"use client";

import { SearchableSelect } from "@/components/common/searchable-select";
import type { WarehouseBranchOption } from "@/types/warehouse";

const NO_BRANCH_LABEL = "No branch";

interface BranchSelectorProps {
  /**
   * The pickable branches — the company's active branches, plus (on edit) the
   * warehouse's current branch even if since deactivated. Empty for a
   * zero-branch company (a fully-supported state per 12-branch-management.md);
   * that renders as "No branches" below, not an error (24-warehouse-management.md's UI).
   */
  branches: WarehouseBranchOption[];
  value: string | undefined;
  onChange: (branchId: string | undefined) => void;
  disabled?: boolean;
  /** Forwarded to the trigger so FormControl can wire label/description/error
   * associations (id, aria-describedby, aria-invalid). */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function branchLabel(branch: WarehouseBranchOption): string {
  // The only inactive entry that can appear here is an edited warehouse's
  // current, since-deactivated branch (kept so the stored value stays
  // visible and re-selectable); mark it so the state isn't invisible —
  // mirroring category-selector.tsx.
  return branch.isActive ? branch.branchName : `${branch.branchName} (Inactive)`;
}

/**
 * Optional, filterable branch picker for the warehouse form, mirroring
 * category-selector.tsx (via ledger-group-selector.tsx).
 */
export function BranchSelector({
  branches,
  value,
  onChange,
  disabled,
  ...triggerProps
}: BranchSelectorProps) {
  return (
    <SearchableSelect
      options={branches}
      value={value}
      onChange={onChange}
      getOptionId={(branch) => branch.id}
      getOptionLabel={branchLabel}
      noneLabel={NO_BRANCH_LABEL}
      emptyLabel="No branches"
      disabled={disabled}
      {...triggerProps}
    />
  );
}
