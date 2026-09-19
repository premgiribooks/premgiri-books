import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toCashFlowExportTable } from "@/engines/reporting/cash-flow";
import { cashFlowService } from "@/modules/reports/services/cash-flow-service";
import { profitAndLossFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";

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
  return `Cash-Flow-${from}_to_${to}.${format}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Delivers the Cash Flow report as a downloadable `.xlsx` or `.pdf`,
 * following trial-balance/export/route.ts's own reference wiring exactly
 * (Cash Flow reuses `profitAndLossFiltersSchema`'s from/to shape directly,
 * per cash-flow-service.ts's own `ProfitAndLossFiltersInput` parameter
 * type). Re-checks its own `reports`/`export` permission independently of
 * the calling screen's Export button; `cashFlowService.getCashFlow`
 * re-checks `reports`/`view` and financial-year ownership on its own. Both
 * formats reuse the exact same `toCashFlowExportTable(report)` shaping —
 * one shaping function, two rendering targets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = profitAndLossFiltersSchema.parse({
      financialYearId: url.searchParams.get("financialYearId") ?? "",
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await cashFlowService.getCashFlow(filters);
    const tables = toCashFlowExportTable(report);

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
      return NextResponse.json({ error: "Select a valid financial year and From/To date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Cash Flow Excel export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
