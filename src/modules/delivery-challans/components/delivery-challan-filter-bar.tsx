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
import { DELIVERY_CHALLAN_STATUS_LABELS } from "@/modules/delivery-challans/components/delivery-challan-status-badge";
import { DELIVERY_CHALLAN_STATUS_VALUES } from "@/modules/delivery-challans/validation/delivery-challan-schema";
import type { DeliveryChallanCustomerOption } from "@/types/delivery-challan";

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

interface DeliveryChallanFilterBarProps {
  customers: DeliveryChallanCustomerOption[];
}

/**
 * Search + status/customer filters for the delivery challan list — mirrors
 * sales-order-filter-bar.tsx's URL-state pattern exactly.
 */
export function DeliveryChallanFilterBar({ customers }: DeliveryChallanFilterBarProps) {
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
        placeholder="Search challan number or customer…"
        className="sm:max-w-xs"
        aria-label="Search delivery challans"
      />

      <FilterSelect
        value={searchParams.get("status") ?? ALL_VALUE}
        onChange={(value) => updateParams({ status: value })}
        allLabel="All Statuses"
        ariaLabel="Filter by status"
        options={DELIVERY_CHALLAN_STATUS_VALUES.map((value) => ({
          value,
          label: DELIVERY_CHALLAN_STATUS_LABELS[value],
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
