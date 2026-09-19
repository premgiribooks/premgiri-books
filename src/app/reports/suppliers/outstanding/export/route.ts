import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toSupplierOutstandingExportTable } from "@/engines/reporting/supplier-reports";
import { supplierReportService } from "@/modules/reports/suppliers/services/supplier-report-service";
import { supplierOutstandingFiltersSchema } from "@/modules/reports/suppliers/validation/supplier-report-schema";

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
  return `Supplier-Outstanding-${asOfDate.replace(/[^a-zA-Z0-9._-]/g, "_")}.${format}`;
}

/**
 * Delivers the Supplier Outstanding report as a downloadable `.xlsx` or
 * `.pdf`, following trial-balance/export/route.ts's own reference wiring
 * exactly. A thin Route Handler with no business logic of its own:
 * re-checks its own `reports`/`export` permission (never assuming the
 * calling screen's disabled-until-now Export button implies authorization)
 * ahead of the format branch — both formats are equally gated — re-derives
 * the report from the same already-validated filters the page itself uses
 * (supplierReportService.getSupplierOutstandingReport re-checks
 * `reports`/`view` and financial-year ownership on its own), then reuses the
 * exact same toSupplierOutstandingExportTable(report) shaping for both
 * rendering targets (exportToExcelBuffer for `.xlsx`, buildReportHtml +
 * renderHtmlToPdf for `.pdf`).
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = supplierOutstandingFiltersSchema.parse({
      financialYearId: url.searchParams.get("financialYearId") ?? "",
      asOfDate: url.searchParams.get("asOfDate") ?? "",
      status: url.searchParams.get("status") ?? undefined,
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await supplierReportService.getSupplierOutstandingReport(filters);
    const tables = toSupplierOutstandingExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const pdf = await renderHtmlToPdf(html, { format: "A4", orientation: "portrait" });

      return new NextResponse(new Uint8Array(pdf), {
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
    logger.error({ err: error }, "Unhandled error generating Supplier Outstanding export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
