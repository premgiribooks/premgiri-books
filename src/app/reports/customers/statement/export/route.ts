import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError, getCurrentCompanyUser } from "@/lib/current-user";
import { exportToExcelBuffer } from "@/lib/excel-export";
import { logger } from "@/lib/logger";
import { renderHtmlToPdf } from "@/lib/pdf-generation";
import { buildReportHtml } from "@/lib/pdf-templates/report-pdf-template";
import { assertPermission } from "@/lib/permissions";
import { toCustomerStatementExportTable } from "@/engines/reporting/customer-reports";
import { customerReportService } from "@/modules/reports/customers/services/customer-report-service";
import { customerStatementFiltersSchema } from "@/modules/reports/customers/validation/customer-report-schema";

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

function downloadFilename(customerName: string, dateFrom: string, dateTo: string, format: ExportFormat): string {
  const sanitizedName = customerName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `Customer-Statement-${sanitizedName}-${dateFrom}_to_${dateTo}.${format}`;
}

/**
 * Delivers the Customer Statement report as a downloadable `.xlsx` or `.pdf`,
 * following trial-balance/export/route.ts's own reference wiring exactly.
 * Re-checks its own `reports`/`export` permission independently of the
 * calling screen's Export button; `customerReportService.getCustomerStatement`
 * re-checks `reports`/`view` and same-company ownership on its own. The
 * download filename is built from the report's own `customerName` (not the
 * raw query param) so it always matches the customer actually resolved.
 * Reuses the exact same `toCustomerStatementExportTable(report)` shaping for
 * both rendering targets — one shaping function, two rendering targets.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const filters = customerStatementFiltersSchema.parse({
      customerId: url.searchParams.get("customerId") ?? "",
      dateFrom: url.searchParams.get("dateFrom") ?? "",
      dateTo: url.searchParams.get("dateTo") ?? "",
    });
    const format = resolveFormat(url.searchParams.get("format"));

    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "export");

    const report = await customerReportService.getCustomerStatement(filters);
    const tables = toCustomerStatementExportTable(report);

    if (format === "pdf") {
      const html = buildReportHtml(tables);
      const pdf = await renderHtmlToPdf(html, { format: "A4", orientation: "portrait" });

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": PDF_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${downloadFilename(report.customerName, filters.dateFrom, filters.dateTo, "pdf")}"`,
        },
      });
    }

    const buffer = await exportToExcelBuffer(tables);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${downloadFilename(report.customerName, filters.dateFrom, filters.dateTo, "xlsx")}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Select a valid customer and date range." }, { status: 400 });
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
    logger.error({ err: error }, "Unhandled error generating Customer Statement export");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
