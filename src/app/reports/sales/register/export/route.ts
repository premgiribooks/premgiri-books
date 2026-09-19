import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toSalesRegisterExportTable } from "@/engines/reporting/sales-reports";
import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";
import { salesRegisterFiltersSchema } from "@/modules/reports/sales/validation/sales-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(dateFrom: string, dateTo: string): string {
  const safeFrom = dateFrom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeTo = dateTo.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Sales-Register-${safeFrom}_to_${safeTo}.xlsx`;
}

/**
 * Delivers the Sales Register report as a downloadable `.xlsx`, following
 * trial-balance/export/route.ts's own reference wiring exactly. Re-checks
 * its own `reports`/`export` permission independently of the calling
 * screen's Export button; `salesReportService.getSalesRegister` re-checks
 * `reports`/`view` on its own. `customerId`/`status` are optional filters —
 * omitted entirely from the parsed object when absent from the query
 * string, letting `salesRegisterFiltersSchema`'s own `.default("POSTED")`
 * apply exactly as it does for the on-screen report.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";
    const customerId = url.searchParams.get("customerId");
    const status = url.searchParams.get("status");

    const filters = salesRegisterFiltersSchema.parse({
      dateFrom,
      dateTo,
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await salesReportService.getSalesRegister(filters);
    const buffer = await exportToExcelBuffer(toSalesRegisterExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.dateFrom, filters.dateTo)}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Sales Register Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
