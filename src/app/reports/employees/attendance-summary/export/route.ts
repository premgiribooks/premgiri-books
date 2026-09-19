import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toAttendanceSummaryExportTable } from "@/engines/reporting/employee-reports";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";
import { attendanceSummaryFiltersSchema } from "@/modules/reports/employees/validation/employee-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(periodStart: string, periodEnd: string): string {
  const safeStart = periodStart.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeEnd = periodEnd.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Attendance-Summary-${safeStart}_to_${safeEnd}.xlsx`;
}

/**
 * Delivers the Attendance Summary report as a downloadable `.xlsx`,
 * following trial-balance/export/route.ts's own reference wiring exactly.
 * Re-checks its own `reports`/`export` permission independently of the
 * calling screen's Export button — `employeeReportService.
 * getAttendanceSummaryReport` re-checks `reports`/`view` on its own, the
 * same module every other Employee Reports view (and the seeded
 * Accountant role) is gated on, since this report has no separate
 * payroll/salary permission module of its own. `employeeId`/`branchId` are
 * optional filters — omitted entirely from the parsed object when absent
 * from the query string.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const periodStart = url.searchParams.get("periodStart") ?? "";
    const periodEnd = url.searchParams.get("periodEnd") ?? "";
    const employeeId = url.searchParams.get("employeeId");
    const branchId = url.searchParams.get("branchId");

    const filters = attendanceSummaryFiltersSchema.parse({
      periodStart,
      periodEnd,
      ...(employeeId ? { employeeId } : {}),
      ...(branchId ? { branchId } : {}),
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await employeeReportService.getAttendanceSummaryReport(filters);
    const buffer = await exportToExcelBuffer(toAttendanceSummaryExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.periodStart, filters.periodEnd)}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid period, employee, or branch." }, { status: 400 });
    }
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ err: error }, "Unhandled error generating Attendance Summary Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
