"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_VALUE = "all";

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
          <Select
            value={searchParams.get("productId") ?? (productRequired ? "" : ALL_VALUE)}
            onValueChange={(next) => updateParams({ productId: !next || next === ALL_VALUE ? undefined : next })}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Filter by product">
              <SelectValue>
                {(current: string | null) =>
                  products.find((product) => product.id === current)?.name ?? (productRequired ? "Select a product" : "All Products")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {productRequired ? null : <SelectItem value={ALL_VALUE}>All Products</SelectItem>}
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {warehouses ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Warehouse
          <Select
            value={searchParams.get("warehouseId") ?? ALL_VALUE}
            onValueChange={(next) => updateParams({ warehouseId: !next || next === ALL_VALUE ? undefined : next })}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by warehouse">
              <SelectValue>
                {(current: string | null) => warehouses.find((warehouse) => warehouse.id === current)?.name ?? "All Warehouses"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
