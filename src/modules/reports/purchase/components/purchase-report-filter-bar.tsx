"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_VALUE = "all";

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
          <Select
            value={searchParams.get("supplierId") ?? ALL_VALUE}
            onValueChange={(next) => updateParams({ supplierId: !next || next === ALL_VALUE ? undefined : next })}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by supplier">
              <SelectValue>
                {(current: string | null) => suppliers.find((supplier) => supplier.id === current)?.name ?? "All Suppliers"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Suppliers</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {products ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Product
          <Select
            value={searchParams.get("productId") ?? ALL_VALUE}
            onValueChange={(next) => updateParams({ productId: !next || next === ALL_VALUE ? undefined : next })}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by product">
              <SelectValue>
                {(current: string | null) => products.find((product) => product.id === current)?.name ?? "All Products"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Products</SelectItem>
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
