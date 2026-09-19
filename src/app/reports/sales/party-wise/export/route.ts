import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toPartyWiseSalesExportTable } from "@/engines/reporting/sales-reports";
import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";
import { partyWiseSalesFiltersSchema } from "@/modules/reports/sales/validation/sales-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(dateFrom: string, dateTo: string): string {
  const safeFrom = dateFrom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeTo = dateTo.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Party-wise-Sales-${safeFrom}_to_${safeTo}.xlsx`;
}

/**
 * Delivers the Party-wise Sales Summary as a downloadable `.xlsx`, following
 * sales/register/export/route.ts's own reference wiring exactly. Re-checks
 * its own `reports`/`export` permission independently of the calling
 * screen's Export button; `salesReportService.getPartyWiseSalesReport`
 * re-checks `reports`/`view` on its own. `partyWiseSalesFiltersSchema` has
 * no optional filters beyond the date range itself.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";

    const filters = partyWiseSalesFiltersSchema.parse({ dateFrom, dateTo });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await salesReportService.getPartyWiseSalesReport(filters);
    const buffer = await exportToExcelBuffer(toPartyWiseSalesExportTable(report));

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
    logger.error({ err: error }, "Unhandled error generating Party-wise Sales Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
