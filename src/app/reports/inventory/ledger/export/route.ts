import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { assertPermission } from "@/lib/permissions";
import { toStockLedgerExportTable } from "@/engines/reporting/inventory-reports";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import { stockLedgerFiltersSchema } from "@/modules/reports/inventory/validation/inventory-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadFilename(productName: string): string {
  return `Stock-Ledger-${productName.replace(/[^a-zA-Z0-9._-]/g, "_")}.xlsx`;
}

/**
 * Delivers the Stock Ledger report as a downloadable `.xlsx`, following
 * trial-balance/export/route.ts's own reference wiring exactly. Re-checks
 * its own `reports`/`export` permission independently of the calling
 * screen's Export button; `inventoryReportService.getStockLedgerReport`
 * re-checks `reports`/`view` on its own. The download filename is built
 * from the report's own `productName` (not the raw query param), mirroring
 * customer-statement/export/route.ts's identical precedent — dateFrom/dateTo
 * are optional here (unlike Customer Statement's required pair), so they
 * carry no filename suffix.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const warehouseIdParam = url.searchParams.get("warehouseId");
    const dateFromParam = url.searchParams.get("dateFrom");
    const dateToParam = url.searchParams.get("dateTo");
    const filters = stockLedgerFiltersSchema.parse({
      productId: url.searchParams.get("productId") ?? "",
      ...(warehouseIdParam ? { warehouseId: warehouseIdParam } : {}),
      ...(dateFromParam ? { dateFrom: dateFromParam } : {}),
      ...(dateToParam ? { dateTo: dateToParam } : {}),
    });

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await inventoryReportService.getStockLedgerReport(filters);
    const buffer = await exportToExcelBuffer(toStockLedgerExportTable(report));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(report.productName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid product and date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Stock Ledger Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
