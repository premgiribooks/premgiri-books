import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toSupplierStatementExportTable } from "@/engines/reporting/supplier-reports";
import { supplierReportService } from "@/modules/reports/suppliers/services/supplier-report-service";
import { supplierStatementFiltersSchema } from "@/modules/reports/suppliers/validation/supplier-report-schema";

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

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function downloadFilename(supplierName: string, dateFrom: string, dateTo: string, format: ExportFormat): string {
  return `Supplier-Statement-${sanitizeForFilename(supplierName)}-${dateFrom}_to_${dateTo}.${format}`;
}

/**
 * Delivers the Supplier Statement report as a downloadable `.xlsx` or
 * `.pdf`, following trial-balance/export/route.ts's own reference wiring
 * exactly. A thin Route Handler with no business logic of its own:
 * re-checks its own `reports`/`export` permission (never assuming the
 * calling screen's disabled-until-now Export button implies authorization)
 * ahead of the format branch — both formats are equally gated — re-derives
 * the report from the same already-validated filters the page itself uses
 * (supplierReportService.getSupplierStatement re-checks `reports`/`view` and
 * same-company ownership on its own), then reuses the exact same
 * toSupplierStatementExportTable(report) shaping for both rendering targets
 * (exportToExcelBuffer for `.xlsx`, buildReportHtml + renderHtmlToPdf for
 * `.pdf`). The download filename is built from the report's own
 * `supplierName` — not the raw `supplierId` query param — so it always
 * matches the supplier the file actually contains, for both formats.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = supplierStatementFiltersSchema.parse({
      supplierId: url.searchParams.get("supplierId") ?? "",
      dateFrom: url.searchParams.get("dateFrom") ?? "",
      dateTo: url.searchParams.get("dateTo") ?? "",
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await supplierReportService.getSupplierStatement(filters);
    const tables = toSupplierStatementExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const pdf = await renderHtmlToPdf(html, { format: "A4", orientation: "portrait" });

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": PDF_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${downloadFilename(report.supplierName, filters.dateFrom, filters.dateTo, "pdf")}"`,
        },
      });
    }

    const buffer = await exportToExcelBuffer(tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(report.supplierName, filters.dateFrom, filters.dateTo, "xlsx")}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid supplier and date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Supplier Statement export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
