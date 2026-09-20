import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdfOrHtml } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toTrialBalanceExportTable } from "@/engines/reporting/trial-balance";
import { trialBalanceReportService } from "@/modules/reports/services/trial-balance-report-service";
import { trialBalanceFiltersSchema } from "@/modules/reports/validation/financial-report-filters-schema";

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

function downloadFilename(asOfDate: string, format: ExportFormat): string {
  const safeDate = asOfDate.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Trial-Balance-${safeDate}.${format}`;
}

/**
 * Delivers the Trial Balance report as a downloadable `.xlsx` or `.pdf` —
 * the reference wiring for both Excel Export (77-excel-export.md's UI
 * section) and Report PDFs (78-pdf-generation.md's Report PDFs rule). A
 * thin Route Handler with no business logic of its own: re-checks its own
 * `reports`/`export` permission (never assuming the calling screen's
 * disabled-until-now Export button implies authorization) ahead of the
 * format branch — both formats are equally gated — re-derives the report
 * from the same already-validated filters the page itself uses
 * (trialBalanceReportService re-checks `reports`/`view` and financial-year
 * ownership on its own), then reuses the exact same
 * `toTrialBalanceExportTable(report)` shaping for both rendering targets
 * (`exportToExcelBuffer` for `.xlsx`, `buildReportHtml` + `renderHtmlToPdf`
 * for `.pdf`) — one shaping function, two rendering targets, never two
 * independently-derived row sets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = trialBalanceFiltersSchema.parse({
      financialYearId: url.searchParams.get("financialYearId") ?? "",
      asOfDate: url.searchParams.get("asOfDate") ?? "",
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await trialBalanceReportService.getTrialBalanceReport(filters);
    const tables = toTrialBalanceExportTable(report);

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
          "Content-Disposition": `attachment; filename="${downloadFilename(filters.asOfDate, "pdf")}"`,
        },
      });
    }

    const buffer = await exportToExcelBuffer(tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(filters.asOfDate, "xlsx")}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid financial year and as-of date." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Trial Balance export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
