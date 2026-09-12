import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { AttendanceRosterDateBar } from "@/modules/attendance/components/attendance-roster-date-bar";
import { AttendanceRosterTable } from "@/modules/attendance/components/attendance-roster-table";
import { attendanceService } from "@/modules/attendance/services/attendance-service";
import { isValidCalendarDate, toUtcDate } from "@/modules/attendance/validation/attendance-schema";
import { employeeService } from "@/modules/employees/services/employee-service";
import type { AttendanceStatus } from "@/types/attendance";

interface AttendanceRosterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendanceRosterPage({ searchParams }: AttendanceRosterPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "employees", "view");
  if (!canView) {
    redirect("/");
  }

  const requestedDate = firstValue((await searchParams).date);
  const date =
    requestedDate && isValidCalendarDate(requestedDate) ? requestedDate : todayDateInputValue();
  const dateAsDate = toUtcDate(date);

  const [employees, records, isAdmin, canEdit] = await Promise.all([
    employeeService.listSelectableEmployees(),
    attendanceService.listAttendance({ dateFrom: dateAsDate, dateTo: dateAsDate }),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "employees", "create"),
  ]);

  const existingByEmployeeId: Record<string, { status: AttendanceStatus; remarks: string | null }> = {};
  for (const record of records) {
    existingByEmployeeId[record.employeeId] = { status: record.status, remarks: record.remarks };
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Attendance</h1>
            <p className="text-sm text-muted-foreground">
              Mark each active employee&apos;s status for the selected date.
            </p>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/employees/attendance/history">
                <History size={18} />
                History
              </Link>
            }
          />
        </div>

        <AttendanceRosterDateBar date={date} />

        <AttendanceRosterTable
          key={date}
          employees={employees}
          date={date}
          existingByEmployeeId={existingByEmployeeId}
          canEdit={canEdit}
        />
      </div>
    </AppShell>
  );
}
