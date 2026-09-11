"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PURCHASE_RETURN_STATUS_LABELS } from "@/modules/purchase-returns/components/purchase-return-status-badge";
import { PURCHASE_RETURN_STATUS_VALUES } from "@/modules/purchase-returns/validation/purchase-return-schema";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

/** Search + status filter for the purchase return list — mirrors
 * purchase-invoice-filter-bar.tsx's / sales-return-filter-bar.tsx's
 * URL-state pattern exactly. */
export function PurchaseReturnFilterBar() {
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
        placeholder="Search return or invoice number, or supplier…"
        className="sm:max-w-xs"
        aria-label="Search purchase returns"
      />

      <Select
        value={searchParams.get("status") ?? ALL_VALUE}
        onValueChange={(next) => updateParams({ status: next ?? ALL_VALUE })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
          <SelectValue>
            {(current: string | null) =>
              PURCHASE_RETURN_STATUS_VALUES.includes(current as (typeof PURCHASE_RETURN_STATUS_VALUES)[number])
                ? PURCHASE_RETURN_STATUS_LABELS[current as (typeof PURCHASE_RETURN_STATUS_VALUES)[number]]
                : "All Statuses"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
          {PURCHASE_RETURN_STATUS_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {PURCHASE_RETURN_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
