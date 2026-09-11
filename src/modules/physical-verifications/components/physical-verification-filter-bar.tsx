"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PHYSICAL_VERIFICATION_STATUS_LABELS } from "@/modules/physical-verifications/components/physical-verification-status-badge";
import { PHYSICAL_VERIFICATION_STATUS_VALUES } from "@/modules/physical-verifications/validation/physical-verification-schema";
import type { PhysicalVerificationWarehouseOption } from "@/types/physical-verification";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface PhysicalVerificationFilterBarProps {
  warehouses: PhysicalVerificationWarehouseOption[];
}

/** Search + status/warehouse/date filters — 49-physical-verification.md's
 * UI: "search + status/warehouse/date filters". Mirrors
 * stock-transfer-filter-bar.tsx's URL-state pattern, with a single
 * warehouse Select (header-level, not source/destination). */
export function PhysicalVerificationFilterBar({ warehouses }: PhysicalVerificationFilterBarProps) {
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
        placeholder="Search verification number or narration…"
        className="sm:max-w-xs"
        aria-label="Search physical verifications"
      />

      <Select
        value={searchParams.get("status") ?? ALL_VALUE}
        onValueChange={(next) => updateParams({ status: next ?? ALL_VALUE })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
          <SelectValue>
            {(current: string | null) =>
              PHYSICAL_VERIFICATION_STATUS_VALUES.includes(current as (typeof PHYSICAL_VERIFICATION_STATUS_VALUES)[number])
                ? PHYSICAL_VERIFICATION_STATUS_LABELS[current as (typeof PHYSICAL_VERIFICATION_STATUS_VALUES)[number]]
                : "All Statuses"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
          {PHYSICAL_VERIFICATION_STATUS_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {PHYSICAL_VERIFICATION_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("warehouseId") ?? ALL_VALUE}
        onValueChange={(next) => updateParams({ warehouseId: next ?? ALL_VALUE })}
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
