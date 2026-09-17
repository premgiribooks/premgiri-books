"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/common/searchable-select";
import type { AttendanceEmployeeOption } from "@/types/attendance";

const ALL_EMPLOYEES_VALUE = "all";

interface AttendanceHistoryFilterBarProps {
  employees: AttendanceEmployeeOption[];
}

/** Employee + date-range filter for the read-only history page
 * (62-attendance.md's UI section) — filter state lives in the URL, mirroring
 * employee-filter-bar.tsx. */
export function AttendanceHistoryFilterBar({ employees }: AttendanceHistoryFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ALL_EMPLOYEES_VALUE) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const employeeId = searchParams.get("employeeId") ?? ALL_EMPLOYEES_VALUE;
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchableSelect
        options={employees}
        value={employeeId === ALL_EMPLOYEES_VALUE ? undefined : employeeId}
        onChange={(next) => updateParams({ employeeId: next ?? ALL_EMPLOYEES_VALUE })}
        getOptionId={(employee) => employee.id}
        getOptionLabel={(employee) => `${employee.employeeCode} — ${employee.fullName}`}
        noneLabel="All Employees"
        placeholder="All Employees"
        aria-label="Filter by employee"
        className="w-full sm:w-56"
      />

      <Input
        type="date"
        value={dateFrom}
        onChange={(event) => updateParams({ dateFrom: event.target.value || undefined })}
        className="w-full sm:w-44"
        aria-label="From date"
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(event) => updateParams({ dateTo: event.target.value || undefined })}
        className="w-full sm:w-44"
        aria-label="To date"
      />
    </div>
  );
}
