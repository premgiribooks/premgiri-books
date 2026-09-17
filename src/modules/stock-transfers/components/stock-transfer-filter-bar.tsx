"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { STOCK_TRANSFER_STATUS_LABELS } from "@/modules/stock-transfers/components/stock-transfer-status-badge";
import { STOCK_TRANSFER_STATUS_VALUES } from "@/modules/stock-transfers/validation/stock-transfer-schema";
import type { StockTransferWarehouseOption } from "@/types/stock-transfer";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface WarehouseFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  ariaLabel: string;
  warehouses: StockTransferWarehouseOption[];
}

// Warehouses are a company's master data and can grow long enough that
// scrolling a fixed dropdown stops being usable — filterable via
// SearchableSelect instead. "All ___" is modeled as SearchableSelect's own
// "None" (cleared filter), not a real id.
function WarehouseFilterSelect({ value, onChange, allLabel, ariaLabel, warehouses }: WarehouseFilterSelectProps) {
  return (
    <SearchableSelect
      options={warehouses}
      value={value === ALL_VALUE ? undefined : value}
      onChange={(next) => onChange(next ?? ALL_VALUE)}
      getOptionId={(warehouse) => warehouse.id}
      getOptionLabel={(warehouse) => warehouse.name}
      noneLabel={allLabel}
      placeholder={allLabel}
      aria-label={ariaLabel}
      className="w-full sm:w-48"
    />
  );
}

interface StockTransferFilterBarProps {
  warehouses: StockTransferWarehouseOption[];
}

/** Search + status/source-warehouse/destination-warehouse/date-range filter
 * for the stock transfer list — 48-stock-transfer.md's UI: "search +
 * status/warehouse/date filters". Mirrors stock-adjustment-filter-bar.tsx's
 * URL-state pattern, extended with opening-stock-filter-bar.tsx's warehouse
 * FilterSelect and a plain date-input pair for the range. */
export function StockTransferFilterBar({ warehouses }: StockTransferFilterBarProps) {
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
        placeholder="Search transfer number or narration…"
        className="sm:max-w-xs"
        aria-label="Search stock transfers"
      />

      <Select
        value={searchParams.get("status") ?? ALL_VALUE}
        onValueChange={(next) => updateParams({ status: next ?? ALL_VALUE })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
          <SelectValue>
            {(current: string | null) =>
              STOCK_TRANSFER_STATUS_VALUES.includes(current as (typeof STOCK_TRANSFER_STATUS_VALUES)[number])
                ? STOCK_TRANSFER_STATUS_LABELS[current as (typeof STOCK_TRANSFER_STATUS_VALUES)[number]]
                : "All Statuses"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
          {STOCK_TRANSFER_STATUS_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {STOCK_TRANSFER_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <WarehouseFilterSelect
        value={searchParams.get("sourceWarehouseId") ?? ALL_VALUE}
        onChange={(value) => updateParams({ sourceWarehouseId: value })}
        allLabel="All Source Warehouses"
        ariaLabel="Filter by source warehouse"
        warehouses={warehouses}
      />

      <WarehouseFilterSelect
        value={searchParams.get("destinationWarehouseId") ?? ALL_VALUE}
        onChange={(value) => updateParams({ destinationWarehouseId: value })}
        allLabel="All Destination Warehouses"
        ariaLabel="Filter by destination warehouse"
        warehouses={warehouses}
      />

      <Input
        type="date"
        value={searchParams.get("fromDate") ?? ""}
        onChange={(event) => updateParams({ fromDate: event.target.value || undefined })}
        className="sm:w-40"
        aria-label="From date"
      />

      <Input
        type="date"
        value={searchParams.get("toDate") ?? ""}
        onChange={(event) => updateParams({ toDate: event.target.value || undefined })}
        className="sm:w-40"
        aria-label="To date"
      />
    </div>
  );
}
