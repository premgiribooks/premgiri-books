"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOMER_TYPE_LABELS } from "@/modules/customers/components/customer-type-badge";
import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";
import { resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { FinancialYear } from "@/types/financial-year";

const ALL_VALUE = "all";

interface CustomerReportFilterOption {
  id: string;
  name: string;
}

interface CustomerReportFilterBarProps {
  /** Customer Outstanding Report only. */
  financialYears?: FinancialYear[];
  selectedFinancialYearId?: string;
  asOfDate?: string;
  /** Customer Statement / Customer Sales Summary — both take a from/to date range. */
  showDateRange?: boolean;
  /** Customer Statement's own required customer picker. */
  customers?: CustomerReportFilterOption[];
  /** Customer Outstanding Report / Customer Directory — both default to active-only server-side. */
  showStatus?: boolean;
  /** Customer Directory only. */
  showCustomerType?: boolean;
}

/**
 * The shared filter bar for every Customer Reports screen
 * (71-customer-reports.md's UI section) — mirrors purchase/inventory-
 * report-filter-bar.tsx's own URL-state pattern: every filter lives in the
 * query string, so a full server re-render always has the complete filter
 * state. Which optional controls render is driven purely by which props the
 * page passes in, so one component serves all four views.
 */
export function CustomerReportFilterBar({
  financialYears,
  selectedFinancialYearId,
  asOfDate,
  showDateRange,
  customers,
  showStatus,
  showCustomerType,
}: CustomerReportFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | undefined>) {
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
  }

  // Status defaults to "active" server-side (not "all", unlike every other
  // select in this bar) — so "all" must stay explicit in the URL rather
  // than being stripped as a no-op value, or selecting it would silently
  // revert to "active" on the next render.
  function handleStatusChange(status: string | null) {
    updateParams({ status: !status || status === "active" ? undefined : status });
  }

  function handleFinancialYearChange(financialYearId: string | null) {
    if (!financialYearId || !financialYears) {
      return;
    }
    const nextFinancialYear = financialYears.find((financialYear) => financialYear.id === financialYearId);
    updateParams({
      financialYearId,
      asOfDate: nextFinancialYear ? resolveDefaultAsOfDate(nextFinancialYear) : undefined,
    });
  }

  const selectedFinancialYear = financialYears?.find((financialYear) => financialYear.id === selectedFinancialYearId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {financialYears ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Financial Year
            <Select value={selectedFinancialYearId} onValueChange={handleFinancialYearChange}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Financial year">
                <SelectValue>
                  {(current: string | null) => financialYears.find((fy) => fy.id === current)?.name ?? "Select a financial year"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {financialYears.map((financialYear) => (
                  <SelectItem key={financialYear.id} value={financialYear.id}>
                    {financialYear.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            As of
            <Input
              type="date"
              value={asOfDate ?? ""}
              min={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.startDate) : undefined}
              max={selectedFinancialYear ? toCalendarDateString(selectedFinancialYear.endDate) : undefined}
              onChange={(event) => updateParams({ asOfDate: event.target.value || undefined })}
              className="sm:w-40"
              aria-label="As of date"
            />
          </label>
        </>
      ) : null}

      {customers ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Customer
          <Select
            value={searchParams.get("customerId") ?? ""}
            onValueChange={(next) => updateParams({ customerId: next || undefined })}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Select a customer">
              <SelectValue>
                {(current: string | null) => customers.find((customer) => customer.id === current)?.name ?? "Select a customer"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

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

      {showCustomerType ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Type
          <Select
            value={searchParams.get("customerType") ?? ALL_VALUE}
            onValueChange={(next) => updateParams({ customerType: !next || next === ALL_VALUE ? undefined : next })}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by customer type">
              <SelectValue>
                {(current: string | null) =>
                  CUSTOMER_TYPE_VALUES.find((value) => value === current)
                    ? CUSTOMER_TYPE_LABELS[current as (typeof CUSTOMER_TYPE_VALUES)[number]]
                    : "All Types"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Types</SelectItem>
              {CUSTOMER_TYPE_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CUSTOMER_TYPE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {showStatus ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Status
          <Select value={searchParams.get("status") ?? "active"} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
            </SelectContent>
          </Select>
        </label>
      ) : null}
    </div>
  );
}
