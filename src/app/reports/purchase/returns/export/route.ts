import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toPurchaseReturnSummaryExportTable } from "@/engines/reporting/purchase-reports";
import { purchaseReportService } from "@/modules/reports/purchase/services/purchase-report-service";
import { purchaseReturnSummaryFiltersSchema } from "@/modules/reports/purchase/validation/purchase-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(dateFrom: string, dateTo: string): string {
  const safeDateFrom = dateFrom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeDateTo = dateTo.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Purchase-Return-Summary-${safeDateFrom}_to_${safeDateTo}.xlsx`;
}

/**
 * Delivers the Purchase Return Summary as a downloadable `.xlsx`, following
 * purchase/register/export/route.ts's own reference wiring exactly. Re-checks
 * its own `reports`/`export` permission independently of the calling
 * screen's Export button; `purchaseReportService.getPurchaseReturnSummary`
 * re-checks `reports`/`view` on its own. `supplierId`/`status` are optional
 * query params — each key is omitted entirely from the object handed to
 * `.parse()` when absent from the query string, so
 * `purchaseReturnSummaryFiltersSchema`'s own `.optional()`/
 * `.default("POSTED")` behave exactly as they do for a caller that never
 * mentions them.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";
    const supplierId = url.searchParams.get("supplierId");
    const status = url.searchParams.get("status");

    const rawFilters = {
      dateFrom,
      dateTo,
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
    };
    const filters = purchaseReturnSummaryFiltersSchema.parse(rawFilters);

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await purchaseReportService.getPurchaseReturnSummary(filters);
    const buffer = await exportToExcelBuffer(toPurchaseReturnSummaryExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.dateFrom, filters.dateTo)}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid date range, supplier, and status." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Purchase Return Summary Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
