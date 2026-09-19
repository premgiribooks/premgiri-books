import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toGstDashboardExportTable } from "@/engines/reporting/gst-dashboard";
import { gstReportFiltersSchema } from "@/modules/gst/validation/gst-report-filters-schema";
import { gstReportsService } from "@/modules/reports/services/gst-reports-service";

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

function downloadFilename(from: string, to: string, format: ExportFormat): string {
  const safeFrom = from.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeTo = to.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `GST-Reports-${safeFrom}_to_${safeTo}.${format}`;
}

/**
 * Delivers the GST Reports dashboard (trend + embedded HSN Summary) as a
 * downloadable `.xlsx` or `.pdf`, following trial-balance/export/route.ts's
 * own reference wiring exactly. Re-checks its own `reports`/`export`
 * permission independently of the calling screen's Export button;
 * `gstReportsService.getGstDashboard` re-checks both `reports`/`view` and
 * `gst`/`view` on its own (this dashboard's own confidentiality boundary,
 * per gst-reports-service.ts's own doc comment) — the format branch here
 * does not duplicate or weaken that check, it only picks the rendering
 * target after the service call has already succeeded. Both formats reuse
 * the exact same `toGstDashboardExportTable(report)` shaping — one shaping
 * function, two rendering targets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = gstReportFiltersSchema.parse({
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await gstReportsService.getGstDashboard(filters);
    const tables = toGstDashboardExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const pdf = await renderHtmlToPdf(html, { format: "A4", orientation: "portrait" });

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": PDF_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${downloadFilename(filters.from, filters.to, "pdf")}"`,
        },
      });
    }

    const buffer = await exportToExcelBuffer(tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.from, filters.to, "xlsx")}"`,
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
    logger.error({ err: error }, "Unhandled error generating GST Reports Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
