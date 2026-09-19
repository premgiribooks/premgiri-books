import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toEmployeeDirectoryExportTable } from "@/engines/reporting/employee-reports";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";
import { employeeDirectoryFiltersSchema } from "@/modules/reports/employees/validation/employee-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOWNLOAD_FILENAME = "Employee-Directory.xlsx";

/**
 * Delivers the Employee Directory report as a downloadable `.xlsx`,
 * following customers/directory/export/route.ts's own reference wiring for
 * an all-optional-filter directory report exactly. Re-checks its own
 * `reports`/`export` permission independently of the calling screen's
 * Export button — `employeeReportService.getEmployeeDirectory` re-checks
 * `reports`/`view` on its own, the same module every other Employee
 * Reports view is gated on. Every filter (department/designation/branchId/
 * status) is optional, so the filename carries no filter-derived suffix.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const department = url.searchParams.get("department");
    const designation = url.searchParams.get("designation");
    const branchId = url.searchParams.get("branchId");
    const status = url.searchParams.get("status");

    const filters = employeeDirectoryFiltersSchema.parse({
      ...(department ? { department } : {}),
      ...(designation ? { designation } : {}),
      ...(branchId ? { branchId } : {}),
      ...(status ? { status } : {}),
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await employeeReportService.getEmployeeDirectory(filters);
    const buffer = await exportToExcelBuffer(toEmployeeDirectoryExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${DOWNLOAD_FILENAME}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid department, designation, branch, or status." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Employee Directory Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
