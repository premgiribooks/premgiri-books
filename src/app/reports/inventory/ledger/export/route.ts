import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toStockLedgerExportTable } from "@/engines/reporting/inventory-reports";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import { stockLedgerFiltersSchema } from "@/modules/reports/inventory/validation/inventory-report-schema";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

type ExportFormat = "xlsx" | "pdf";

/**
 * Anything other than the literal string `"pdf"` is treated as `"xlsx"` —
 * this codebase's fail-safe-default convention (78-pdf-generation.md's
 * Business Rules), so an unrecognized `?format=` value never 500s, it just
 * falls back to the original behavior.
 */
function resolveFormat(value: string | null): ExportFormat {
  return value === "pdf" ? "pdf" : "xlsx";
}

function downloadFilename(productName: string, format: ExportFormat): string {
  return `Stock-Ledger-${productName.replace(/[^a-zA-Z0-9._-]/g, "_")}.${format}`;
}

/**
 * Delivers the Stock Ledger report as a downloadable `.xlsx` or `.pdf`,
 * following trial-balance/export/route.ts's own reference wiring exactly.
 * Re-checks its own `reports`/`export` permission independently of the
 * calling screen's Export button; `inventoryReportService.getStockLedgerReport`
 * re-checks `reports`/`view` on its own. The download filename is built
 * from the report's own `productName` (not the raw query param), mirroring
 * customer-statement/export/route.ts's identical precedent — dateFrom/dateTo
 * are optional here (unlike Customer Statement's required pair), so they
 * carry no filename suffix. Reuses the exact same
 * `toStockLedgerExportTable(report)` shaping for both rendering targets.
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
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await inventoryReportService.getStockLedgerReport(filters);
    const tables = toStockLedgerExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const pdf = await renderHtmlToPdf(html, { format: "A4", orientation: "portrait" });

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": PDF_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${downloadFilename(report.productName, "pdf")}"`,
        },
      });
    }

    const buffer = await exportToExcelBuffer(tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(report.productName, "xlsx")}"`,
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
