"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYROLL_RUN_STATUS_LABELS } from "@/modules/payroll/components/payroll-run-status-badge";
import type { FinancialYear } from "@/types/financial-year";

const ALL_VALUE = "all";
const PAYROLL_REGISTER_STATUS_VALUES = ["all", "DRAFT", "POSTED", "CANCELLED"] as const;

interface EmployeeReportFilterOption {
  id: string;
  name: string;
}

interface EmployeeReportFilterBarProps {
  /** Attendance Summary Report's own required period range. */
  showPeriod?: boolean;
  /** Payroll Register / Salary Register's own optional date range. */
  showDateRange?: boolean;
  /** Attendance Summary Report (optional) / Salary Register (required). */
  employees?: EmployeeReportFilterOption[];
  employeeRequired?: boolean;
  /** Attendance Summary Report / Employee Directory — both optional. */
  branches?: EmployeeReportFilterOption[];
  /** Payroll Register / Salary Register — both optional, default to the active FY. */
  financialYears?: FinancialYear[];
  /** Payroll Register only — defaults to POSTED server-side. */
  showPayrollStatus?: boolean;
  /** Employee Directory only — defaults to active server-side. */
  showEmployeeStatus?: boolean;
  /** Employee Directory only. */
  showDepartmentDesignation?: boolean;
}

/**
 * The shared filter bar for every Employee Reports screen
 * (73-employee-reports.md's UI section) — mirrors
 * customer-report-filter-bar.tsx's own URL-state pattern exactly: every
 * filter lives in the query string, so a full server re-render always has
 * the complete filter state. Which optional controls render is driven
 * purely by which props the page passes in, so one component serves all
 * four views.
 */
export function EmployeeReportFilterBar({
  showPeriod,
  showDateRange,
  employees,
  employeeRequired,
  branches,
  financialYears,
  showPayrollStatus,
  showEmployeeStatus,
  showDepartmentDesignation,
}: EmployeeReportFilterBarProps) {
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {showPeriod ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Period Start
            <Input
              type="date"
              value={searchParams.get("periodStart") ?? ""}
              onChange={(event) => updateParams({ periodStart: event.target.value || undefined })}
              className="sm:w-40"
              aria-label="Period start"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Period End
            <Input
              type="date"
              value={searchParams.get("periodEnd") ?? ""}
              onChange={(event) => updateParams({ periodEnd: event.target.value || undefined })}
              className="sm:w-40"
              aria-label="Period end"
            />
          </label>
        </>
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

      {financialYears ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Financial Year
          <Select
            value={searchParams.get("financialYearId") ?? ""}
            onValueChange={(next) => updateParams({ financialYearId: next || undefined })}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Financial year">
              <SelectValue>
                {(current: string | null) => financialYears.find((fy) => fy.id === current)?.name ?? "Active FY"}
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
      ) : null}

      {employees ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Employee
          <Select
            value={searchParams.get("employeeId") ?? ""}
            onValueChange={(next) => updateParams({ employeeId: next || undefined })}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Select an employee">
              <SelectValue>
                {(current: string | null) =>
                  employees.find((employee) => employee.id === current)?.name ??
                  (employeeRequired ? "Select an employee" : "Every employee")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {!employeeRequired ? <SelectItem value={ALL_VALUE}>Every employee</SelectItem> : null}
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {branches ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Branch
          <Select
            value={searchParams.get("branchId") ?? ALL_VALUE}
            onValueChange={(next) => updateParams({ branchId: next ?? undefined })}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by branch">
              <SelectValue>
                {(current: string | null) => branches.find((branch) => branch.id === current)?.name ?? "All Branches"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {showDepartmentDesignation ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Department
            <Input
              value={searchParams.get("department") ?? ""}
              onChange={(event) => updateParams({ department: event.target.value || undefined })}
              placeholder="Any department"
              className="sm:w-40"
              aria-label="Filter by department"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Designation
            <Input
              value={searchParams.get("designation") ?? ""}
              onChange={(event) => updateParams({ designation: event.target.value || undefined })}
              placeholder="Any designation"
              className="sm:w-40"
              aria-label="Filter by designation"
            />
          </label>
        </>
      ) : null}

      {showPayrollStatus ? (
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
              {PAYROLL_REGISTER_STATUS_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "all" ? "All Statuses" : PAYROLL_RUN_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {showEmployeeStatus ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Status
          <Select
            value={searchParams.get("status") ?? "active"}
            onValueChange={(next) => updateParams({ status: !next || next === "active" ? undefined : next })}
          >
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
