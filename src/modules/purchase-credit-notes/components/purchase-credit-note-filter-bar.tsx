"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { PURCHASE_CREDIT_NOTE_STATUS_LABELS } from "@/modules/purchase-credit-notes/components/purchase-credit-note-status-badge";
import { PURCHASE_CREDIT_NOTE_STATUS_VALUES } from "@/modules/purchase-credit-notes/validation/purchase-credit-note-schema";
import type { PurchaseCreditNoteSupplierOption } from "@/types/purchase-credit-note";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}

// The Suppliers list (a company's master data) can grow long enough that
// scrolling a fixed dropdown stops being usable — filterable via
// SearchableSelect instead. "All ___" is modeled as SearchableSelect's own
// "None" (cleared filter), not a real id.
function FilterCombobox({ value, onChange, allLabel, options, ariaLabel }: FilterSelectProps) {
  return (
    <SearchableSelect
      options={options}
      value={value === ALL_VALUE ? undefined : value}
      onChange={(next) => onChange(next ?? ALL_VALUE)}
      getOptionId={(option) => option.value}
      getOptionLabel={(option) => option.label}
      noneLabel={allLabel}
      placeholder={allLabel}
      aria-label={ariaLabel}
      className="w-full sm:w-48"
    />
  );
}

interface PurchaseCreditNoteFilterBarProps {
  suppliers: PurchaseCreditNoteSupplierOption[];
}

/** Search + status/supplier filter for the purchase credit note list —
 * mirrors credit-note-filter-bar.tsx's URL-state pattern exactly. */
export function PurchaseCreditNoteFilterBar({ suppliers }: PurchaseCreditNoteFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");

  const updateParams = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === ALL_VALUE) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams]
  );

  React.useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) {
      return;
    }
    const handle = setTimeout(() => updateParams({ search: search || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, searchParams, updateParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search note or invoice number, or supplier…"
        className="sm:max-w-xs"
        aria-label="Search purchase credit notes"
      />

      <Select
        value={searchParams.get("status") ?? ALL_VALUE}
        onValueChange={(next) => updateParams({ status: next ?? ALL_VALUE })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
          <SelectValue>
            {(current: string | null) =>
              PURCHASE_CREDIT_NOTE_STATUS_VALUES.includes(current as (typeof PURCHASE_CREDIT_NOTE_STATUS_VALUES)[number])
                ? PURCHASE_CREDIT_NOTE_STATUS_LABELS[current as (typeof PURCHASE_CREDIT_NOTE_STATUS_VALUES)[number]]
                : "All Statuses"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
          {PURCHASE_CREDIT_NOTE_STATUS_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {PURCHASE_CREDIT_NOTE_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <FilterCombobox
        value={searchParams.get("supplierId") ?? ALL_VALUE}
        onChange={(value) => updateParams({ supplierId: value })}
        allLabel="All Suppliers"
        ariaLabel="Filter by supplier"
        options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
      />
    </div>
  );
}
