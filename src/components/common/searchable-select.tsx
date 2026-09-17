"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";

export interface SearchableSelectProps<T> {
  /** The pickable options — typically a company's active master/reference
   * data (Category, Brand, Unit, Warehouse, Ledger, Customer, Supplier,
   * ...), plus (on edit) a since-deactivated current reference the caller
   * chooses to keep visible. */
  options: T[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  getOptionId: (option: T) => string;
  /** The full display label, including any caller-applied suffix such as
   * "(Inactive)" — used to build the filterable search text, and as the
   * closed-state input's plain-text value (the native <input> this renders
   * onto can only ever hold text, even when `renderOption` shows richer
   * JSX in the open dropdown). */
  getOptionLabel: (option: T) => string;
  /** Optional richer per-row rendering (e.g. a name plus a badge) for the
   * open dropdown's list items. Falls back to `getOptionLabel(option)` when
   * omitted. Search-matching and the closed input's text always go through
   * `getOptionLabel`, never this. */
  renderOption?: (option: T) => React.ReactNode;
  /** false for a required picker (e.g. Unit) — hides the Clear affordance. */
  allowNone?: boolean;
  noneLabel?: string;
  /** Shown in the popup when the company has no options at all yet
   * (as opposed to "no matches" for the typed query). */
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** When there's exactly one option and nothing is selected yet, pick it
   * automatically instead of making the user open the dropdown for a
   * foregone conclusion (e.g. a company with only one Warehouse). Only
   * ever fires while `value` is `undefined` — it never overrides an
   * existing selection (including one the user has explicitly cleared;
   * for a required field the Clear button isn't shown anyway, and for an
   * optional field re-picking the sole option after an explicit clear is
   * the same "there's only one real choice" reasoning as the initial
   * auto-select). Default true; pass false to opt out for a picker where
   * an untouched, empty value is itself meaningful. */
  autoSelectSingleOption?: boolean;
  /** Applied to the input group (the visible bordered box) — e.g. a fixed
   * width to match a filter bar's other controls. */
  className?: string;
  /** Wired onto the input so FormControl can attach label/description/error
   * associations (id, aria-describedby, aria-invalid). */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** For a field with no visible <label> (e.g. a filter-bar dropdown whose
   * only visible cue is its placeholder text). */
  "aria-label"?: string;
}

/**
 * Generic filterable/searchable replacement for a plain <Select> when the
 * option list is a company's master/reference data and can realistically
 * grow long enough that scrolling a fixed dropdown stops being usable
 * (Category, Brand, Unit, Warehouse, HSN/SAC, GST Rate, Ledger, Role,
 * Branch, Batch, Serial Number, Customer, Supplier, Product, Financial
 * Year, ...). Built on Base UI's Combobox primitive
 * (@base-ui/react/combobox) — this project's existing Select
 * (src/components/ui/select.tsx) is also Base UI-based, so this introduces
 * no new dependency. A small, fixed-option dropdown (status, type enum,
 * date-range preset) should stay a plain Select — typeahead adds friction
 * with no benefit when there are only a handful of choices. Auto-selects
 * a lone option by default (`autoSelectSingleOption`) — see that prop.
 */
export function SearchableSelect<T>({
  options,
  value,
  onChange,
  getOptionId,
  getOptionLabel,
  renderOption,
  allowNone = true,
  noneLabel = "None",
  emptyLabel = "No options",
  placeholder,
  disabled,
  autoSelectSingleOption = true,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: SearchableSelectProps<T>) {
  const selected = React.useMemo<T | null>(
    () => (value === undefined ? null : (options.find((option) => getOptionId(option) === value) ?? null)),
    [options, value, getOptionId]
  );
  const displayPlaceholder = placeholder ?? (allowNone ? noneLabel : "Select…");

  React.useEffect(() => {
    if (autoSelectSingleOption && !disabled && value === undefined && options.length === 1) {
      onChange(getOptionId(options[0]));
    }
  }, [autoSelectSingleOption, disabled, value, options, getOptionId, onChange]);

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(next) => onChange(next ? getOptionId(next) : undefined)}
      itemToStringLabel={getOptionLabel}
      isItemEqualToValue={(a: T, b: T) => getOptionId(a) === getOptionId(b)}
      disabled={disabled}
    >
      <ComboboxInputGroup className={className}>
        <ComboboxInput
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          placeholder={displayPlaceholder}
        />
        {allowNone ? <ComboboxClear aria-label="Clear selection" /> : null}
        <ComboboxTrigger aria-label="Open options" />
      </ComboboxInputGroup>
      <ComboboxContent>
        <ComboboxEmpty>{options.length === 0 ? emptyLabel : "No matches found."}</ComboboxEmpty>
        <ComboboxList>
          {(option: T) => (
            <ComboboxItem key={getOptionId(option)} value={option}>
              {renderOption ? renderOption(option) : getOptionLabel(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
