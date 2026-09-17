"use client";

import { SearchableSelect } from "@/components/common/searchable-select";
import type { Category } from "@/types/category";

const NO_PARENT_LABEL = "No parent (top-level category)";

interface CategorySelectorProps {
  /**
   * The pickable categories. The caller owns the exclusion rules — the edit
   * form passes a list that already excludes the category being edited and
   * its descendants (the no-cycle rule the server re-verifies).
   */
  categories: Category[];
  value: string | undefined;
  onChange: (categoryId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Forwarded to the trigger so FormControl can wire label/description/error
   * associations (id, aria-describedby, aria-invalid). */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function categoryLabel(category: Category): string {
  // The only inactive entry that can appear here is an edited category's
  // current, since-deactivated parent (kept so the stored value stays
  // visible and re-selectable); mark it so the state isn't invisible.
  return category.isActive ? category.name : `${category.name} (Inactive)`;
}

/**
 * Reusable, filterable parent-category picker, mirroring
 * ledger-group-selector.tsx. Flat, alphabetical; the tree page conveys
 * hierarchy, this stays legible as a plain lookup.
 */
export function CategorySelector({
  categories,
  value,
  onChange,
  placeholder = NO_PARENT_LABEL,
  disabled,
  ...triggerProps
}: CategorySelectorProps) {
  return (
    <SearchableSelect
      options={categories}
      value={value}
      onChange={onChange}
      getOptionId={(category) => category.id}
      getOptionLabel={categoryLabel}
      noneLabel={NO_PARENT_LABEL}
      placeholder={placeholder}
      disabled={disabled}
      {...triggerProps}
    />
  );
}
