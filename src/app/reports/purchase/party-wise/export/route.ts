import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdfOrHtml } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toPartyWisePurchaseExportTable } from "@/engines/reporting/purchase-reports";
import { purchaseReportService } from "@/modules/reports/purchase/services/purchase-report-service";
import { partyWisePurchaseFiltersSchema } from "@/modules/reports/purchase/validation/purchase-report-schema";

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
  const safeDateFrom = dateFrom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeDateTo = dateTo.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Party-wise-Purchases-${safeDateFrom}_to_${safeDateTo}.${format}`;
}

/**
 * Delivers the Party-wise Purchase Report as a downloadable `.xlsx` or
 * `.pdf`, following trial-balance/export/route.ts's own reference wiring
 * exactly. Re-checks its own `reports`/`export` permission independently of
 * the calling screen's Export button — both formats are equally gated;
 * `purchaseReportService.getPartyWisePurchaseReport` re-checks `reports`/
 * `view` on its own. No optional query params — `partyWisePurchaseFiltersSchema`
 * only has `dateFrom`/`dateTo`. Both rendering targets reuse the exact same
 * `toPartyWisePurchaseExportTable(report)` shaping — one shaping function,
 * two rendering targets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? "";
    const dateTo = url.searchParams.get("dateTo") ?? "";

    const filters = partyWisePurchaseFiltersSchema.parse({ dateFrom, dateTo });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await purchaseReportService.getPartyWisePurchaseReport(filters);
    const tables = toPartyWisePurchaseExportTable(report);

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
    logger.error({ err: error }, "Unhandled error generating Party-wise Purchase Report Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
