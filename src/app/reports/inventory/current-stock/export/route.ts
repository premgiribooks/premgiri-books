import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toCurrentStockExportTable } from "@/engines/reporting/inventory-reports";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import { currentStockFiltersSchema } from "@/modules/reports/inventory/validation/inventory-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOWNLOAD_FILENAME = "Current-Stock.xlsx";

/**
 * Delivers the Current Stock report as a downloadable `.xlsx`, following
 * trial-balance/export/route.ts's own reference wiring exactly. Re-checks
 * its own `reports`/`export` permission independently of the calling
 * screen's Export button; `inventoryReportService.getCurrentStockReport`
 * re-checks `reports`/`view` on its own. Every filter is optional (mirroring
 * customer-directory/export/route.ts's own precedent), so the filename
 * carries no filter-derived suffix.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const productIdParam = url.searchParams.get("productId");
    const warehouseIdParam = url.searchParams.get("warehouseId");
    const includeZeroStockParam = url.searchParams.get("includeZeroStock");
    const filters = currentStockFiltersSchema.parse({
      ...(productIdParam ? { productId: productIdParam } : {}),
      ...(warehouseIdParam ? { warehouseId: warehouseIdParam } : {}),
      ...(includeZeroStockParam ? { includeZeroStock: includeZeroStockParam } : {}),
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await inventoryReportService.getCurrentStockReport(filters);
    const buffer = await exportToExcelBuffer(toCurrentStockExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${DOWNLOAD_FILENAME}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid product or warehouse." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Current Stock Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
