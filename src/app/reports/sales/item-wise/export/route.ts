import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdfOrHtml } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toItemWiseSalesExportTable } from "@/engines/reporting/sales-reports";
import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";
import { itemWiseSalesFiltersSchema } from "@/modules/reports/sales/validation/sales-report-schema";

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

function downloadFilename(dateFrom: string, dateTo: string, format: ExportFormat): string {
  const safeFrom = dateFrom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeTo = dateTo.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Item-wise-Sales-${safeFrom}_to_${safeTo}.${format}`;
}

/**
 * Delivers the Item-wise Sales Report as a downloadable `.xlsx` or `.pdf`,
 * following sales/register/export/route.ts's and trial-balance/export/
 * route.ts's own reference wiring exactly. Re-checks its own
 * `reports`/`export` permission independently of the calling screen's
 * Export button — both formats are equally gated — ahead of the format
 * branch; `salesReportService.getItemWiseSalesReport` re-checks
 * `reports`/`view` on its own. `productId`/`warehouseId`/`customerId` are
 * all optional filters — omitted entirely from the parsed object when
 * absent from the query string. Reuses the exact same
 * `toItemWiseSalesExportTable(report)` shaping for both rendering targets —
 * one shaping function, two rendering targets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";
    const productId = url.searchParams.get("productId");
    const warehouseId = url.searchParams.get("warehouseId");
    const customerId = url.searchParams.get("customerId");

    const filters = itemWiseSalesFiltersSchema.parse({
      dateFrom,
      dateTo,
      ...(productId ? { productId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(customerId ? { customerId } : {}),
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await salesReportService.getItemWiseSalesReport(filters);
    const tables = toItemWiseSalesExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const result = await renderHtmlToPdfOrHtml(html, { format: "A4", orientation: "portrait" });

      // See renderHtmlToPdfOrHtml's docstring: when Chromium can't launch on
      // this platform, this is the raw HTML instead of a real PDF, and the
      // client (src/lib/pdf-client.ts) falls back to opening its own print
      // dialog on it rather than downloading it as-is.
      if (result.kind === "html") {
        return new NextResponse(result.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          "Content-Type": PDF_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${downloadFilename(filters.dateFrom, filters.dateTo, "pdf")}"`,
        },
      });
    }

    const buffer = await exportToExcelBuffer(tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.dateFrom, filters.dateTo, "xlsx")}"`,
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
    logger.error({ err: error }, "Unhandled error generating Item-wise Sales Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
