"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/common/searchable-select";

interface InventoryReportFilterOption {
  id: string;
  name: string;
}

interface InventoryReportFilterBarProps {
  /** Present on Current Stock (optional narrowing) and Stock Ledger (required picker — see `productRequired`). */
  products?: InventoryReportFilterOption[];
  /** Stock Ledger only — no "All Products" option, since `getStockLedger`'s own signature is per-product. */
  productRequired?: boolean;
  /** Present on every view. */
  warehouses?: InventoryReportFilterOption[];
  /** Stock Ledger only. */
  showDateRange?: boolean;
  /** Current Stock only — Business Rules #1's "show zero-stock products too" toggle. */
  showZeroStockToggle?: boolean;
}

/**
 * The shared filter bar for every Inventory Reports screen
 * (70-inventory-reports.md's UI section) — mirrors sales/purchase-report-
 * filter-bar.tsx's own URL-state pattern: every filter lives in the query
 * string, so a full server re-render always has the complete filter state.
 * Which optional controls render is driven purely by which props the page
 * passes in, so one component serves all four views.
 */
export function InventoryReportFilterBar({
  products,
  productRequired,
  warehouses,
  showDateRange,
  showZeroStockToggle,
}: InventoryReportFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {showDateRange ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              value={searchParams.get("dateFrom") ?? ""}
              onChange={(event) => updateParams({ dateFrom: event.target.value || undefined })}
              className="sm:w-40"
              aria-label="From date"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              value={searchParams.get("dateTo") ?? ""}
              onChange={(event) => updateParams({ dateTo: event.target.value || undefined })}
              className="sm:w-40"
              aria-label="To date"
            />
          </label>
        </>
      ) : null}

      {products ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Product
          <SearchableSelect
            options={products}
            value={searchParams.get("productId") ?? undefined}
            onChange={(next) => updateParams({ productId: next })}
            getOptionId={(product) => product.id}
            getOptionLabel={(product) => product.name}
            allowNone={!productRequired}
            noneLabel="All Products"
            placeholder={productRequired ? "Select a product" : "All Products"}
            aria-label="Filter by product"
            className="w-full sm:w-56"
          />
        </label>
      ) : null}

      {warehouses ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Warehouse
          <SearchableSelect
            options={warehouses}
            value={searchParams.get("warehouseId") ?? undefined}
            onChange={(next) => updateParams({ warehouseId: next })}
            getOptionId={(warehouse) => warehouse.id}
            getOptionLabel={(warehouse) => warehouse.name}
            noneLabel="All Warehouses"
            placeholder="All Warehouses"
            aria-label="Filter by warehouse"
            className="w-full sm:w-48"
          />
        </label>
      ) : null}

      {showZeroStockToggle ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={searchParams.get("includeZeroStock") === "true"}
            onCheckedChange={(checked) => updateParams({ includeZeroStock: checked ? "true" : undefined })}
            aria-label="Show zero-stock products too"
          />
          Show zero-stock products too
        </label>
      ) : null}
    </div>
  );
}
