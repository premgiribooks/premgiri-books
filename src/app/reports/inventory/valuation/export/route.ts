import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toStockValuationExportTable } from "@/engines/reporting/inventory-reports";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import { stockValuationFiltersSchema } from "@/modules/reports/inventory/validation/inventory-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOWNLOAD_FILENAME = "Stock-Valuation.xlsx";

/**
 * Delivers the Stock Valuation report as a downloadable `.xlsx`, following
 * trial-balance/export/route.ts's own reference wiring exactly. Re-checks
 * its own `reports`/`export` permission independently of the calling
 * screen's Export button; `inventoryReportService.getStockValuationReport`
 * re-checks `reports`/`view` on its own. Its only filter (`warehouseId`) is
 * optional, mirroring customer-directory/export/route.ts's own precedent, so
 * the filename carries no filter-derived suffix.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const warehouseIdParam = url.searchParams.get("warehouseId");
    const filters = stockValuationFiltersSchema.parse({
      ...(warehouseIdParam ? { warehouseId: warehouseIdParam } : {}),
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await inventoryReportService.getStockValuationReport(filters);
    const buffer = await exportToExcelBuffer(toStockValuationExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${DOWNLOAD_FILENAME}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid warehouse." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Stock Valuation Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
