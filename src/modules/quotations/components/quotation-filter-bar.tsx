"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { QUOTATION_STATUS_LABELS } from "@/modules/quotations/components/quotation-status-badge";
import { QUOTATION_STATUS_VALUES } from "@/modules/quotations/validation/quotation-schema";
import type { QuotationCustomerOption } from "@/types/quotation";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}

function FilterSelect({ value, onChange, allLabel, options, ariaLabel }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? ALL_VALUE)}>
      <SelectTrigger className="w-full sm:w-44" aria-label={ariaLabel}>
        <SelectValue>
          {(current: string | null) =>
            options.find((option) => option.value === current)?.label ?? allLabel
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// The Customers list (a company's master data) can grow long enough that
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
      className="w-full sm:w-44"
    />
  );
}

interface QuotationFilterBarProps {
  customers: QuotationCustomerOption[];
}

/**
 * Search + status/customer filters for the quotation list
 * (35-quotations.md's UI). Filter state lives in the URL so the server page
 * re-queries through quotationService.listQuotations(filters) — the
 * CustomerFilterBar URL-state pattern.
 */
export function QuotationFilterBar({ customers }: QuotationFilterBarProps) {
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
    const handle = setTimeout(() => {
      updateParams({ search: search || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, searchParams, updateParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search quotation number or customer…"
        className="sm:max-w-xs"
        aria-label="Search quotations"
      />

      <FilterSelect
        value={searchParams.get("status") ?? ALL_VALUE}
        onChange={(value) => updateParams({ status: value })}
        allLabel="All Statuses"
        ariaLabel="Filter by status"
        options={QUOTATION_STATUS_VALUES.map((value) => ({
          value,
          label: QUOTATION_STATUS_LABELS[value],
        }))}
      />

      <FilterCombobox
        value={searchParams.get("customerId") ?? ALL_VALUE}
        onChange={(value) => updateParams({ customerId: value })}
        allLabel="All Customers"
        ariaLabel="Filter by customer"
        options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
      />
    </div>
  );
}
