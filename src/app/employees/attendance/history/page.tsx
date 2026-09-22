import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreAttendanceAction } from "@/modules/attendance/actions/attendance-actions";
import { AttendanceHistoryFilterBar } from "@/modules/attendance/components/attendance-history-filter-bar";
import { AttendanceHistoryTable } from "@/modules/attendance/components/attendance-history-table";
import { attendanceService } from "@/modules/attendance/services/attendance-service";
import { isValidCalendarDate, toUtcDate } from "@/modules/attendance/validation/attendance-schema";
import { employeeService } from "@/modules/employees/services/employee-service";
import type { AttendanceListFilters, AttendanceStatus } from "@/types/attendance";

interface AttendanceHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_VALUES: readonly AttendanceStatus[] = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"];

/** The current calendar month's [first day, last day], in UTC — the default
 * bound applied only when the visitor supplied neither dateFrom nor dateTo at
 * all, so a bare `/employees/attendance/history` visit never dumps the
 * company's entire attendance history in one unfiltered query. An explicit
 * one-sided range (e.g. only dateFrom) is left exactly as the visitor typed
 * it — this default never overrides a deliberate choice. */
function currentMonthRange(): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const dateFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dateTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { dateFrom, dateTo };
}

function parseFilters(params: Record<string, string | string[] | undefined>): AttendanceListFilters {
  const filters: AttendanceListFilters = {};

  const employeeId = firstValue(params.employeeId);
  if (employeeId) {
    filters.employeeId = employeeId;
  }

  const status = firstValue(params.status);
  if (status && (STATUS_VALUES as string[]).includes(status)) {
    filters.status = status as AttendanceStatus;
  }

  const rawDateFrom = firstValue(params.dateFrom);
  const rawDateTo = firstValue(params.dateTo);

  if (rawDateFrom === undefined && rawDateTo === undefined) {
    Object.assign(filters, currentMonthRange());
    return filters;
  }

  if (rawDateFrom && isValidCalendarDate(rawDateFrom)) {
    filters.dateFrom = toUtcDate(rawDateFrom);
  }
  if (rawDateTo && isValidCalendarDate(rawDateTo)) {
    filters.dateTo = toUtcDate(rawDateTo);
  }

  return filters;
}

export default async function AttendanceHistoryPage({ searchParams }: AttendanceHistoryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "employees", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [employees, { items: records, hasMore }, isAdmin] = await Promise.all([
    employeeService.listSelectableEmployees(),
    attendanceService.listAttendancePage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Attendance History</h1>
          <p className="text-sm text-muted-foreground">
            Read-only record of previously marked attendance.
          </p>
        </div>

        <AttendanceHistoryFilterBar employees={employees} />

        <AttendanceHistoryTable
          key={JSON.stringify(filters)}
          records={records}
          initialHasMore={hasMore}
          loadMore={loadMoreAttendanceAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
