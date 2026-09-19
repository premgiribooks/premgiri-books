import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toSalesReturnSummaryExportTable } from "@/engines/reporting/sales-reports";
import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";
import { salesReturnSummaryFiltersSchema } from "@/modules/reports/sales/validation/sales-report-schema";

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
  return `Sales-Return-Summary-${safeFrom}_to_${safeTo}.${format}`;
}

/**
 * Delivers the Sales Return Summary as a downloadable `.xlsx` or `.pdf`,
 * following sales/register/export/route.ts's own reference wiring exactly.
 * Re-checks its own `reports`/`export` permission independently of the
 * calling screen's Export button — both formats are equally gated — ahead
 * of the format branch; `salesReportService.getSalesReturnSummary`
 * re-checks `reports`/`view` on its own. `customerId`/`status` are optional
 * filters — omitted entirely from the parsed object when absent from the
 * query string, letting `salesReturnSummaryFiltersSchema`'s own
 * `.default("POSTED")` apply exactly as it does for the on-screen report.
 * Reuses the exact same `toSalesReturnSummaryExportTable(report)` shaping
 * for both rendering targets — one shaping function, two rendering targets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";
    const customerId = url.searchParams.get("customerId");
    const status = url.searchParams.get("status");

    const filters = salesReturnSummaryFiltersSchema.parse({
      dateFrom,
      dateTo,
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await salesReportService.getSalesReturnSummary(filters);
    const tables = toSalesReturnSummaryExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const pdf = await renderHtmlToPdf(html, { format: "A4", orientation: "portrait" });

      return new NextResponse(new Uint8Array(pdf), {
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
    logger.error({ err: error }, "Unhandled error generating Sales Return Summary Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
