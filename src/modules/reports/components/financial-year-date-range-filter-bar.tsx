"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/common/searchable-select";
import { resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { FinancialYear } from "@/types/financial-year";

interface FinancialYearDateRangeFilterBarProps {
  financialYears: FinancialYear[];
  selectedFinancialYearId: string;
  from: string;
  to: string;
}

/**
 * Financial Year + from/to Date Range filter bar (65-profit-and-loss.md) —
 * the from/to variant of financial-year-as-of-date-filter-bar.tsx
 * (64-trial-balance.md), same URL-state pattern: every filter lives in the
 * query string, so a full server re-render always has the complete filter
 * state. Changing the Financial Year resets the range to that year's own
 * default (`[startDate, today-clamped-to-range]`) rather than keeping a
 * range that might now fall outside the newly selected year.
 */
export function FinancialYearDateRangeFilterBar({
  financialYears,
  selectedFinancialYearId,
  from,
  to,
}: FinancialYearDateRangeFilterBarProps) {
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

  function handleFinancialYearChange(financialYearId: string | null) {
    if (!financialYearId) {
      return;
    }
    const nextFinancialYear = financialYears.find((financialYear) => financialYear.id === financialYearId);
    updateParams({
      financialYearId,
      from: nextFinancialYear ? toCalendarDateString(nextFinancialYear.startDate) : undefined,
      to: nextFinancialYear ? resolveDefaultAsOfDate(nextFinancialYear) : undefined,
    });
  }

  const selectedFinancialYear = financialYears.find((financialYear) => financialYear.id === selectedFinancialYearId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Financial Year
        <SearchableSelect
          options={financialYears}
          value={selectedFinancialYearId}
          onChange={(next) => handleFinancialYearChange(next ?? null)}
          getOptionId={(financialYear) => financialYear.id}
          getOptionLabel={(financialYear) => financialYear.name}
          allowNone={false}
          placeholder="Select a financial year"
          aria-label="Financial year"
          className="w-full sm:w-48"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        From
        <Input
          type="date"
          value={from}
          min={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.startDate) : undefined}
          max={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.endDate) : undefined}
          onChange={(event) => updateParams({ from: event.target.value || undefined })}
          className="sm:w-40"
          aria-label="From date"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        To
        <Input
          type="date"
          value={to}
          min={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.startDate) : undefined}
          max={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.endDate) : undefined}
          onChange={(event) => updateParams({ to: event.target.value || undefined })}
          className="sm:w-40"
          aria-label="To date"
        />
      </label>
    </div>
  );
}
