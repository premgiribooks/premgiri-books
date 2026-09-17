"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/common/searchable-select";
import type { OpeningStockProductOption, OpeningStockWarehouseOption } from "@/types/opening-stock";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}

// Products and warehouses are a company's master data and can grow long
// enough that scrolling a fixed dropdown stops being usable — filterable via
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

interface OpeningStockFilterBarProps {
  products: OpeningStockProductOption[];
  warehouses: OpeningStockWarehouseOption[];
}

/** Search + product/warehouse filters for the Opening Stock list — mirrors
 * purchase-invoice-filter-bar.tsx's URL-state pattern exactly. */
export function OpeningStockFilterBar({ products, warehouses }: OpeningStockFilterBarProps) {
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
        placeholder="Search product name or code…"
        className="sm:max-w-xs"
        aria-label="Search opening stock entries"
      />

      <FilterCombobox
        value={searchParams.get("productId") ?? ALL_VALUE}
        onChange={(value) => updateParams({ productId: value })}
        allLabel="All Products"
        ariaLabel="Filter by product"
        options={products.map((product) => ({ value: product.id, label: product.name }))}
      />

      <FilterCombobox
        value={searchParams.get("warehouseId") ?? ALL_VALUE}
        onChange={(value) => updateParams({ warehouseId: value })}
        allLabel="All Warehouses"
        ariaLabel="Filter by warehouse"
        options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
      />
    </div>
  );
}
