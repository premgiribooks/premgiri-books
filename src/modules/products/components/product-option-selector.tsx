"use client";

import { SearchableSelect } from "@/components/common/searchable-select";

export interface ProductOptionItem {
  id: string;
  label: string;
  isActive: boolean;
}

interface ProductOptionSelectorProps {
  /**
   * The pickable options — active masters of the current company, plus (on
   * edit) the product's current reference even if since deactivated, kept so
   * the stored value stays visible and re-selectable (labeled "(Inactive)"),
   * mirroring branch-selector.tsx.
   */
  options: ProductOptionItem[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** false for the required Unit picker — hides the "None" item. */
  allowNone?: boolean;
  noneLabel?: string;
  /** Shown as the disabled row when the company has no options yet. */
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Forwarded to the trigger so FormControl can wire label/description/error
   * associations (id, aria-describedby, aria-invalid). */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function optionLabel(option: ProductOptionItem): string {
  // The only inactive entry that can appear here is an edited product's
  // current, since-deactivated reference — mark it so the state isn't
  // invisible (branch-selector.tsx convention).
  return option.isActive ? option.label : `${option.label} (Inactive)`;
}

/**
 * Shared, filterable picker for the Product Form's six master lookups
 * (Category, Brand, Unit, HSN/SAC, GST Rate, Default Warehouse), one generic
 * component instead of six near-identical copies — the same SearchableSelect
 * recipe as branch-selector.tsx.
 */
export function ProductOptionSelector({
  options,
  value,
  onChange,
  allowNone = true,
  noneLabel = "None",
  emptyLabel = "No options",
  placeholder,
  disabled,
  ...triggerProps
}: ProductOptionSelectorProps) {
  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      getOptionId={(option) => option.id}
      getOptionLabel={optionLabel}
      allowNone={allowNone}
      noneLabel={noneLabel}
      emptyLabel={emptyLabel}
      placeholder={placeholder}
      disabled={disabled}
      {...triggerProps}
    />
  );
}
