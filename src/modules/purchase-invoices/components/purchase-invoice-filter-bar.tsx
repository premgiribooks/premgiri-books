"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { PURCHASE_INVOICE_STATUS_LABELS } from "@/modules/purchase-invoices/components/purchase-invoice-status-badge";
import { PURCHASE_INVOICE_STATUS_VALUES } from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import type { PurchaseInvoiceSupplierOption } from "@/types/purchase-invoice";

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
        <SelectValue>{(current: string | null) => options.find((option) => option.value === current)?.label ?? allLabel}</SelectValue>
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

// A company's master/reference data (here, Suppliers) can grow long enough
// that scrolling a fixed dropdown stops being usable — filterable via
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

interface PurchaseInvoiceFilterBarProps {
  suppliers: PurchaseInvoiceSupplierOption[];
}

/** Search + status/supplier filters for the purchase invoice list — mirrors
 * sales-invoice-filter-bar.tsx's URL-state pattern exactly. */
export function PurchaseInvoiceFilterBar({ suppliers }: PurchaseInvoiceFilterBarProps) {
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
        placeholder="Search invoice number or supplier…"
        className="sm:max-w-xs"
        aria-label="Search purchase invoices"
      />

      <FilterSelect
        value={searchParams.get("status") ?? ALL_VALUE}
        onChange={(value) => updateParams({ status: value })}
        allLabel="All Statuses"
        ariaLabel="Filter by status"
        options={PURCHASE_INVOICE_STATUS_VALUES.map((value) => ({ value, label: PURCHASE_INVOICE_STATUS_LABELS[value] }))}
      />

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
