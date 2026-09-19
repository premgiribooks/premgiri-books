import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toPartyWisePurchaseExportTable } from "@/engines/reporting/purchase-reports";
import { purchaseReportService } from "@/modules/reports/purchase/services/purchase-report-service";
import { partyWisePurchaseFiltersSchema } from "@/modules/reports/purchase/validation/purchase-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(dateFrom: string, dateTo: string): string {
  const safeDateFrom = dateFrom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeDateTo = dateTo.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Party-wise-Purchases-${safeDateFrom}_to_${safeDateTo}.xlsx`;
}

/**
 * Delivers the Party-wise Purchase Report as a downloadable `.xlsx`,
 * following purchase/register/export/route.ts's own reference wiring
 * exactly. Re-checks its own `reports`/`export` permission independently of
 * the calling screen's Export button; `purchaseReportService.
 * getPartyWisePurchaseReport` re-checks `reports`/`view` on its own. No
 * optional query params — `partyWisePurchaseFiltersSchema` only has
 * `dateFrom`/`dateTo`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";

    const filters = partyWisePurchaseFiltersSchema.parse({ dateFrom, dateTo });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await purchaseReportService.getPartyWisePurchaseReport(filters);
    const buffer = await exportToExcelBuffer(toPartyWisePurchaseExportTable(report));

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
    logger.error({ err: error }, "Unhandled error generating Party-wise Purchase Report Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
