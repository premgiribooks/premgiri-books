"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";

interface PurchaseReportFilterOption {
  id: string;
  name: string;
}

interface PurchaseReportFilterBarProps {
  /** Present only for views that offer a supplier filter (Purchase
   * Register, Item-wise, Purchase Return Summary — not Party-wise, which
   * groups BY supplier). */
  suppliers?: PurchaseReportFilterOption[];
  /** Item-wise Purchase Report only. */
  products?: PurchaseReportFilterOption[];
  /** Item-wise Purchase Report only. */
  warehouses?: PurchaseReportFilterOption[];
  /** Purchase Register / Purchase Return Summary only — both default to
   * `POSTED` server-side when omitted. */
  statusOptions?: readonly string[];
}

/**
 * The shared date-range + view-specific filter bar for every Purchase
 * Reports screen (69-purchase-reports.md's UI section) — mirrors
 * sales-report-filter-bar.tsx exactly: URL-state pattern, every filter lives
 * in the query string, so a full server re-render always has the complete
 * filter state. Which optional selects render is driven purely by which
 * option lists the page passes in, so one component serves all four views.
 */
export function PurchaseReportFilterBar({ suppliers, products, warehouses, statusOptions }: PurchaseReportFilterBarProps) {
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

      {suppliers ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Supplier
          <SearchableSelect
            options={suppliers}
            value={searchParams.get("supplierId") ?? undefined}
            onChange={(next) => updateParams({ supplierId: next })}
            getOptionId={(supplier) => supplier.id}
            getOptionLabel={(supplier) => supplier.name}
            noneLabel="All Suppliers"
            placeholder="All Suppliers"
            aria-label="Filter by supplier"
            className="w-full sm:w-48"
          />
        </label>
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
            noneLabel="All Products"
            placeholder="All Products"
            aria-label="Filter by product"
            className="w-full sm:w-48"
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

      {statusOptions ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Status
          <Select
            value={searchParams.get("status") ?? "POSTED"}
            onValueChange={(next) => updateParams({ status: !next || next === "POSTED" ? undefined : next })}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}
    </div>
  );
}
