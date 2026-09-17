"use client";

import { SearchableSelect } from "@/components/common/searchable-select";
import { AccountNatureBadge } from "@/modules/ledger-groups/components/account-nature-badge";
import type { LedgerGroup } from "@/types/ledger-group";

const NO_PARENT_LABEL = "No parent (top-level group)";

interface LedgerGroupSelectorProps {
  groups: LedgerGroup[];
  value: string | undefined;
  onChange: (groupId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** When true, shows a "No parent (top-level group)" option. */
  allowNone?: boolean;
}

/**
 * Reusable, filterable parent-group picker — also reused by
 * 14-ledger-master.md's Ledger Form to pick a Ledger's group. Flat,
 * alphabetical; each row shows the group's Nature badge (open dropdown
 * only — the closed input can only ever hold plain text, so the label
 * folds Nature in as "(Nature)" there) so the same list stays legible
 * regardless of hierarchy.
 */
export function LedgerGroupSelector({
  groups,
  value,
  onChange,
  placeholder = NO_PARENT_LABEL,
  disabled,
  allowNone = true,
}: LedgerGroupSelectorProps) {
  return (
    <SearchableSelect
      options={groups}
      value={value}
      onChange={onChange}
      getOptionId={(group) => group.id}
      getOptionLabel={(group) => `${group.name} (${group.natureType})`}
      renderOption={(group) => (
        <span className="flex flex-1 items-center justify-between gap-2">
          <span>{group.name}</span>
          <AccountNatureBadge nature={group.natureType} />
        </span>
      )}
      allowNone={allowNone}
      noneLabel={NO_PARENT_LABEL}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
