"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/common/searchable-select";
import { resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { FinancialYear } from "@/types/financial-year";

interface FinancialYearAsOfDateFilterBarProps {
  financialYears: FinancialYear[];
  selectedFinancialYearId: string;
  asOfDate: string;
}

/**
 * Financial Year + As-Of-Date filter bar (64-trial-balance.md) — reused by
 * 66-balance-sheet.md's own as-of-date screen. URL-state pattern, matching
 * gst-report-filter-bar.tsx exactly: every filter lives in the query string,
 * so a full server re-render always has the complete filter state. Changing
 * the Financial Year resets the as-of date to that year's own default
 * (today, clamped into its [startDate, endDate] range) rather than keeping a
 * date that might now fall outside the newly selected year.
 */
export function FinancialYearAsOfDateFilterBar({
  financialYears,
  selectedFinancialYearId,
  asOfDate,
}: FinancialYearAsOfDateFilterBarProps) {
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
      asOfDate: nextFinancialYear ? resolveDefaultAsOfDate(nextFinancialYear) : undefined,
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
        As of
        <Input
          type="date"
          value={asOfDate}
          min={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.startDate) : undefined}
          max={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.endDate) : undefined}
          onChange={(event) => updateParams({ asOfDate: event.target.value || undefined })}
          className="sm:w-40"
          aria-label="As of date"
        />
      </label>
    </div>
  );
}
